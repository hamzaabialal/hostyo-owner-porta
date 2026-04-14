"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import DateRangePicker from "@/components/DateRangePicker";
import ChannelBadge, { getChannelIcon, normalizeChannel } from "@/components/ChannelBadge";
import ExportModal from "@/components/ExportModal";
import { useData } from "@/lib/DataContext";
import { reconcileAll, type RawReservation, type RawExpense } from "@/lib/reconcile";

const FINANCE_TABS = [
  { label: "Overview", href: "/finances", exact: true },
  { label: "Earnings", href: "/finances/earnings" },
  { label: "Expenses", href: "/finances/expenses" },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface EarningRow {
  id: number;
  date: string;
  property: string;
  guest: string;
  ref: string;
  channel: string;
  stayDates: string;
  gross: number;
  platformFee: number;
  hostyoFee: number;
  vat: number;
  cleaning: number;
  expenses: number;
  net: number;
  payoutStatus: string;
  payoutDate: string;
  checkoutDate: string;
  deficitAdjustment: number;
  deficitSource: string;
  adjustedPayout: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  const str = "€" + abs.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? "-" + str : str;
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function expectedByDate(checkout: string): string {
  if (!checkout) return "";
  const dt = new Date(checkout + "T00:00:00");
  dt.setDate(dt.getDate() + 7);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusPillFinance(s: string): string {
  const key = s.toLowerCase().replace(/\s+/g, "-");
  return "pill pill-" + key;
}

/* ------------------------------------------------------------------ */
/*  CSV Export                                                         */
/* ------------------------------------------------------------------ */
function exportCSV(rows: EarningRow[], filename: string) {
  const headers = ["Date", "Property", "Guest", "Reference", "Channel", "Stay Dates", "Gross", "Platform Fee", "Management Fee", "Service VAT", "Cleaning", "Expenses", "Net Payout", "Payout Status"];
  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push([
      r.date, `"${r.property}"`, `"${r.guest}"`, r.ref, r.channel, `"${r.stayDates}"`,
      r.gross.toFixed(2), r.platformFee.toFixed(2), r.hostyoFee.toFixed(2), r.vat.toFixed(2),
      r.cleaning.toFixed(2), r.expenses.toFixed(2), r.net.toFixed(2), r.payoutStatus,
    ].join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */
function EarningDrawer({ row, onClose }: { row: EarningRow; onClose: () => void }) {
  const [linkedExpensesTotal, setLinkedExpensesTotal] = useState(0);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deficitExpenses, setDeficitExpenses] = useState<any[]>([]);

  // Fetch linked expenses for this reservation
  useEffect(() => {
    if (!row.ref) return;
    fetch("/api/expenses")
      .then((r) => r.json())
      .then((data) => {
        const all = data?.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linked = all.filter((e: any) => e.reservation && row.ref && e.reservation.includes(row.ref.slice(0, 10)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const total = linked.reduce((s: number, e: any) => s + (e.amount || 0), 0);
        setLinkedExpensesTotal(total);

        // Build tooltip: find the expenses that caused the deficit.
        // First try matching by reservation refs in the deficit source.
        // If none found (property-level expenses), find all paid/approved
        // expenses for the same property that aren't linked to this reservation.
        if (row.deficitAdjustment !== 0) {
          const entries: { name: string; amount: number }[] = [];

          // Try reservation-ref lookup first
          if (row.deficitSource) {
            const src = row.deficitSource.replace(/^Deficit recovery from:\s*/i, "");
            const refMatches = src.match(/\d-\d{9,}/g) || [];
            for (const ref of refMatches) {
              const refKey = ref.slice(0, 10).toLowerCase();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const matched = all.filter((e: any) =>
                e.reservation && e.reservation.toLowerCase().includes(refKey)
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const e of matched) {
                entries.push({ name: e.vendor || e.category || "Expense", amount: e.amount || 0 });
              }
            }
          }

          // Fallback: if no expenses found by ref, find property-level expenses
          if (entries.length === 0 && row.property) {
            const propLower = row.property.toLowerCase();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const propExpenses = all.filter((e: any) => {
              if (!e.property) return false;
              const eProp = e.property.toLowerCase();
              if (!(eProp === propLower || eProp.startsWith(propLower) || propLower.startsWith(eProp))) return false;
              const status = (e.status || "").toLowerCase();
              if (status !== "paid" && status !== "approved") return false;
              // Exclude expenses linked to THIS reservation
              if (e.reservation && row.ref && e.reservation.includes(row.ref.slice(0, 10))) return false;
              return true;
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const e of propExpenses) {
              entries.push({ name: e.vendor || e.category || "Expense", amount: e.amount || 0 });
            }
          }

          setDeficitExpenses(entries);
        }
      })
      .catch(() => {});
  }, [row.ref, row.deficitSource]);

  const expensesAmount = linkedExpensesTotal > 0 ? linkedExpensesTotal : Math.abs(row.expenses || 0);
  const adjustedPayout = row.adjustedPayout > 0 ? row.adjustedPayout : (row.deficitAdjustment !== 0 ? row.net + row.deficitAdjustment : row.net);

  function InfoItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0">
        <span className="text-[12px] text-[#999]">{label}</span>
        <span className={`text-[13px] font-medium ${accent ? "text-accent" : "text-[#111]"}`}>{value}</span>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[101] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div className="text-[15px] font-semibold text-[#111]">Earning Detail</div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Reservation</div>
            <InfoItem label="Property" value={row.property} />
            {row.ref && <InfoItem label="Reference" value={row.ref} />}
            <InfoItem label="Guest" value={row.guest} />
            <InfoItem label="Stay dates" value={row.stayDates} />
            <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
              <span className="text-[12px] text-[#999]">Channel</span>
              <ChannelBadge channel={row.channel} />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Breakdown</div>
            <InfoItem label="Gross booking" value={fmtCurrency(row.gross)} />
            {row.platformFee !== 0 && <InfoItem label="Platform commission" value={fmtCurrency(row.platformFee)} />}
            {row.cleaning !== 0 && <InfoItem label="Cleaning" value={fmtCurrency(row.cleaning)} />}
            {row.hostyoFee !== 0 && <InfoItem label="Management fee" value={fmtCurrency(row.hostyoFee)} />}
            {row.vat !== 0 && <InfoItem label="VAT 19%" value={fmtCurrency(row.vat)} />}
            {expensesAmount > 0 && <InfoItem label="Expenses" value={fmtCurrency(-expensesAmount)} />}
            {row.deficitAdjustment !== 0 && (
              <div className="relative">
                <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
                  <span className="text-[12px] text-[#999] flex items-center gap-1">
                    Adjustment
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAdjustmentOpen(!adjustmentOpen); }}
                      className="w-[14px] h-[14px] rounded-full border border-[#ccc] flex items-center justify-center text-[#999] hover:text-[#666] hover:border-[#999] transition-colors"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>
                    </button>
                  </span>
                  <span className="text-[13px] font-medium text-[#D4A843]">{fmtCurrency(row.deficitAdjustment)}</span>
                </div>
                {adjustmentOpen && deficitExpenses.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#e2e2e2] rounded-lg shadow-lg z-10 py-1.5 min-w-[200px]">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {deficitExpenses.map((exp: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                        <span className="text-[#555]">{exp.name}</span>
                        <span className="text-[#111] font-medium tabular-nums ml-3">{fmtCurrency(-(exp.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Payout</div>
            <InfoItem label="Owner payout" value={fmtCurrency(adjustedPayout)} accent />
            <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
              <span className="text-[12px] text-[#999]">Payout status</span>
              <span className={statusPillFinance(row.payoutStatus)}>{row.payoutStatus}</span>
            </div>
            {row.checkoutDate && <InfoItem label="Expected by" value={expectedByDate(row.checkoutDate)} />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function FinancesEarningsPage() {
  const { fetchData } = useData();
  const [data, setData] = useState<EarningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterPayoutStatus, setFilterPayoutStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRow, setSelectedRow] = useState<EarningRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchData("reservations", "/api/reservations"),
      fetchData("expenses", "/api/expenses"),
    ]).then(([resResult, expResult]: unknown[]) => {
        const d = resResult as { data?: Record<string, unknown>[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expData = expResult as { data?: RawExpense[] };
        if (d.data) {
          // Run reconciliation to compute adjusted payouts client-side
          const allExpenses: RawExpense[] = (expData?.data || []) as RawExpense[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawReservations: RawReservation[] = (d.data as Record<string, unknown>[]).map((r: any) => ({
            id: r.notionId || r.id,
            ref: r.ref || "",
            property: r.property || "",
            guest: r.guest || "",
            checkin: r.checkin || "",
            checkout: r.checkout || "",
            status: r.status || "Pending",
            payoutStatus: r.payoutStatus || "Pending",
            grossAmount: r.grossAmount || 0,
            platformFee: r.platformFee || 0,
            managementFee: r.managementFee || 0,
            cleaning: r.cleaning || 0,
            expenses: r.expenses || 0,
            ownerPayout: r.ownerPayout || 0,
          }));
          const { rows: reconciledRows } = reconcileAll(rawReservations, allExpenses);

          // Build a lookup from reconciliation by reservation id
          const reconById = new Map<string, (typeof reconciledRows)[0]>();
          for (const rec of reconciledRows) {
            reconById.set(String(rec.id), rec);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: EarningRow[] = (d.data as any[]).map((r: any, i: number) => {
            const recon = reconById.get(String(r.notionId || r.id));
            const reconPaidToOwner = recon ? recon.paidToOwner : null;
            const reconApplied = recon ? recon.appliedToDeficit : 0;

            return {
              id: i + 1,
              date: (r.checkout || r.checkin || "").split("T")[0],
              property: r.property || "",
              guest: r.guest || "",
              ref: r.ref || "",
              channel: r.channel || "Direct",
              stayDates: `${fmtDateShort(r.checkin)} – ${fmtDateShort(r.checkout)}`,
              gross: r.grossAmount || 0,
              platformFee: -(r.platformFee || 0),
              hostyoFee: -(r.managementFee || 0),
              vat: -((r.managementFee || 0) * 0.19),
              cleaning: -(r.cleaning || 0),
              expenses: -(r.expenses || 0),
              net: r.ownerPayout || 0,
              payoutStatus: (() => {
                const raw = r.payoutStatus || "Pending";
                if (raw !== "Pending") return raw;
                if (recon?.isOnHold) return "On Hold";
                if ((r.ownerPayout || 0) < 0) return "On Hold";
                if (reconApplied > 0 && reconPaidToOwner === 0) return "On Hold";
                return raw;
              })(),
              payoutDate: r.checkout || "",
              checkoutDate: (r.checkout || "").split("T")[0],
              deficitAdjustment: reconApplied > 0 ? -reconApplied : (r.deficitAdjustment || 0),
              deficitSource: r.deficitSource || (recon?.holdReason || ""),
              adjustedPayout: reconPaidToOwner !== null ? reconPaidToOwner : (r.adjustedPayout || 0),
            };
          });
          setData(mapped);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propertyOptions = useMemo(() => {
    const names = Array.from(new Set(data.map((r) => r.property))).filter(Boolean).sort();
    return names.map((p) => ({ value: p, label: p }));
  }, [data]);

  const payoutStatusOptions = useMemo(() => {
    const statuses = Array.from(new Set(data.map((r) => r.payoutStatus))).filter(Boolean).sort();
    return statuses.map((s) => ({ value: s, label: s }));
  }, [data]);

  const channelOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.channel))).filter(Boolean).sort().map((c) => ({
      value: c,
      label: normalizeChannel(c) === "Direct" ? "Hostyo" : normalizeChannel(c),
      icon: getChannelIcon(c),
    })),
  [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((r) => {
      if (filterProperty && r.property !== filterProperty) return false;
      if (filterPayoutStatus && r.payoutStatus !== filterPayoutStatus) return false;
      if (filterChannel && r.channel !== filterChannel) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (q && !r.guest.toLowerCase().includes(q) && !r.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filterProperty, filterPayoutStatus, filterChannel, search, dateFrom, dateTo]);

  const closeDrawer = useCallback(() => {
    setSelectedRow(null);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") closeDrawer(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeDrawer]);

  if (loading) {
    return (
      <AppShell title="Earnings">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading earnings...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Earnings">
      <MobileTabs tabs={FINANCE_TABS} />
      <div className="text-[13px] text-[#888] mb-6 -mt-1 hidden md:block">Detailed income from completed reservations and owner payouts.</div>

      {/* Mobile Filters */}
      <div className="flex items-center gap-2 mb-4 md:hidden flex-wrap">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="Properties" options={propertyOptions} searchable />
        <FilterDropdown value={filterPayoutStatus} onChange={setFilterPayoutStatus} placeholder="Status" options={payoutStatusOptions} />
        <button onClick={() => setExportOpen(true)}
          className="ml-auto p-2 rounded-lg border border-[#e2e2e2] text-[#555] hover:border-[#80020E] hover:text-[#80020E] hover:bg-[#80020E]/5 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
      {/* Desktop Filters */}
      <div className="hidden md:flex items-center gap-3 mb-6">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="All Properties" options={propertyOptions} searchable />
        <FilterDropdown value={filterPayoutStatus} onChange={setFilterPayoutStatus} placeholder="All Statuses" options={payoutStatusOptions} />
        <FilterDropdown value={filterChannel} onChange={setFilterChannel} placeholder="All Channels" options={channelOptions} />
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Search guest or ref..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white min-w-[180px]" />
          </div>
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] hover:bg-[#80020E]/5 transition-all flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* Mobile Card List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="text-[16px] font-semibold text-[#111] mb-2">No earnings yet</div>
          <div className="text-[13px] text-[#888] max-w-[340px] leading-relaxed">
            Earnings will appear here once completed reservations begin generating owner payouts.
          </div>
        </div>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.map((r) => {
            const deductions = r.platformFee + r.hostyoFee + r.cleaning + r.expenses;
            return (
              <div key={r.id} onClick={() => { setSelectedRow(r); document.body.style.overflow = "hidden"; }}
                className="bg-white border border-[#eaeaea] rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className={statusPillFinance(r.payoutStatus)}>{r.payoutStatus}</span>
                  <ChannelBadge channel={r.channel} compact />
                </div>
                <div className="text-[15px] font-semibold text-[#111] mb-0.5">{r.guest}</div>
                <div className="text-[12px] text-[#888] mb-2 truncate">{r.property}</div>
                <div className="text-[12px] text-[#666] mb-2">{fmtDate(r.date)} · {r.stayDates}</div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#999]">Gross </span>
                    <span className="text-[13px] font-medium text-[#111]">{fmtCurrency(r.gross)}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#999]">Deductions </span>
                    <span className="text-[13px] font-medium text-[#999]">{fmtCurrency(deductions)}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#999]">Net </span>
                    <span className="text-[13px] font-semibold text-accent">{fmtCurrency(r.adjustedPayout > 0 ? r.adjustedPayout : (r.deficitAdjustment !== 0 ? r.net + r.deficitAdjustment : r.net))}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafafa]">
                  {["Status", "Guest / Ref", "Channel", "Gross", "Deductions", "Payout", "Expected by"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#eaeaea]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const deductions = r.platformFee + r.hostyoFee + r.vat + r.cleaning + r.expenses;
                  const expectedBy = r.checkoutDate ? expectedByDate(r.checkoutDate) : fmtDate(r.payoutDate);
                  return (
                    <tr key={r.id} onClick={() => { setSelectedRow(r); document.body.style.overflow = "hidden"; }}
                      className="border-b border-[#f3f3f3] last:border-b-0 hover:bg-[#fafafa] cursor-pointer transition-colors">
                      <td className="px-4 py-3.5"><span className={statusPillFinance(r.payoutStatus)}>{r.payoutStatus}</span></td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#111]">{r.guest}</div>
                        {r.ref && <div className="text-[11px] text-[#999] mt-0.5">{r.ref}</div>}
                      </td>
                      <td className="px-4 py-3.5"><ChannelBadge channel={r.channel} /></td>
                      <td className="px-4 py-3.5 text-[#111] tabular-nums whitespace-nowrap">{fmtCurrency(r.gross)}</td>
                      <td className="px-4 py-3.5 text-[#666] tabular-nums whitespace-nowrap">{fmtCurrency(deductions)}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#111] tabular-nums whitespace-nowrap">{fmtCurrency(r.adjustedPayout > 0 ? r.adjustedPayout : (r.deficitAdjustment !== 0 ? r.net + r.deficitAdjustment : r.net))}</td>
                      <td className="px-4 py-3.5 text-[#666] whitespace-nowrap">{expectedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {selectedRow && <EarningDrawer row={selectedRow} onClose={closeDrawer} />}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        recordCount={filtered.length}
        filters={[
          ...(filterProperty ? [{ label: filterProperty }] : [{ label: "All properties" }]),
          ...(filterPayoutStatus ? [{ label: filterPayoutStatus }] : [{ label: "All statuses" }]),
          ...(dateFrom && dateTo ? [{ label: `${dateFrom} – ${dateTo}` }] : []),
        ]}
        onExport={(format, options) => {
          const fmt = (n: number) => options.currency ? `€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : n.toFixed(2);
          if (format === "csv") {
            exportCSV(filtered, `earnings-${new Date().toISOString().slice(0, 10)}.csv`);
          } else {
            // PDF: open printable HTML
            const headerRow = options.headers ? `<tr>${["Date","Property","Guest","Ref","Channel","Gross","Deductions","Net Payout","Status"].map(h => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;font-size:11px;color:#666">${h}</th>`).join("")}</tr>` : "";
            const bodyRows = filtered.map(r => {
              const ded = r.platformFee + r.hostyoFee + r.vat + r.cleaning + r.expenses;
              return `<tr>${[r.date, r.property, r.guest, r.ref, r.channel, fmt(r.gross), fmt(ded), fmt(r.net), r.payoutStatus].map(v => `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">${v}</td>`).join("")}</tr>`;
            }).join("");
            const html = `<!DOCTYPE html><html><head><title>Earnings Report</title><style>body{font-family:-apple-system,sans-serif;padding:40px 48px;color:#111;max-width:1000px;margin:0 auto}table{width:100%;border-collapse:collapse}@media print{body{padding:20px}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #eee"><div><img src="/hostyo-logo.png" alt="HOSTYO" style="height:32px;margin-bottom:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><div style="display:none;font-size:13px;font-weight:700;color:#80020E">HOSTYO</div><div style="font-size:10px;color:#555;line-height:1.6;margin-top:6px">HOSTYO LTD<br>+35777788280<br>billing@hostyo.com<br>VAT No: 60253322Q<br>20 Dimotikis Agoras, Larnaca, Cyprus, 6021</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:700">Earnings Report</div><div style="font-size:11px;color:#999;margin-top:4px">Generated ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · ${filtered.length} records</div></div></div><table>${headerRow}${bodyRows}</table></body></html>`;
            const w = window.open("", "_blank");
            if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
          }
        }}
      />
    </AppShell>
  );
}
