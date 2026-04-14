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
import { type RawReservation, type RawExpense, reconcileAll } from "@/lib/reconcile";
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

      // Read the raw Notion number value directly (NOT through getProp, which
      // coerces null → 0 and would make us skip properties that need writing).
      const balanceProp = (page as any).properties?.["Balance"];
      const rawNum = balanceProp?.type === "number" ? balanceProp.number : null;
      // Skip write only if the field already has the correct value.
      // If rawNum is null (field empty / never set), always write even if balance is 0.
      if (rawNum !== null && rawNum !== undefined && Math.abs(rawNum - balance) < 0.005) {
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

      const balProp = (page as any).properties?.["Balance"];
      const rawBal = balProp?.type === "number" ? balProp.number : null;
      if (rawBal !== null && rawBal !== undefined && Math.abs(rawBal - balance) < 0.005) continue;

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

/**
 * Sync the Expenses column on a Reservation page in Notion.
 *
 * Given a reservation reference code, sums all linked expenses from the
 * Expenses DB (where Reservation ID contains this ref) that have status
 * Paid or Approved, and writes the total back to the reservation's
 * `Expenses` number field.
 *
 * Called after any expense create/update/delete that has a Reservation ID.
 */
export async function syncReservationExpenses(reservationRef: string): Promise<void> {
  if (!reservationRef || !DB.reservations || !DB.expenses) return;

  const ref = reservationRef.trim();
  if (!ref) return;

  try {
    // Find the reservation page in Notion by its Reservation Code
    const reservationPages = await queryDatabase(DB.reservations, {
      property: "Reservation Code",
      rich_text: { contains: ref.slice(0, 10) },
    });

    if (reservationPages.length === 0) return;

    // Find all linked expenses for this reservation
    const expensePages = await queryDatabase(DB.expenses);
    const refKey = ref.slice(0, 10).toLowerCase();
    let total = 0;
    for (const ep of expensePages) {
      const expRef = (getProp(ep, "Reservation ID") || "").trim();
      if (!expRef) continue;
      if (!expRef.toLowerCase().includes(refKey)) continue;
      const status = (getProp(ep, "Status ") || getProp(ep, "Status") || "").toLowerCase();
      if (status === "paid" || status === "approved") {
        // Read amount — handle both number and rich_text types
        const amtProp = (ep as any).properties?.["Amount"];
        let amount = 0;
        if (amtProp?.type === "number") amount = amtProp.number || 0;
        else if (amtProp?.type === "rich_text") {
          const raw = amtProp.rich_text?.[0]?.plain_text || "0";
          amount = parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
        } else if (amtProp?.type === "formula" && amtProp.formula?.type === "number") {
          amount = amtProp.formula.number || 0;
        }
        total += amount;
      }
    }

    // Write the total to the reservation's Expenses field.
    // Try as number first, fall back to rich_text if the field type differs.
    const reservationPage = reservationPages[0] as any;
    const currentExpenses = getProp(reservationPage, "Expenses") || 0;
    if (Math.abs(Number(currentExpenses) - total) < 0.005) return; // no change

    try {
      await notion.pages.update({
        page_id: reservationPage.id,
        properties: { Expenses: { number: total } },
      });
    } catch (numErr: any) {
      // If Expenses is a formula or different type, log and skip
      console.error("syncReservationExpenses: could not write Expenses as number:", numErr?.message);
    }

    invalidate("reservations");
  } catch (error: any) {
    console.error("syncReservationExpenses error:", error?.message || error);
  }
}

/* ----------------------------------------------------------------------------
 * Deficit adjustment write-back
 *
 * Runs the carry-forward reconciliation, then writes two things back to Notion:
 *   1. Per-reservation: "Deficit Adjustment" (number) and "Deficit Source" (rich_text)
 *      so the owner payout record shows a line item for the adjustment with the
 *      linked expense.
 *   2. Per-property: "Deficit Status" (select) — "Active Deficit" while there's
 *      an outstanding deficit, "Recovered" once it reaches zero.
 *
 * Called after expense mutations and by the daily cron.
 * -------------------------------------------------------------------------- */

export interface DeficitSyncResult {
  ok: boolean;
  reservationsUpdated: number;
  propertiesUpdated: number;
  errors: { id: string; error: string }[];
}

/**
 * Sync deficit adjustments for ALL properties (or a specific list).
 *
 * When `targetProperties` is supplied, only those properties are processed.
 * This keeps the real-time path (expense create/update/delete) fast.
 */
export async function syncDeficitAdjustments(
  targetProperties?: string[]
): Promise<DeficitSyncResult> {
  if (!DB.properties || !DB.reservations || !DB.expenses) {
    return { ok: false, reservationsUpdated: 0, propertiesUpdated: 0, errors: [] };
  }

  const result: DeficitSyncResult = {
    ok: true,
    reservationsUpdated: 0,
    propertiesUpdated: 0,
    errors: [],
  };

  try {
    const [propertyPages, reservationPages, expensePages] = await Promise.all([
      queryDatabase(DB.properties),
      queryDatabase(DB.reservations, { property: "Deleted", checkbox: { equals: false } }),
      queryDatabase(DB.expenses),
    ]);

    const reservations: RawReservation[] = reservationPages.map(mapReservation);
    const expenses: RawExpense[] = expensePages.map(mapExpense);

    // Build skip-automation list
    const skipNames = propertyPages
      .filter((p: any) => getProp(p, "Skip Automation") === true)
      .map((p: any) => normalizeKey(getProp(p, "Name") || ""))
      .filter(Boolean);

    const isSkipped = (name: string): boolean => {
      const n = normalizeKey(name);
      if (!n) return false;
      return skipNames.some((s: string) => s === n || s.startsWith(n) || n.startsWith(s));
    };

    // Filter to eligible data
    const eligibleRes = reservations.filter((r) => !isSkipped(r.property || ""));
    const eligibleExp = expenses.filter((e) => !isSkipped(e.property || ""));

    // Run reconciliation
    const { byProperty, finalDeficit } = reconcileAll(eligibleRes, eligibleExp);

    // If we're targeting specific properties, only process those
    const propertiesToProcess = targetProperties
      ? Object.keys(byProperty).filter((p) =>
          targetProperties.some((t) => isSameProperty(t, p))
        )
      : Object.keys(byProperty);

    // 1. Write adjustment data back to each reservation
    for (const propName of propertiesToProcess) {
      const rows = byProperty[propName] || [];
      for (const row of rows) {
        // Only write to reservations that have deficit activity
        if (row.appliedToDeficit === 0 && row.deficitAfter === 0) continue;

        // Find the Notion page for this reservation
        const resPage = reservationPages.find((p: any) => {
          const pageId = (p as any).id;
          return pageId === row.id;
        });
        if (!resPage) continue;

        // Build the adjustment description from deficit sources
        let sourceDescription = "";
        if (row.appliedToDeficit > 0 && row.deficitSources.length > 0) {
          const parts = row.deficitSources.map((src) => {
            const expPart = src.expenseDescriptions.length > 0
              ? ` (${src.expenseDescriptions.join("; ")})`
              : "";
            return `${src.reservationRef}: €${src.amount.toFixed(2)}${expPart}`;
          });
          sourceDescription = `Deficit recovery from: ${parts.join(" | ")}`;
        } else if (row.deficitAfter > 0) {
          sourceDescription = `Deficit of €${row.deficitAfter.toFixed(2)} carried forward to next reservation.`;
        }

        // Read current values to avoid unnecessary writes
        const currentAdj = getProp(resPage, "Deficit Adjustment") ?? null;
        const currentSrc = getProp(resPage, "Deficit Source") || "";
        const newAdj = row.appliedToDeficit > 0 ? -row.appliedToDeficit : 0;

        if (
          currentAdj !== null &&
          Math.abs(Number(currentAdj) - newAdj) < 0.005 &&
          currentSrc === sourceDescription
        ) {
          continue; // No change needed
        }

        try {
          await notion.pages.update({
            page_id: (resPage as any).id,
            properties: {
              "Deficit Adjustment": { number: newAdj },
              "Deficit Source": {
                rich_text: [{ text: { content: sourceDescription.slice(0, 2000) } }],
              },
            },
          });
          result.reservationsUpdated++;
        } catch (err: any) {
          // If the properties don't exist yet in Notion, log but don't fail
          console.error(`syncDeficitAdjustments: reservation ${row.ref}:`, err?.message || err);
          result.errors.push({ id: String(row.id), error: err?.message || "Unknown" });
        }
      }
    }

    // 2. Update property Deficit Status
    for (const propName of propertiesToProcess) {
      const deficit = finalDeficit[propName] || 0;
      const newStatus = deficit > 0 ? "Active Deficit" : "Recovered";

      const propPage = propertyPages.find((p: any) => {
        const name = getProp(p, "Name") || "";
        return isSameProperty(name, propName);
      });
      if (!propPage) continue;
      if (isSkipped(getProp(propPage, "Name") || "")) continue;

      // Read current status to avoid unnecessary writes
      const currentStatus = getProp(propPage, "Deficit Status") || "";
      // Don't write "Recovered" if there was never a deficit (status is empty)
      if (deficit === 0 && !currentStatus) continue;
      if (currentStatus === newStatus) continue;

      try {
        await notion.pages.update({
          page_id: (propPage as any).id,
          properties: {
            "Deficit Status": { select: { name: newStatus } },
          },
        });
        result.propertiesUpdated++;
      } catch (err: any) {
        console.error(`syncDeficitAdjustments: property ${propName}:`, err?.message || err);
        result.errors.push({ id: propName, error: err?.message || "Unknown" });
      }
    }

    invalidate("reservations");
    invalidate("properties");

    return result;
  } catch (error: any) {
    console.error("syncDeficitAdjustments error:", error?.message || error);
    return { ok: false, reservationsUpdated: 0, propertiesUpdated: 0, errors: [] };
  }
}
