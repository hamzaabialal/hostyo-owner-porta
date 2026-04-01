"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import DateRangePicker from "@/components/DateRangePicker";
import ChannelBadge, { getChannelIcon, normalizeChannel } from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";

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
  cleaning: number;
  expenses: number;
  net: number;
  payoutStatus: string;
  payoutDate: string;
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

function statusPillFinance(s: string): string {
  const map: Record<string, string> = {
    Paid: "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#2F6B57] bg-[#EAF3EF] border-[#D6E7DE]",
    Pending: "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#8A6A2E] bg-[#F6F1E6] border-[#E8DDC7]",
    Upcoming: "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#5E6673] bg-[#EEF1F5] border-[#DDE3EA]",
    "On Hold": "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#8A5A2E] bg-[#F7EEE6] border-[#E9D9C7]",
  };
  return map[s] || "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#555] bg-[#f5f5f5] border-[#e5e5e5]";
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */
function EarningDrawer({ row, onClose }: { row: EarningRow; onClose: () => void }) {
  function InfoItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0">
        <span className="text-[12px] text-[#999]">{label}</span>
        <span className={`text-[13px] font-medium ${accent ? "text-accent" : "text-[#111]"}`}>{value}</span>
      </div>
    );
  }

  const deductions = row.platformFee + row.hostyoFee + row.cleaning + row.expenses;

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
            {row.hostyoFee !== 0 && <InfoItem label="Management fee" value={fmtCurrency(row.hostyoFee)} />}
            {row.cleaning !== 0 && <InfoItem label="Cleaning" value={fmtCurrency(row.cleaning)} />}
            {row.expenses !== 0 && <InfoItem label="Linked expenses" value={fmtCurrency(row.expenses)} />}
            <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
              <span className="text-[12px] text-[#999]">Total deductions</span>
              <span className="text-[13px] font-medium text-[#7A5252]">{fmtCurrency(deductions)}</span>
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Payout</div>
            <InfoItem label="Net owner payout" value={fmtCurrency(row.net)} accent />
            <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
              <span className="text-[12px] text-[#999]">Payout status</span>
              <span className={statusPillFinance(row.payoutStatus)}>{row.payoutStatus}</span>
            </div>
            {row.payoutDate && <InfoItem label="Date" value={row.payoutDate} />}
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

  useEffect(() => {
    fetchData("reservations", "/api/reservations")
      .then((res: unknown) => {
        const d = res as { data?: Record<string, unknown>[] };
        if (d.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: EarningRow[] = d.data.map((r: any, i: number) => ({
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
            cleaning: -(r.cleaning || 0),
            expenses: -(r.expenses || 0),
            net: r.ownerPayout || 0,
            payoutStatus: r.payoutStatus || "Pending",
            payoutDate: r.checkout || "",
          }));
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
      </div>
      {/* Desktop Filters */}
      <div className="hidden md:flex items-center gap-3 mb-6 flex-wrap">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="All Properties" options={propertyOptions} searchable />
        <FilterDropdown value={filterPayoutStatus} onChange={setFilterPayoutStatus} placeholder="All Statuses" options={payoutStatusOptions} />
        <FilterDropdown value={filterChannel} onChange={setFilterChannel} placeholder="All Channels" options={channelOptions} />
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <div className="relative ml-auto">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search guest or ref..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white min-w-[220px]" />
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
                    <span className="text-[13px] font-semibold text-accent">{fmtCurrency(r.net)}</span>
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
                  {["Date", "Property", "Guest / Ref", "Channel", "Gross", "Deductions", "Net Payout", "Status", "Payout Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#eaeaea]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const deductions = r.platformFee + r.hostyoFee + r.cleaning + r.expenses;
                  return (
                    <tr key={r.id} onClick={() => { setSelectedRow(r); document.body.style.overflow = "hidden"; }}
                      className="border-b border-[#f3f3f3] last:border-b-0 hover:bg-[#fafafa] cursor-pointer transition-colors">
                      <td className="px-4 py-3.5 text-[#777] whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3.5 font-medium text-[#111] whitespace-nowrap">{r.property}</td>
                      <td className="px-4 py-3.5">
                        <div className="text-[#111]">{r.guest}</div>
                        {r.ref && <div className="text-[11px] text-[#aaa]">{r.ref}</div>}
                      </td>
                      <td className="px-4 py-3.5"><ChannelBadge channel={r.channel} /></td>
                      <td className="px-4 py-3.5 text-[#111] font-medium whitespace-nowrap">{fmtCurrency(r.gross)}</td>
                      <td className="px-4 py-3.5 text-[#999] whitespace-nowrap">{fmtCurrency(deductions)}</td>
                      <td className="px-4 py-3.5 font-semibold text-accent whitespace-nowrap">{fmtCurrency(r.net)}</td>
                      <td className="px-4 py-3.5"><span className={statusPillFinance(r.payoutStatus)}>{r.payoutStatus}</span></td>
                      <td className="px-4 py-3.5 text-[#777] whitespace-nowrap">{fmtDate(r.payoutDate)}</td>
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
    </AppShell>
  );
}
