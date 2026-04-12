/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property balance reconciliation + Notion write-back.
 *
 * Used by:
 *   - POST /api/properties/sync-balances     (manual trigger from UI button)
 *   - GET  /api/properties/sync-balances     (Vercel Cron daily)
 *   - POST /api/expenses                     (after creating an expense)
 *   - PATCH /api/expenses/[id]               (after updating an expense)
 *   - DELETE /api/expenses/[id]              (after deleting an expense)
 *   - POST /api/submit/[token]               (after a vendor submits work)
 *
 * Single source of truth for "what is the current owner balance for each
 * property" — computes the simple balance formula and writes the result to
 * the `Balance` number column in the Notion Properties database.
 *
 * Balance = Σ(Owner Payout where Status=Completed AND Payout Status=Pending)
 *         − Σ(Paid property-level expenses with no Reservation ID)
 */
import notion from "@/lib/notion";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { type RawReservation, type RawExpense } from "@/lib/reconcile";
import { invalidate } from "@/lib/cache";

function normalizeKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

// Same fuzzy match the UI uses, so a property name like
// "Chic City Centre Stay With Stunning View" still matches reservations
// recorded as "Chic City Centre Stay With Stunning Views".
export function isSameProperty(a: string, b: string): boolean {
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
 * Compute the live balance for one property.
 *
 * Formula (from client spec):
 *   Balance = Σ(Owner Payout) where Status = Completed AND Payout Status = Pending
 *
 * That's it — no expense subtraction here. The Owner Payout field in Notion
 * is already net of reservation-linked expenses. Property-level expenses are
 * handled at payout time by the carry-forward logic, not in this balance.
 *
 * Positive = owed to the owner (payout pending)
 * Negative = one or more reservations have negative owner payouts (deficit)
 * Zero     = nothing pending
 */
function computeBalance(
  propertyName: string,
  reservations: RawReservation[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _expenses: RawExpense[]
): number {
  const pendingSum = reservations
    .filter((r) =>
      isSameProperty(r.property || "", propertyName) &&
      (r.status || "") === "Completed" &&
      (r.payoutStatus || "") === "Pending"
    )
    .reduce((s, r) => s + (r.ownerPayout || 0), 0);

  return Number(pendingSum.toFixed(2));
}

export interface SyncResult {
  ok: boolean;
  updated: number;
  skipped: number;
  total: number;
  errors: { property: string; error: string }[];
  results: { property: string; balance: number; updated: boolean }[];
  error?: string;
}

/**
 * Sync ALL property balances. Used by:
 *   - The manual UI button on /finances/payouts
 *   - The daily Vercel cron
 */
export async function syncAllPropertyBalances(): Promise<SyncResult> {
  if (!DB.properties || !DB.reservations || !DB.expenses) {
    return {
      ok: false,
      updated: 0,
      skipped: 0,
      total: 0,
      errors: [],
      results: [],
      error: "Required Notion databases are not configured.",
    };
  }

  try {
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

      const propRes = reservations.filter((r) => isSameProperty(r.property || "", propertyName));
      const propExp = expenses.filter((e) => isSameProperty(e.property || "", propertyName));

      const balance = computeBalance(propertyName, propRes, propExp);

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

    invalidate("properties");

    return { ok: true, updated, skipped, total: propertyPages.length, errors, results };
  } catch (error: any) {
    console.error("syncAllPropertyBalances error:", error?.message || error);
    return {
      ok: false,
      updated: 0,
      skipped: 0,
      total: 0,
      errors: [],
      results: [],
      error: error?.message || "Failed to sync balances",
    };
  }
}

/**
 * Sync the balance for a SINGLE property by name.
 *
 * Used by the expense create/update/delete endpoints to keep the owner balance
 * fresh in real time without recomputing every property in the database.
 *
 * If `propertyNames` contains multiple names (e.g. an expense was moved from
 * one property to another), each one is synced individually.
 *
 * This function is "best effort" — it logs errors but never throws, so it
 * won't break the parent request if the sync fails.
 */
export async function syncPropertyBalances(propertyNames: string[]): Promise<void> {
  // Dedupe + drop empties
  const targets = Array.from(new Set(propertyNames.map((n) => (n || "").trim()).filter(Boolean)));
  if (targets.length === 0) return;
  if (!DB.properties || !DB.reservations || !DB.expenses) return;

  try {
    const [propertyPages, reservationPages, expensePages] = await Promise.all([
      queryDatabase(DB.properties),
      queryDatabase(DB.reservations, { property: "Deleted", checkbox: { equals: false } }),
      queryDatabase(DB.expenses),
    ]);

    const reservations: RawReservation[] = reservationPages.map(mapReservation);
    const expenses: RawExpense[] = expensePages.map(mapExpense);

    // For each requested property name, find its Notion page (with fuzzy match)
    // and write the recomputed balance.
    for (const targetName of targets) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any = propertyPages.find((p: any) => {
        const name = getProp(p, "Name") || "";
        return isSameProperty(name, targetName);
      });
      if (!page) continue;

      const skip = getProp(page, "Skip Automation") === true;
      if (skip) continue;

      const canonicalName = getProp(page, "Name") || targetName;
      const propRes = reservations.filter((r) => isSameProperty(r.property || "", canonicalName));
      const propExp = expenses.filter((e) => isSameProperty(e.property || "", canonicalName));

      const balance = computeBalance(canonicalName, propRes, propExp);

      const currentBalance = Number(getProp(page, "Balance") || 0);
      if (Math.abs(currentBalance - balance) < 0.005) continue;

      try {
        await notion.pages.update({
          page_id: page.id,
          properties: { Balance: { number: balance } },
        });
      } catch (err: any) {
        console.error(`syncPropertyBalances: failed to update ${canonicalName}`, err?.message || err);
      }
    }

    invalidate("properties");
  } catch (error: any) {
    // Best effort — log and move on
    console.error("syncPropertyBalances error:", error?.message || error);
  }
}
