"use client";

import { useState, useEffect, useMemo } from "react";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import { useData } from "@/lib/DataContext";
import { reconcileAll, type ReconciledReservation, type RawReservation, type RawExpense } from "@/lib/reconcile";

const FINANCE_TABS = [
  { label: "Overview", href: "/finances", exact: true },
  { label: "Earnings", href: "/finances/earnings" },
  { label: "Expenses", href: "/finances/expenses" },
  { label: "Payouts", href: "/finances/payouts" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PayoutRow {
  id: number;
  guest: string;
  ref: string;
  property: string;
  channel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: string;
  payoutStatus: string;     // Effective status after reconciliation (may be "On Hold")
  rawPayoutStatus: string;  // Original Notion status
  payoutError: string;
  holdReason: string;       // Auto-generated when reconciliation flips it on hold
  gross: number;
  platformFee: number;
  cleaning: number;
  managementFee: number;
  vat: number;
  expenses: number;         // Total expenses applied to this reservation by reconciliation
  ownerPayout: number;      // Original (raw) owner payout — what Notion calculated
  // Reconciliation results
  appliedToDeficit: number; // How much of the payout went to clear an old deficit
  paidToOwner: number;      // What actually gets released to the owner
  deficitBefore: number;    // Carry-forward deficit entering this row
  deficitAfter: number;     // Deficit leaving this row (>0 means new hold/carry)
}

// Distill a long error log down to its core failure reason
function extractErrorReason(raw: string): string {
  if (!raw) return "Unknown error — check Notion for details.";
  const text = String(raw).trim();
  // Try to find the first line containing a typical error indicator
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const keywords = /(error|failed|invalid|missing|reject|declined|insufficient|unauthor|forbidden|timeout|not\s*found|unsupported)/i;
  const hit = lines.find((l) => keywords.test(l)) || lines[0] || text;
  // Strip stack-trace prefixes / common noise
  let reason = hit
    .replace(/^.*?(Error|Exception)[: ]\s*/i, "")
    .replace(/\s+at\s+.+$/i, "")
    .replace(/^\W+/, "")
    .trim();
  // Cap at 200 chars
  if (reason.length > 200) reason = reason.slice(0, 200) + "…";
  return reason || text.slice(0, 200);
}

function fmtCurrency(n: number): string {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stopPropagation(ev: { stopPropagation: () => void }): void {
  ev.stopPropagation();
}


export default function PayoutsPage() {
  const { fetchData } = useData();
  const [data, setData] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterPayoutStatus, setFilterPayoutStatus] = useState("");
  const [search, setSearch] = useState("");
  const [errorModal, setErrorModal] = useState<PayoutRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [dismissedBanners, setDismissedBanners] = useState<Record<string, boolean>>({});

  const handleSyncBalances = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/properties/sync-balances", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSyncResult(`Synced ${data.updated} of ${data.total} properties (${data.skipped} skipped).`);
      } else {
        setSyncResult(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setSyncResult(`Sync failed: ${msg}`);
    } finally {
      setSyncing(false);
      // Clear the message after 6 seconds
      setTimeout(() => setSyncResult(null), 6000);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchData("reservations", "/api/reservations"),
      fetchData("expenses", "/api/expenses"),
      fetchData("properties", "/api/properties"),
    ]).then(([resResult, expResult, propResult]: unknown[]) => {
      const resData = resResult as { data?: any[] };
      const expData = expResult as { data?: any[] };
      const propData = propResult as { data?: any[] };
      const allExpenses = expData?.data || [];
      const allProperties = propData?.data || [];

      // Build a set of property names that are flagged Skip Automation
      const skipNames = allProperties
        .filter((p: any) => p.skipAutomation === true)
        .map((p: any) => (p.name || "").trim().toLowerCase())
        .filter(Boolean);

      const isSkipped = (name: string): boolean => {
        const n = (name || "").trim().toLowerCase();
        if (!n) return false;
        return skipNames.some((s: string) => s === n || s.startsWith(n) || n.startsWith(s));
      };

      if (resData.data) {
        // 1. Filter out skip-automation properties at the source
        const eligibleReservations: RawReservation[] = (resData.data as any[]).filter(
          (r: any) => !isSkipped(r.property || "")
        );
        const eligibleExpenses: RawExpense[] = (allExpenses as any[]).filter(
          (e: any) => !isSkipped(e.property || "")
        );

        // 2. Run the carry-forward deficit reconciliation per property
        const { rows: reconciledRows } = reconcileAll(eligibleReservations, eligibleExpenses);

        // 3. Build a map so we can look up the original payout error/status fields
        const originalById = new Map<string, any>();
        for (const r of resData.data as any[]) {
          originalById.set(String(r.id), r);
        }

        // 4. Map reconciled rows into PayoutRow shape, with reconciliation overriding status
        const mapped: PayoutRow[] = reconciledRows.map((rec: ReconciledReservation, i: number) => {
          const original = originalById.get(String(rec.id)) || {};
          const rawStatus = rec.originalPayoutStatus || "Pending";
          // If reconciliation says this row is on hold, override the displayed status,
          // unless the original status is already a terminal error/fail state.
          const effectiveStatus = rec.isOnHold && !/error|fail|paid/i.test(rawStatus)
            ? "On Hold"
            : rawStatus;

          return {
            id: i + 1,
            guest: rec.guest,
            ref: rec.ref,
            property: rec.property,
            channel: original.channel || "Direct",
            checkIn: rec.checkin,
            checkOut: rec.checkout,
            nights: original.nights || 0,
            status: rec.status,
            payoutStatus: effectiveStatus,
            rawPayoutStatus: rawStatus,
            payoutError: original.payoutError || "",
            holdReason: rec.holdReason,
            gross: rec.grossAmount,
            platformFee: rec.platformFee,
            cleaning: rec.cleaning,
            managementFee: rec.managementFee,
            vat: rec.vat,
            expenses: rec.totalExpenses,
            ownerPayout: rec.ownerPayoutRaw,
            appliedToDeficit: rec.appliedToDeficit,
            paidToOwner: rec.paidToOwner,
            deficitBefore: rec.deficitBefore,
            deficitAfter: rec.deficitAfter,
          };
        });
        setData(mapped);
      }

      // Auto-sync all property balances to Notion in the background
      fetch("/api/properties/sync-balances", { method: "POST" }).catch(() => {});
    }).catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propertyOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.property))).filter(Boolean).sort().map((p) => ({ value: p, label: p })),
  [data]);

  const payoutStatusOptions = useMemo(() => {
    // Normalize status values to prevent duplicates like "On Hold" vs "On hold"
    const normalize = (s: string): string => {
      const lower = s.toLowerCase().trim();
      if (lower === "on hold") return "On Hold";
      if (lower === "errored" || lower.includes("error")) return "Errored";
      if (lower === "paid" || lower === "withdrawn") return "Paid";
      if (lower === "pending") return "Pending";
      return s;
    };
    const unique = new Set(data.map((r: PayoutRow) => normalize(r.payoutStatus)));
    return Array.from(unique).filter(Boolean).sort().map((s) => ({ value: s, label: s }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .filter((r) => {
        if (filterProperty && r.property !== filterProperty) return false;
        if (filterPayoutStatus) {
          // Match using case-insensitive comparison so "On Hold" filter catches "On hold" rows
          const filterLower = filterPayoutStatus.toLowerCase();
          const statusLower = r.payoutStatus.toLowerCase();
          if (filterLower === "errored") {
            if (!statusLower.includes("error") && !statusLower.includes("fail")) return false;
          } else if (filterLower !== statusLower) return false;
        }
        if (q && !r.guest.toLowerCase().includes(q) && !r.ref.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a: PayoutRow, b: PayoutRow) => (b.checkOut || "").localeCompare(a.checkOut || "")); // Most recent first
  }, [data, filterProperty, filterPayoutStatus, search]);

  // Summary stats
  const totalPaid = useMemo(() => filtered.filter((r) => r.payoutStatus === "Paid").reduce((s, r) => s + r.paidToOwner, 0), [filtered]);
  const totalPending = useMemo(() => filtered.filter((r) => r.payoutStatus === "Pending").reduce((s, r) => s + r.paidToOwner, 0), [filtered]);
  const totalCleaning = useMemo(() => filtered.reduce((s, r) => s + r.cleaning, 0), [filtered]);
  const totalMgmtFee = useMemo(() => filtered.reduce((s, r) => s + r.managementFee, 0), [filtered]);
  const totalVat = useMemo(() => filtered.reduce((s, r) => s + r.vat, 0), [filtered]);
  const totalPlatformFee = useMemo(() => filtered.reduce((s, r) => s + r.platformFee, 0), [filtered]);
  const overduePending = useMemo(() => filtered.filter((r) => r.payoutStatus === "Pending"), [filtered]);
  const erroredPayouts = useMemo(() => filtered.filter((r) => {
    const s = r.payoutStatus.toLowerCase();
    return s.includes("error") || s.includes("fail");
  }), [filtered]);
  const onHoldPayouts = useMemo(() => filtered.filter((r: PayoutRow) => r.payoutStatus.toLowerCase().includes("hold")), [filtered]);

  // Aggregated reconciliation totals across all visible rows
  const totalAppliedToDeficit = useMemo(
    () => filtered.reduce((s: number, r: PayoutRow) => s + r.appliedToDeficit, 0),
    [filtered]
  );
  // deficitAfter is a running total per property, so summing all rows would
  // double-count. Instead, take the LAST (highest) deficit per property — that's
  // the actual outstanding amount for each property, then sum across properties.
  const totalDeficitOutstanding = useMemo(() => {
    const byProp: Record<string, number> = {};
    for (const r of filtered) {
      if (r.deficitAfter > 0) {
        const key = (r.property || "").toLowerCase();
        // Keep the highest deficit per property (the latest in the chain)
        if (!byProp[key] || r.deficitAfter > byProp[key]) {
          byProp[key] = r.deficitAfter;
        }
      }
    }
    return Object.values(byProp).reduce((s, d) => s + d, 0);
  }, [filtered]);

  if (loading) {
    return (
      <AppShell title="Payouts">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading payout data...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Payouts">
      <MobileTabs tabs={FINANCE_TABS} />
      <div className="flex items-center justify-between gap-3 mb-5 -mt-1 flex-wrap">
        <div className="text-[13px] text-[#888] hidden md:block">Track all payouts, fees and deductions.</div>
        <div className="flex items-center gap-3 ml-auto">
          {syncResult && (
            <span className="text-[11px] text-[#666] bg-[#f5f5f5] border border-[#eaeaea] rounded-lg px-2.5 py-1.5">
              {syncResult}
            </span>
          )}
          <button
            type="button"
            onClick={handleSyncBalances}
            disabled={syncing}
            title="Recalculate every property's balance and write it back to the Notion Properties database"
            className="flex items-center gap-1.5 h-[34px] px-3 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-all disabled:opacity-50 disabled:cursor-wait bg-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {syncing ? "Syncing..." : "Sync balances"}
          </button>
        </div>
      </div>

      {/* Warning: Errored Payouts */}
      {erroredPayouts.length > 0 && !dismissedBanners.errored && (
        <div className="bg-[#F6EDED] border border-[#E8D8D8] rounded-xl p-4 mb-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8D8D8] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5252" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[#7A5252] mb-1">{erroredPayouts.length} failed payout{erroredPayouts.length !== 1 ? "s" : ""}</div>
            <div className="text-[12px] text-[#7A5252]/80">
              These payouts have errors and need attention. Total: {fmtCurrency(erroredPayouts.reduce((s: number, r: PayoutRow) => s + r.ownerPayout, 0))}. Click any errored row below to see the reason.
            </div>
          </div>
          <button onClick={() => setDismissedBanners((p) => ({ ...p, errored: true }))} className="p-1 text-[#7A5252]/50 hover:text-[#7A5252] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Warning: On Hold Payouts */}
      {onHoldPayouts.length > 0 && !dismissedBanners.onhold && (
        <div className="bg-[#FBF1E2] border border-[#E8DDC7] rounded-xl p-4 mb-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F1E3C5] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[#8A6A2E] mb-1">{onHoldPayouts.length} payout{onHoldPayouts.length !== 1 ? "s" : ""} on hold</div>
            <div className="text-[12px] text-[#8A6A2E]/80">
              Outstanding deficit being recovered: {fmtCurrency(totalDeficitOutstanding)}. Future reservation payouts are being applied against it automatically.
            </div>
          </div>
          <button onClick={() => setDismissedBanners((p) => ({ ...p, onhold: true }))} className="p-1 text-[#8A6A2E]/50 hover:text-[#8A6A2E] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Warning: Pending Payouts */}
      {overduePending.length > 0 && !dismissedBanners.pending && (
        <div className="bg-[#F6F1E6] border border-[#E8DDC7] rounded-xl p-4 mb-5 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[#8A6A2E] mb-1">{overduePending.length} pending payout{overduePending.length !== 1 ? "s" : ""}</div>
            <div className="text-[12px] text-[#8A6A2E]/80">
              Completed reservations awaiting payout. Total: {fmtCurrency(overduePending.reduce((s: number, r: PayoutRow) => s + r.ownerPayout, 0))}
            </div>
          </div>
          <button onClick={() => setDismissedBanners((p) => ({ ...p, pending: true }))} className="p-1 text-[#8A6A2E]/50 hover:text-[#8A6A2E] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Owner Payouts</div>
          <div className="text-[18px] font-bold text-[#2F6B57]">{fmtCurrency(totalPaid)}</div>
          <div className="text-[10px] text-[#999]">Paid</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Pending</div>
          <div className="text-[18px] font-bold text-[#D4A843]">{fmtCurrency(totalPending)}</div>
          <div className="text-[10px] text-[#999]">Awaiting</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Platform Fees</div>
          <div className="text-[18px] font-bold text-[#111]">{fmtCurrency(totalPlatformFee)}</div>
          <div className="text-[10px] text-[#999]">Total</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Cleaning</div>
          <div className="text-[18px] font-bold text-[#111]">{fmtCurrency(totalCleaning)}</div>
          <div className="text-[10px] text-[#999]">Total</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Management Fees</div>
          <div className="text-[18px] font-bold text-[#111]">{fmtCurrency(totalMgmtFee)}</div>
          <div className="text-[10px] text-[#999]">Total</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-[#999] uppercase tracking-wider mb-1">Service VAT</div>
          <div className="text-[18px] font-bold text-[#111]">{fmtCurrency(totalVat)}</div>
          <div className="text-[10px] text-[#999]">19%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="All Properties" options={propertyOptions} searchable />
        <FilterDropdown value={filterPayoutStatus} onChange={setFilterPayoutStatus} placeholder="All Statuses" options={payoutStatusOptions} />
        <div className="relative ml-auto">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest or ref..."
            className="h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white min-w-[180px]" />
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] min-w-[1180px]">
            <thead>
              <tr className="bg-[#fafafa]">
                {["Status", "Guest / Ref", "Property", "Gross", "Platform Fee", "Cleaning", "Mgmt Fee", "VAT 19%", "Expenses", "Owner Payout", "Applied", "Paid Out", "Deficit", "Pay By"].map((h) => (
                  <th key={h} className="text-left px-3.5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#999] border-b border-[#eaeaea] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-10 text-[#999]">No payouts match your filters.</td></tr>
              ) : filtered.map((r) => {
                const statusLower = r.payoutStatus.toLowerCase();
                const isErrored = statusLower.includes("error") || statusLower.includes("fail");
                const isOnHold = statusLower.includes("hold");
                const isClickable = isErrored || isOnHold;
                // Pay by = checkout + 3 days
                const payByDate = r.checkOut ? (() => {
                  const d = new Date(r.checkOut + "T00:00:00");
                  d.setDate(d.getDate() + 3);
                  return d;
                })() : null;
                const payByStr = payByDate ? payByDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdueDate = payByDate && r.payoutStatus === "Pending" && payByDate < today;
                return (
                  <tr
                    key={r.id}
                    onClick={() => { if (isClickable) setErrorModal(r); }}
                    className={`border-b border-[#f3f3f3] hover:bg-[#f9f9f9] ${isErrored ? "bg-[#F6EDED]/30 cursor-pointer" : isOnHold ? "bg-[#FBF1E2]/40 cursor-pointer" : isOverdueDate ? "bg-[#F6F1E6]/30" : ""}`}
                  >
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`pill pill-${r.payoutStatus.toLowerCase().replace(/\s+/g, "-")}`}>{r.payoutStatus}</span>
                        {isErrored && (
                          <button
                            type="button"
                            onClick={(ev) => { stopPropagation(ev); setErrorModal(r); }}
                            title="View error reason"
                            className="w-5 h-5 rounded-full bg-[#F6EDED] border border-[#E8D8D8] flex items-center justify-center flex-shrink-0 hover:bg-[#EFD8D8] transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B7484F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="8" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-medium text-[#111]">{r.guest}</div>
                      {r.ref && <div className="text-[10px] text-[#999] mt-0.5">{r.ref}</div>}
                    </td>
                    <td className="px-3.5 py-3 text-[#666] text-[12px]">{r.property}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#111]">{fmtCurrency(r.gross)}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(r.platformFee)}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(r.cleaning)}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(r.managementFee)}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(r.vat)}</td>
                    <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">{r.expenses > 0 ? `-${fmtCurrency(r.expenses)}` : "—"}</td>
                    <td className={`px-3.5 py-3 tabular-nums font-semibold ${r.ownerPayout < 0 ? "text-[#B7484F]" : "text-[#111]"}`}>
                      {r.ownerPayout < 0 ? `−${fmtCurrency(Math.abs(r.ownerPayout))}` : fmtCurrency(r.ownerPayout)}
                    </td>
                    <td className="px-3.5 py-3 tabular-nums text-[#8A6A2E]" title="Amount applied to clear a prior carry-forward deficit">
                      {r.appliedToDeficit > 0 ? `-${fmtCurrency(r.appliedToDeficit)}` : "—"}
                    </td>
                    <td className="px-3.5 py-3 tabular-nums font-bold" title="Amount actually released to the owner after deficit recovery">
                      {r.paidToOwner > 0 ? (
                        <span className="text-[#2F6B57]">{fmtCurrency(r.paidToOwner)}</span>
                      ) : (
                        <span className="text-[#bbb]">€0.00</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 tabular-nums" title="Carry-forward deficit remaining after this reservation">
                      {r.deficitAfter > 0 ? (
                        <span className="text-[#B7484F] font-semibold">-{fmtCurrency(r.deficitAfter)}</span>
                      ) : (
                        <span className="text-[#bbb]">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {r.payoutStatus === "Paid" || r.payoutStatus === "Withdrawn" ? (
                        <span className="text-[#2F6B57] text-[12px] font-medium">Paid</span>
                      ) : isOverdueDate ? (
                        <span className="text-[#FF5A5F] text-[12px] font-semibold">{payByStr} (overdue)</span>
                      ) : (
                        <span className="text-[#666] text-[12px]">{payByStr}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[#fafafa] font-semibold">
                  <td colSpan={3} className="px-3.5 py-3 text-[12px] text-[#999] uppercase">Totals</td>
                  <td className="px-3.5 py-3 tabular-nums">{fmtCurrency(filtered.reduce((s, r) => s + r.gross, 0))}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(totalPlatformFee)}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(totalCleaning)}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(totalMgmtFee)}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">-{fmtCurrency(totalVat)}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#7A5252]">{filtered.reduce((s, r) => s + r.expenses, 0) > 0 ? `-${fmtCurrency(filtered.reduce((s, r) => s + r.expenses, 0))}` : "—"}</td>
                  {(() => { const t = filtered.reduce((s: number, r: PayoutRow) => s + r.ownerPayout, 0); return <td className={`px-3.5 py-3 tabular-nums ${t < 0 ? "text-[#B7484F]" : ""}`}>{t < 0 ? `−${fmtCurrency(Math.abs(t))}` : fmtCurrency(t)}</td>; })()}
                  <td className="px-3.5 py-3 tabular-nums text-[#8A6A2E]">{totalAppliedToDeficit > 0 ? `-${fmtCurrency(totalAppliedToDeficit)}` : "—"}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#2F6B57] font-bold">{fmtCurrency(filtered.reduce((s: number, r: PayoutRow) => s + r.paidToOwner, 0))}</td>
                  <td className="px-3.5 py-3 tabular-nums text-[#B7484F]">{totalDeficitOutstanding > 0 ? `-${fmtCurrency(totalDeficitOutstanding)}` : "—"}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Error / On-hold detail modal */}
      {errorModal && (() => {
        const modalIsOnHold = errorModal.payoutStatus.toLowerCase().includes("hold");
        const headerBg = modalIsOnHold ? "#FBF1E2" : "#F6EDED";
        const headerBorder = modalIsOnHold ? "#E8DDC7" : "#E8D8D8";
        const headerStroke = modalIsOnHold ? "#8A6A2E" : "#B7484F";
        const headerTitle = modalIsOnHold ? "Payout on hold" : "Payout failed";
        const reasonLabel = modalIsOnHold ? "Hold reason" : "Reason";
        return (
        <div
          onClick={() => setErrorModal(null)}
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
        >
          <div
            onClick={stopPropagation}
            className="bg-white rounded-2xl border border-[#eaeaea] shadow-xl w-full max-w-[480px] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: headerBg, borderWidth: 1, borderStyle: "solid", borderColor: headerBorder }}>
                {modalIsOnHold ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={headerStroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="5" width="4" height="14" rx="1"/>
                    <rect x="14" y="5" width="4" height="14" rx="1"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={headerStroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[#111]">{headerTitle}</div>
                <div className="text-[12px] text-[#888] truncate">{errorModal.guest} · {errorModal.property}</div>
              </div>
              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="text-[#bbb] hover:text-[#666] flex-shrink-0"
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">{reasonLabel}</div>
                <div className="text-[13px] text-[#111] leading-relaxed">
                  {modalIsOnHold && errorModal.holdReason
                    ? errorModal.holdReason
                    : extractErrorReason(errorModal.payoutError)}
                </div>
              </div>

              {/* Carry-forward deficit breakdown — only show for on-hold rows or rows with deficit activity */}
              {(modalIsOnHold || errorModal.appliedToDeficit > 0 || errorModal.deficitAfter > 0) && (
                <div className="pt-3 border-t border-[#f0f0f0]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-2">Reconciliation breakdown</div>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-[#666]">Owner payout (raw)</span>
                      <span className="tabular-nums text-[#111] font-medium">{fmtCurrency(errorModal.ownerPayout)}</span>
                    </div>
                    {errorModal.expenses > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#666]">Expenses applied</span>
                        <span className="tabular-nums text-[#7A5252]">-{fmtCurrency(errorModal.expenses)}</span>
                      </div>
                    )}
                    {errorModal.deficitBefore > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#666]">Carry-forward deficit (in)</span>
                        <span className="tabular-nums text-[#B7484F]">-{fmtCurrency(errorModal.deficitBefore)}</span>
                      </div>
                    )}
                    {errorModal.appliedToDeficit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#666]">Applied to clear deficit</span>
                        <span className="tabular-nums text-[#8A6A2E]">{fmtCurrency(errorModal.appliedToDeficit)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-[#f3f3f3]">
                      <span className="text-[#111] font-semibold">Paid to owner</span>
                      <span className="tabular-nums font-bold text-[#2F6B57]">{fmtCurrency(errorModal.paidToOwner)}</span>
                    </div>
                    {errorModal.deficitAfter > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#111] font-semibold">New carry-forward deficit</span>
                        <span className="tabular-nums font-bold text-[#B7484F]">-{fmtCurrency(errorModal.deficitAfter)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#f0f0f0]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Reference</div>
                  <div className="text-[12px] text-[#333] truncate">{errorModal.ref || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Property</div>
                  <div className="text-[12px] text-[#333] truncate">{errorModal.property || "—"}</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] flex justify-end">
              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="h-[36px] px-4 rounded-lg text-[12px] font-semibold text-white bg-[#80020E] hover:bg-[#6b010c] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </AppShell>
  );
}
