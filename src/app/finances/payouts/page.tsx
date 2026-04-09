"use client";

import { useState, useEffect, useMemo } from "react";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import { useData } from "@/lib/DataContext";

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
  payoutStatus: string;
  gross: number;
  platformFee: number;
  cleaning: number;
  managementFee: number;
  vat: number;
  expenses: number;
  ownerPayout: number;
}

function fmtCurrency(n: number): string {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export default function PayoutsPage() {
  const { fetchData } = useData();
  const [data, setData] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterPayoutStatus, setFilterPayoutStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData("reservations", "/api/reservations")
      .then((res: unknown) => {
        const d = res as { data?: any[] };
        if (d.data) {
          const mapped: PayoutRow[] = d.data.map((r: any, i: number) => ({
            id: i + 1,
            guest: r.guest || "",
            ref: r.ref || "",
            property: (r.property || "").trim(),
            channel: r.channel || "Direct",
            checkIn: (r.checkin || "").split("T")[0],
            checkOut: (r.checkout || "").split("T")[0],
            nights: r.nights || 0,
            status: r.status || "Pending",
            payoutStatus: r.status === "Cancelled" ? "Cancelled" : (r.payoutStatus || "Pending"),
            gross: r.grossAmount || 0,
            platformFee: r.platformFee || 0,
            cleaning: r.cleaning || 0,
            managementFee: r.managementFee || 0,
            vat: (r.managementFee || 0) * 0.19,
            expenses: r.expenses || 0,
            ownerPayout: r.ownerPayout || 0,
          }));
          setData(mapped);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propertyOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.property))).filter(Boolean).sort().map((p) => ({ value: p, label: p })),
  [data]);

  const payoutStatusOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.payoutStatus))).filter(Boolean).sort().map((s) => ({ value: s, label: s })),
  [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((r) => {
      if (filterProperty && r.property !== filterProperty) return false;
      if (filterPayoutStatus && r.payoutStatus !== filterPayoutStatus) return false;
      if (q && !r.guest.toLowerCase().includes(q) && !r.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filterProperty, filterPayoutStatus, search]);

  // Summary stats
  const totalPaid = useMemo(() => filtered.filter((r) => r.payoutStatus === "Paid").reduce((s, r) => s + r.ownerPayout, 0), [filtered]);
  const totalPending = useMemo(() => filtered.filter((r) => r.payoutStatus === "Pending").reduce((s, r) => s + r.ownerPayout, 0), [filtered]);
  const totalCleaning = useMemo(() => filtered.reduce((s, r) => s + r.cleaning, 0), [filtered]);
  const totalMgmtFee = useMemo(() => filtered.reduce((s, r) => s + r.managementFee, 0), [filtered]);
  const totalVat = useMemo(() => filtered.reduce((s, r) => s + r.vat, 0), [filtered]);
  const totalPlatformFee = useMemo(() => filtered.reduce((s, r) => s + r.platformFee, 0), [filtered]);
  const failedPayouts = useMemo(() => filtered.filter((r) => r.payoutStatus === "Pending" && r.status === "Completed"), [filtered]);

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
      <div className="text-[13px] text-[#888] mb-5 -mt-1 hidden md:block">Track all payouts, fees and deductions.</div>

      {/* Warning: Failed/Overdue Payouts */}
      {failedPayouts.length > 0 && (
        <div className="bg-[#F6EDED] border border-[#E8D8D8] rounded-xl p-4 mb-5 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A5252" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <div className="text-[13px] font-semibold text-[#7A5252] mb-1">{failedPayouts.length} overdue payout{failedPayouts.length !== 1 ? "s" : ""}</div>
            <div className="text-[12px] text-[#7A5252]/80">
              These reservations are completed but payouts are still pending. Total: {fmtCurrency(failedPayouts.reduce((s, r) => s + r.ownerPayout, 0))}
            </div>
          </div>
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
          <table className="w-full border-collapse text-[13px] min-w-[900px]">
            <thead>
              <tr className="bg-[#fafafa]">
                {["Status", "Guest / Ref", "Property", "Gross", "Platform Fee", "Cleaning", "Mgmt Fee", "VAT 19%", "Expenses", "Owner Payout"].map((h) => (
                  <th key={h} className="text-left px-3.5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#999] border-b border-[#eaeaea] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-[#999]">No payouts match your filters.</td></tr>
              ) : filtered.map((r) => {
                const isOverdue = r.payoutStatus === "Pending" && r.status === "Completed";
                return (
                  <tr key={r.id} className={`border-b border-[#f3f3f3] hover:bg-[#f9f9f9] ${isOverdue ? "bg-[#F6EDED]/30" : ""}`}>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`pill pill-${r.payoutStatus.toLowerCase().replace(/\s+/g, "-")}`}>{r.payoutStatus}</span>
                        {isOverdue && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5A5F" strokeWidth="2" className="flex-shrink-0">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
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
                    <td className="px-3.5 py-3 tabular-nums font-semibold text-[#111]">{fmtCurrency(r.ownerPayout)}</td>
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
                  <td className="px-3.5 py-3 tabular-nums text-[#2F6B57] font-bold">{fmtCurrency(filtered.reduce((s, r) => s + r.ownerPayout, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </AppShell>
  );
}
