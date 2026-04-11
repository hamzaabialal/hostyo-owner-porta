/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/properties/sync-balances
 *
 * Recalculates the live "Balance" for every property in the Notion Properties DB
 * and writes it back to the `Balance` number column on each property page.
 *
 * The balance is computed by running the carry-forward deficit reconciliation
 * (the same logic the UI uses) over every reservation + expense for that property.
 * The result is the *single source of truth* for what the owner is currently
 * owed (positive number) or what is being held against a deficit (negative number).
 *
 * Logic per property:
 *   1. Walk all Completed reservations chronologically by checkout date.
 *   2. Apply property-level Paid expenses to whichever reservation comes next.
 *   3. Apply carry-forward deficit from prior reservations.
 *   4. The "balance" written to Notion is:
 *        +(sum of paidToOwner across all Pending reservations)  if no deficit
 *        -(remaining carry-forward deficit)                     if in deficit
 *
 * In other words: positive = owed to owner, negative = on hold.
 */
import { NextResponse } from "next/server";
import notion from "@/lib/notion";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { reconcileProperty, type RawReservation, type RawExpense } from "@/lib/reconcile";
import { invalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";

function normalizeKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

// Same fuzzy match the UI uses, so a property name like
// "Chic City Centre Stay With Stunning View" still matches reservations
// recorded as "Chic City Centre Stay With Stunning Views".
function isSameProperty(a: string, b: string): boolean {
  const x = normalizeKey(a);
  const y = normalizeKey(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

// Map a Notion Reservations page → RawReservation
function reservationProp(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "number": return p.number;
    case "select": return p.select?.name || "";
    case "status": return p.status?.name || "";
    case "date": return p.date?.start || "";
    case "checkbox": return p.checkbox;
    case "formula":
      if (p.formula.type === "number") return p.formula.number;
      if (p.formula.type === "string") return p.formula.string;
      return null;
    default: return null;
  }
}

function mapReservation(page: any): RawReservation {
  return {
    id: page.id,
    ref: reservationProp(page, "Reservation Code") || "",
    property: reservationProp(page, "Property") || "",
    guest: reservationProp(page, "Guest") || "",
    checkin: (reservationProp(page, "Check In") || "").split("T")[0],
    checkout: (reservationProp(page, "Check Out") || "").split("T")[0],
    status: reservationProp(page, "Status") || "Pending",
    payoutStatus: reservationProp(page, "Payout Status") || "Pending",
    grossAmount: reservationProp(page, "Revenue") || 0,
    platformFee: reservationProp(page, "Platform Commission") || 0,
    managementFee: reservationProp(page, "Management Fee") || 0,
    cleaning: reservationProp(page, "Cleaning") || 0,
    expenses: reservationProp(page, "Expenses") || 0,
    ownerPayout: reservationProp(page, "Owner Payout") || 0,
  };
}

function mapExpense(page: any): RawExpense {
  // The Expenses DB stores Amount as rich_text in this codebase — handle both shapes.
  let amount = 0;
  const amtProp = page.properties?.["Amount"];
  if (amtProp?.type === "number") amount = amtProp.number || 0;
  else if (amtProp?.type === "rich_text") {
    const raw = amtProp.rich_text?.[0]?.plain_text || "0";
    amount = parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
  } else if (amtProp?.type === "formula" && amtProp.formula?.type === "number") {
    amount = amtProp.formula.number || 0;
  }

  return {
    id: page.id,
    property: getProp(page, "Property") || "",
    reservation: getProp(page, "Reservation ID") || "",
    amount,
    status: getProp(page, "Status ") || getProp(page, "Status") || "",
    date: getProp(page, "Created") || "",
    category: getProp(page, "Category ") || getProp(page, "Category") || "",
    vendor: getProp(page, "Vendor Name") || "",
  };
}

/**
 * Compute the live balance for one property using the same reconciliation
 * walker the UI uses. Returns:
 *   positive number = amount currently owed to the owner (paid out + cleared)
 *   negative number = current carry-forward deficit (payouts on hold)
 *   zero            = nothing pending
 */
function computeBalance(
  propertyName: string,
  reservations: RawReservation[],
  expenses: RawExpense[]
): number {
  const rows = reconcileProperty(propertyName, reservations, expenses);
  if (rows.length === 0) return 0;

  const last = rows[rows.length - 1];
  // If a deficit exists, that's the negative balance
  if (last.deficitAfter > 0) return -Number(last.deficitAfter.toFixed(2));

  // Otherwise, the balance is the sum of paidToOwner from reservations whose
  // payout status is still Pending (i.e. money owed but not yet released by
  // the 3-day automation).
  const pendingOwed = rows
    .filter((r) => r.originalPayoutStatus === "Pending")
    .reduce((s, r) => s + r.paidToOwner, 0);
  return Number(pendingOwed.toFixed(2));
}

export async function POST() {
  if (!DB.properties || !DB.reservations || !DB.expenses) {
    return NextResponse.json(
      { ok: false, error: "Required Notion databases are not configured." },
      { status: 500 }
    );
  }

  try {
    // Pull everything in parallel
    const [propertyPages, reservationPages, expensePages] = await Promise.all([
      queryDatabase(DB.properties),
      queryDatabase(DB.reservations, { property: "Deleted", checkbox: { equals: false } }),
      queryDatabase(DB.expenses),
    ]);

    const reservations: RawReservation[] = reservationPages.map(mapReservation);
    const expenses: RawExpense[] = expensePages.map(mapExpense);

    let updated = 0;
    let skipped = 0;
    const errors: { property: string; error: string }[] = [];
    const results: { property: string; balance: number; updated: boolean }[] = [];

    for (const page of propertyPages) {
      const propertyName = getProp(page, "Name") || "";
      const skip = getProp(page, "Skip Automation") === true;
      if (!propertyName || skip) {
        skipped++;
        continue;
      }

      // Filter reservations + expenses to this property only
      const propRes = reservations.filter((r) => isSameProperty(r.property || "", propertyName));
      const propExp = expenses.filter((e) => isSameProperty(e.property || "", propertyName));

      const balance = computeBalance(propertyName, propRes, propExp);

      // Only write if the value actually changed (avoid unnecessary Notion writes)
      const currentBalance = Number(getProp(page, "Balance") || 0);
      if (Math.abs(currentBalance - balance) < 0.005) {
        results.push({ property: propertyName, balance, updated: false });
        continue;
      }

      try {
        await notion.pages.update({
          page_id: (page as any).id,
          properties: {
            Balance: { number: balance },
          },
        });
        updated++;
        results.push({ property: propertyName, balance, updated: true });
      } catch (err: any) {
        errors.push({ property: propertyName, error: err?.message || "Unknown Notion error" });
      }
    }

    // Bust the local cache so the next GET reflects the updated balances
    invalidate("properties");

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      total: propertyPages.length,
      errors,
      results,
    });
  } catch (error: any) {
    console.error("sync-balances error:", error?.message || error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync balances" },
      { status: 500 }
    );
  }
}
