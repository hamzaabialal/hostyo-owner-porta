/**
 * Property-level owner payout reconciliation with carry-forward deficit.
 *
 * Rule (from client spec):
 *   If a reservation goes negative (expenses exceed owner payout), do NOT pay
 *   the owner. Carry that negative amount forward. The next reservation's
 *   payouts are first used to clear that deficit. While the deficit is not
 *   fully cleared, all new payouts are either fully held or partially reduced.
 *   Only after the deficit reaches zero can normal owner payouts resume.
 *
 * Walk order: reservations are sorted chronologically by checkout date.
 *
 * Expense sources per reservation:
 *   1. reservation.expenses         — built-in field on the Reservation in Notion
 *   2. Linked expense rows          — Expenses DB rows where Reservation ID matches
 *   3. Property-level expenses      — Expenses DB rows with no Reservation ID;
 *                                     assigned to the next chronological reservation
 *                                     for the same property, consumed exactly once.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RawReservation {
  id: number | string;
  ref?: string;
  property?: string;
  guest?: string;
  checkin?: string;
  checkout?: string;
  status?: string;
  payoutStatus?: string;
  grossAmount?: number;
  platformFee?: number;
  managementFee?: number;
  cleaning?: number;
  expenses?: number;   // Built-in reservation "Expenses" field
  ownerPayout?: number;
}

export interface RawExpense {
  id: string;
  property?: string;
  reservation?: string; // Reservation ID reference (empty = property-level)
  amount?: number;
  status?: string;
  date?: string;
  category?: string;
  vendor?: string;
  description?: string;
}

/** Tracks the origin of a deficit — which reservation produced it and which expenses drove it negative. */
export interface DeficitSource {
  reservationRef: string;       // Reservation Code of the row that went negative
  reservationId: string | number; // Notion page id
  amount: number;               // How much deficit this reservation contributed
  expenseIds: string[];         // Expense page IDs linked to that reservation
  expenseDescriptions: string[]; // Human-readable labels for each linked expense
}

export interface ReconciledReservation {
  // Echo of the source row
  id: number | string;
  ref: string;
  property: string;
  guest: string;
  checkin: string;
  checkout: string;
  status: string;
  originalPayoutStatus: string;

  // Original amounts (before reconciliation)
  grossAmount: number;
  platformFee: number;
  managementFee: number;
  vat: number;
  cleaning: number;
  ownerPayoutRaw: number;      // what the reservation says the owner should get

  // Expense sources
  reservationExpenseField: number;  // built-in Expenses field on reservation
  linkedExpensesTotal: number;      // sum of Expenses DB rows linked to this reservation
  propertyExpensesApplied: number;  // sum of property-level expenses consumed by this row
  appliedExpenseIds: string[];      // the specific property-expense ids that got consumed here
  totalExpenses: number;            // sum of all three above

  // Deficit chain
  deficitBefore: number;       // carry-forward deficit entering this row
  netPayout: number;           // ownerPayoutRaw - totalExpenses - deficitBefore
  appliedToDeficit: number;    // how much of the net went toward clearing deficit
  paidToOwner: number;         // how much is released to the owner (0 if on hold)
  deficitAfter: number;        // carry-forward deficit leaving this row

  // Deficit source tracking — which reservations/expenses created the deficit
  // being applied to this row (only populated when appliedToDeficit > 0)
  deficitSources: DeficitSource[];

  // Computed state
  isOnHold: boolean;
  holdReason: string;
}

export interface ReconcileResult {
  /** Per-property map: property name → chronologically ordered reconciled rows */
  byProperty: Record<string, ReconciledReservation[]>;
  /** Flat list across all properties, same chronological order per property */
  rows: ReconciledReservation[];
  /** Final deficit per property after the last reservation */
  finalDeficit: Record<string, number>;
}

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

function normalizeKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function isSameProperty(a: string, b: string): boolean {
  const x = normalizeKey(a);
  const y = normalizeKey(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/**
 * Is this expense "counted" for reconciliation purposes?
 *
 * We count Paid, Approved, and In Review (to be safe — don't release money
 * that's about to be spent). Declined / Draft / Rejected expenses are ignored.
 */
function isCountedExpense(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "paid" || s === "approved" || s === "in review";
}

function compareDate(a: string | undefined, b: string | undefined): number {
  return (a || "").localeCompare(b || "");
}

/* ----------------------------------------------------------------------------
 * Core walker
 * -------------------------------------------------------------------------- */

/**
 * Reconcile a single property's reservations against its expenses using the
 * carry-forward deficit rule.
 *
 * Input reservations are expected to belong to ONE property (filtering happens
 * in `reconcileAll`). Expenses are the full expense list — this function
 * filters to just those belonging to the property.
 */
export function reconcileProperty(
  propertyName: string,
  reservations: RawReservation[],
  expenses: RawExpense[]
): ReconciledReservation[] {
  // Build a lookup of linked expenses per reservation (for traceability display only)
  const propertyExpenses = expenses.filter(
    (e) => isSameProperty(e.property || "", propertyName) && isCountedExpense(e.status)
  );
  const linkedByRef = new Map<string, RawExpense[]>();
  for (const exp of propertyExpenses) {
    const resRef = (exp.reservation || "").trim();
    if (resRef) {
      const key = resRef.slice(0, 10).toLowerCase();
      if (!linkedByRef.has(key)) linkedByRef.set(key, []);
      linkedByRef.get(key)!.push(exp);
    }
  }

  // Sort reservations chronologically by checkout date (the date payout would fire)
  const sorted = [...reservations]
    .filter((r) => (r.status || "") === "Completed")
    .sort((a, b) => compareDate(a.checkout, b.checkout));

  let carryDeficit = 0;
  // Track the chain of deficit sources so we can attribute adjustments
  let carryDeficitSources: DeficitSource[] = [];
  const results: ReconciledReservation[] = [];

  // The carry-forward walk uses ONLY Notion's Owner Payout values. Notion already
  // calculates Owner Payout net of any linked expenses. Property-level expenses
  // affect the Balance field separately (computed in sync-balances.ts) but are NOT
  // applied on top of individual reservation payouts here — doing so would double-count.

  for (const r of sorted) {
    const ownerPayoutRaw = r.ownerPayout || 0;
    const managementFee = r.managementFee || 0;

    // For traceability only — these are already baked into ownerPayoutRaw by Notion.
    const reservationExpenseField = r.expenses || 0;
    const refKey = (r.ref || "").slice(0, 10).toLowerCase();
    const linkedRows = refKey ? (linkedByRef.get(refKey) || []) : [];
    const linkedExpensesTotal = linkedRows.reduce((s, e) => s + (e.amount || 0), 0);
    const appliedExpenseIds: string[] = [];
    const propertyExpensesApplied = 0;
    const totalExpenses = 0;

    // Carry-forward deficit from prior reservations on this property
    const deficitBefore = carryDeficit;
    const netPayout = ownerPayoutRaw - deficitBefore;

    let paidToOwner = 0;
    let appliedToDeficit = 0;
    let deficitAfter = 0;
    let isOnHold = false;
    let holdReason = "";
    let deficitSources: DeficitSource[] = [];

    if (netPayout >= 0) {
      // Owner is paid; deficit is cleared
      paidToOwner = netPayout;
      appliedToDeficit = deficitBefore;
      deficitAfter = 0;
      // Snapshot the sources that were cleared by this reservation
      deficitSources = deficitBefore > 0 ? [...carryDeficitSources] : [];
      // Deficit fully cleared — reset the carry chain
      carryDeficitSources = [];
    } else {
      // Reservation cannot cover its own expenses + existing deficit
      paidToOwner = 0;
      // The portion that went "toward" clearing old deficit is whatever was
      // available after the reservation's own expenses were paid off.
      const availableAfterOwnExpenses = Math.max(0, ownerPayoutRaw - totalExpenses);
      appliedToDeficit = Math.min(deficitBefore, availableAfterOwnExpenses);
      deficitAfter = -netPayout; // magnitude of the new deficit
      isOnHold = true;

      // Snapshot deficit sources inherited from prior rows
      deficitSources = deficitBefore > 0 ? [...carryDeficitSources] : [];

      // If THIS reservation itself produced a negative payout, it becomes a new deficit source.
      if (ownerPayoutRaw < 0) {
        carryDeficitSources = [
          ...carryDeficitSources,
          {
            reservationRef: r.ref || "",
            reservationId: r.id,
            amount: Math.abs(ownerPayoutRaw),
            expenseIds: linkedRows.map((e) => e.id),
            expenseDescriptions: linkedRows.map((e) =>
              [e.category, e.vendor, e.amount ? `€${e.amount.toFixed(2)}` : ""].filter(Boolean).join(" · ")
            ),
          },
        ];
      }

      // Build a human-readable hold reason that distinguishes the three causes:
      //   (a) reservation itself produced a negative owner payout,
      //   (b) property-level expense pushed it negative,
      //   (c) carried deficit from an earlier reservation.
      const reasons: string[] = [];
      if (ownerPayoutRaw < 0) {
        reasons.push(`reservation owner payout is negative (€${ownerPayoutRaw.toFixed(2)})`);
      }
      if (propertyExpensesApplied > 0) {
        reasons.push(`property expenses applied (€${propertyExpensesApplied.toFixed(2)})`);
      }
      if (deficitBefore > 0) {
        reasons.push(`prior carry-forward deficit (€${deficitBefore.toFixed(2)})`);
      }
      const causes = reasons.length > 0 ? reasons.join(" + ") : `expenses exceed owner payout`;
      holdReason = `€${deficitAfter.toFixed(2)} deficit — ${causes}.`;
    }

    carryDeficit = deficitAfter;

    results.push({
      id: r.id,
      ref: r.ref || "",
      property: (r.property || "").trim(),
      guest: r.guest || "",
      checkin: (r.checkin || "").split("T")[0],
      checkout: (r.checkout || "").split("T")[0],
      status: r.status || "Completed",
      originalPayoutStatus: r.payoutStatus || "Pending",

      grossAmount: r.grossAmount || 0,
      platformFee: r.platformFee || 0,
      managementFee,
      vat: managementFee * 0.19,
      cleaning: r.cleaning || 0,
      ownerPayoutRaw,

      reservationExpenseField,
      linkedExpensesTotal,
      propertyExpensesApplied,
      appliedExpenseIds,
      totalExpenses,

      deficitBefore,
      netPayout,
      appliedToDeficit,
      paidToOwner,
      deficitAfter,

      deficitSources,

      isOnHold,
      holdReason,
    });
  }

  return results;
}

/**
 * Reconcile every property's reservations at once. Groups reservations by
 * property (using fuzzy startsWith matching), walks each group independently,
 * and returns both the grouped map and a flat list.
 */
export function reconcileAll(
  reservations: RawReservation[],
  expenses: RawExpense[]
): ReconcileResult {
  // Group reservations by normalized property name
  const byProp = new Map<string, RawReservation[]>();
  for (const r of reservations) {
    const key = normalizeKey(r.property || "");
    if (!key) continue;
    if (!byProp.has(key)) byProp.set(key, []);
    byProp.get(key)!.push(r);
  }

  const byProperty: Record<string, ReconciledReservation[]> = {};
  const rows: ReconciledReservation[] = [];
  const finalDeficit: Record<string, number> = {};

  byProp.forEach((list) => {
    // Use the first reservation's property name as the canonical display name.
    const propName = (list[0]?.property || "").trim();
    const reconciled = reconcileProperty(propName, list, expenses);
    byProperty[propName] = reconciled;
    rows.push(...reconciled);
    finalDeficit[propName] = reconciled.length > 0
      ? reconciled[reconciled.length - 1].deficitAfter
      : 0;
  });

  return { byProperty, rows, finalDeficit };
}

/**
 * Compute the current running deficit for a single property.
 * Returns 0 if balance is positive or no reservations exist.
 */
export function currentDeficit(
  propertyName: string,
  reservations: RawReservation[],
  expenses: RawExpense[]
): number {
  const rows = reconcileProperty(propertyName, reservations, expenses);
  if (rows.length === 0) return 0;
  return rows[rows.length - 1].deficitAfter;
}
