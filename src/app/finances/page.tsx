"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import ChannelBadge from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";

const FINANCE_TABS = [
  { label: "Overview", href: "/finances", exact: true },
  { label: "Earnings", href: "/finances/earnings" },
  { label: "Expenses", href: "/finances/expenses" },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Reservation {
  property: string;
  guest: string;
  ref: string;
  checkin: string;
  checkout: string;
  channel: string;
  status: string;
  nights: number;
  ownerPayout: number;
  netBooking: number;
  payoutStatus: string;
  grossAmount: number;
  managementFee: number;
  platformFee: number;
  cleaning: number;
  expenses: number;
  adults: number;
  children: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtCurrency(n: number): string {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// fmtDateShort removed — no longer used

function statusPillFinance(s: string): string {
  const key = s.toLowerCase().replace(/\s+/g, "-");
  return "pill pill-" + key;
}

function fmtDateFull(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Reservation Preview Drawer                                         */
/* ------------------------------------------------------------------ */
function ReservationDrawer({ r, onClose }: { r: Reservation; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [onClose]);

  function Row({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
    if (!value && value !== 0) return null;
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0">
        <span className="text-[12px] text-[#999]">{label}</span>
        <span className={`text-[13px] font-medium ${accent ? "text-accent" : "text-[#111]"}`}>{value}</span>
      </div>
    );
  }

  const guests = (r.adults || 0) + (r.children || 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[101] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div className="text-[15px] font-semibold text-[#111]">Reservation Details</div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Reservation Info */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Reservation Info</div>
            <div className="flex items-start justify-between py-2.5 border-b border-[#f3f3f3]">
              <div>
                <div className="text-[12px] text-[#999]">Guest</div>
                <div className="text-[14px] font-semibold text-[#111]">{r.guest}</div>
              </div>
              {r.ref && (
                <div className="text-right">
                  <div className="text-[12px] text-[#999]">Booking Ref</div>
                  <div className="text-[12px] font-mono text-[#555]">{r.ref}</div>
                </div>
              )}
            </div>
            <Row label="Property" value={r.property} />
            <div className="flex items-center justify-between py-2.5 border-b border-[#f3f3f3]">
              <span className="text-[12px] text-[#999]">Channel</span>
              <ChannelBadge channel={r.channel} />
            </div>
            {guests > 0 && <Row label="Guests" value={guests} />}
          </div>

          {/* Stay Details */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Stay Details</div>
            <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-[#f3f3f3]">
              <div>
                <div className="text-[12px] text-[#999]">Check-in</div>
                <div className="text-[13px] font-medium text-[#111]">{fmtDateFull(r.checkin)}</div>
              </div>
              <div>
                <div className="text-[12px] text-[#999]">Check-out</div>
                <div className="text-[13px] font-medium text-[#111]">{fmtDateFull(r.checkout)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-[#f3f3f3]">
              <div>
                <div className="text-[12px] text-[#999]">Nights</div>
                <div className="text-[13px] font-medium text-[#111]">{r.nights}</div>
              </div>
              <div>
                <div className="text-[12px] text-[#999]">Status</div>
                <span className={statusPillFinance(r.status)}>{r.status}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Financial Breakdown</div>
            <Row label="Gross Price" value={fmtCurrency(r.grossAmount)} />
            {r.platformFee > 0 && <Row label="Platform Fee" value={"-" + fmtCurrency(r.platformFee)} />}
            {r.managementFee > 0 && <Row label="Hostyo Fee" value={"-" + fmtCurrency(r.managementFee)} />}
            {r.cleaning > 0 && <Row label="Cleaning Fee" value={"-" + fmtCurrency(r.cleaning)} />}
            {r.expenses > 0 && <Row label="Expenses" value={"-" + fmtCurrency(r.expenses)} />}
            <div className="flex items-center justify-between py-3 mt-1 bg-[#fafafa] rounded-lg px-3">
              <span className="text-[13px] font-semibold text-[#111]">Net Owner Payout</span>
              <span className="text-[15px] font-bold text-accent">{fmtCurrency(r.ownerPayout)}</span>
            </div>
          </div>

          {/* Payout Status */}
          <div>
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Payout</div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12px] text-[#999]">Payout Status</span>
              <span className={statusPillFinance(r.payoutStatus)}>{r.payoutStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */
function SummaryCard({ label, value, accent, subtitle, onClick }: { label: string; value: string; accent?: boolean; subtitle?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white border border-[#eaeaea] rounded-xl p-3 md:p-5 overflow-hidden ${onClick ? "cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] transition-all" : ""}`}>
      <div className="text-[10px] md:text-[12px] font-medium text-[#888] uppercase tracking-wide mb-1 md:mb-2 truncate">{label}</div>
      <div className={`text-[18px] md:text-[24px] font-semibold truncate ${accent ? "text-accent" : "text-[#111]"}`}>{value}</div>
      {subtitle && <div className="text-[10px] md:text-[11px] text-[#aaa] mt-1 truncate">{subtitle}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Balance Summary                                                    */
/* ------------------------------------------------------------------ */
// BalanceSummarySection and PayoutBarChart removed — replaced by new overview layout

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      </div>
      <div className="text-[16px] font-semibold text-[#111] mb-2">No financial data yet</div>
      <div className="text-[13px] text-[#888] max-w-[380px] leading-relaxed">
        Your balances, payouts, and forecasts will appear here once reservations and payouts start flowing through.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function FinancesOverviewPage() {
  const { fetchData } = useData();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetchData("reservations", "/api/reservations"),
      fetchData("properties", "/api/properties"),
    ]).then(([resResult, propResult]: unknown[]) => {
        const rr = resResult as { data?: Reservation[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pp = propResult as { data?: any[] };
        if (rr.data) setReservations(rr.data);
        if (pp.data) setProperties(pp.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute financial summaries from real data
  const now = useMemo(() => new Date(), []);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Filter reservations to only live properties where automation is not skipped
  const skipNames = useMemo(() => {
    return properties
      .filter((p: Record<string, unknown>) => p.skipAutomation === true)
      .map((p: Record<string, unknown>) => ((p.name || "") as string).trim().toLowerCase())
      .filter(Boolean);
  }, [properties]);

  const liveReservations = useMemo(() => {
    return reservations.filter((r) => {
      const n = (r.property || "").trim().toLowerCase();
      if (!n) return true;
      return !skipNames.some((s: string) => s === n || s.startsWith(n) || n.startsWith(s));
    });
  }, [reservations, skipNames]);

  // Current Balance — real-time total across all live properties
  const ownerBalance = useMemo(() =>
    liveReservations
      .filter((r) => {
        if (r.status !== "Completed") return false;
        const ps = (r.payoutStatus || "").toLowerCase();
        return ps === "pending" || ps === "on hold";
      })
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0),
  [liveReservations]);

  // Expected Payouts — pending owner payout total for current month
  const expectedPayouts = useMemo(() =>
    liveReservations
      .filter((r) => {
        if (r.status === "Cancelled") return false;
        const ps = (r.payoutStatus || "").toLowerCase();
        if (ps !== "pending" && ps !== "on hold") return false;
        return (r.checkout || "").startsWith(thisMonth);
      })
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0),
  [liveReservations, thisMonth]);

  // Cleaning Fees — current month total
  const cleaningThisMonth = useMemo(() =>
    liveReservations
      .filter((r) => r.status !== "Cancelled" && (r.checkout || "").startsWith(thisMonth))
      .reduce((sum, r) => sum + (r.cleaning || 0), 0),
  [liveReservations, thisMonth]);

  // VAT — 19% on management fees, current month
  const vatThisMonth = useMemo(() =>
    liveReservations
      .filter((r) => r.status !== "Cancelled" && (r.checkout || "").startsWith(thisMonth))
      .reduce((sum, r) => sum + ((r.managementFee || 0) * 0.19), 0),
  [liveReservations, thisMonth]);

  const upcomingPayouts = useMemo(() => {
    const today = now.toISOString().split("T")[0];
    return liveReservations
      .filter((r) => r.checkin > today && r.status !== "Cancelled")
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0);
  }, [liveReservations, now]);

  // Additional computed values (all hooks must be before early returns)
  const today = useMemo(() => now.toISOString().split("T")[0], [now]);
  const activeProperties = useMemo(() => new Set(liveReservations.filter((r) => r.status !== "Cancelled").map((r) => r.property)).size, [liveReservations]);
  const feesThisMonth = useMemo(() => liveReservations.filter((r) => (r.checkout || "").startsWith(thisMonth)).reduce((s, r) => s + (r.managementFee || 0), 0), [liveReservations, thisMonth]);
  const upcomingConfirmed = useMemo(() => liveReservations.filter((r) => r.checkin > today && r.status !== "Cancelled").length, [liveReservations, today]);

  // YTD fees (Nov previous year to current month)
  const ytdStart = `${now.getFullYear() - 1}-11`;
  const feesYTD = useMemo(() => liveReservations.filter((r) => { const co = (r.checkout || ""); return co >= ytdStart && co <= thisMonth + "-31"; }).reduce((s, r) => s + (r.managementFee || 0), 0), [liveReservations, ytdStart, thisMonth]);
  const ytdBookings = useMemo(() => liveReservations.filter((r) => { const co = (r.checkout || ""); return co >= ytdStart && co <= thisMonth + "-31" && r.status !== "Cancelled"; }).length, [liveReservations, ytdStart, thisMonth]);
  const avgPerBooking = ytdBookings > 0 ? feesYTD / ytdBookings : 0;
  const avgPerProperty = activeProperties > 0 ? feesYTD / activeProperties : 0;

  // Properties ranked by fees earned
  const propertyRanking = useMemo(() => {
    const map: Record<string, { fees: number; revenue: number }> = {};
    for (const r of liveReservations) {
      if (r.status === "Cancelled") continue;
      const p = r.property || "Unknown";
      if (!map[p]) map[p] = { fees: 0, revenue: 0 };
      map[p].fees += r.managementFee || 0;
      map[p].revenue += r.grossAmount || 0;
    }
    return Object.entries(map).sort(([, a], [, b]) => b.fees - a.fees).slice(0, 10);
  }, [liveReservations]);

  // Monthly management fees chart — 12-month rolling window ending on current month.
  // Each month has `collected` (paid fees so far) and `pending` (forecast fees from
  // not-yet-paid, non-cancelled reservations). Past months will be all collected;
  // future months will be all pending; the current month is a mix of both.
  // 18-month chart: 6 past + current + 11 future (scrollable)
  const monthlyFees = useMemo(() => {
    const months: { month: string; year: number; key: string; collected: number; pending: number; isCurrent: boolean; isFuture: boolean }[] = [];
    for (let i = 6; i >= -11; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short" });
      const isCurrent = key === thisMonth;
      const isFuture = key > thisMonth;
      const monthRes = liveReservations.filter((r) => (r.checkout || "").startsWith(key) && r.status !== "Cancelled");
      const collected = monthRes.filter((r) => r.payoutStatus === "Paid").reduce((s, r) => s + (r.managementFee || 0), 0);
      const pending = monthRes.filter((r) => r.payoutStatus !== "Paid").reduce((s, r) => s + (r.managementFee || 0), 0);
      months.push({ month: label, year: d.getFullYear(), key, collected, pending, isCurrent, isFuture });
    }
    return months;
  }, [liveReservations, now, thisMonth]);

  const maxFee = Math.max(...monthlyFees.map((d) => d.collected + d.pending), 1);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  if (loading) {
    return (
      <AppShell title="Finances">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading financial data...</div>
      </AppShell>
    );
  }

  if (reservations.length === 0) {
    return (
      <AppShell title="Finances">
        <EmptyState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Finances">
      <MobileTabs tabs={FINANCE_TABS} />

      {/* ── Row 1: Stat cards ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        {[
          { label: "Properties", value: String(activeProperties), sub: "Active" },
          { label: `Fees · ${now.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}`, value: fmtCurrency(feesThisMonth), sub: "This month" },
          { label: "Upcoming", value: fmtCurrency(upcomingPayouts), sub: `${upcomingConfirmed} Confirmed` },
          { label: "Fees YTD", value: fmtCurrency(feesYTD), sub: `Nov ${now.getFullYear() - 1} – ${now.toLocaleDateString("en-GB", { month: "short" })} ${String(now.getFullYear()).slice(2)}` },
          { label: "Avg / Booking", value: fmtCurrency(avgPerBooking), sub: "YTD" },
          { label: "Avg / Property", value: fmtCurrency(avgPerProperty), sub: "YTD" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[#eaeaea] rounded-xl p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">{c.label}</div>
            <div className="text-[16px] md:text-[20px] font-bold text-[#111] truncate">{c.value}</div>
            <div className="text-[9px] md:text-[10px] text-[#aaa] mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Key financial cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
        <SummaryCard label="Current Balance" value={fmtCurrency(ownerBalance)} accent subtitle="Across all live properties" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Expected Payouts" value={fmtCurrency(expectedPayouts)} subtitle="Pending · this month" onClick={() => router.push("/finances/payouts")} />
        <SummaryCard label="Cleaning Fees" value={fmtCurrency(cleaningThisMonth)} subtitle="This month" />
        <SummaryCard label="Service VAT" value={fmtCurrency(vatThisMonth)} subtitle="19% · this month" />
      </div>

      {/* ── Monthly Management Fees Chart ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[14px] font-semibold text-[#111]">Monthly management fees</div>
            <div className="text-[11px] text-[#999] mt-0.5">Scroll to see upcoming months</div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#999]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#80020E]" />Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-[#80020E]/40 bg-[#80020E]/[0.06]" />Pending / Forecast</span>
          </div>
        </div>
        {/* Y-axis + scrollable bars */}
        <div className="flex gap-2">
          <div className="flex flex-col justify-between text-[10px] text-[#bbb] text-right w-[40px] h-[200px] pb-6 flex-shrink-0">
            {[...Array(6)].map((_, i) => <span key={i}>€{((maxFee / 5) * (5 - i) / 1000).toFixed(1)}k</span>)}
          </div>
          <div className="flex-1 overflow-x-auto hide-scrollbar">
          <div className="flex items-end gap-1.5 md:gap-2.5 h-[200px] border-b border-[#f0f0f0] pb-0 relative" style={{ minWidth: `${monthlyFees.length * 52}px` }}>
            {monthlyFees.map((d) => {
              const total = d.collected + d.pending;
              const collectedPct = (d.collected / maxFee) * 100;
              const pendingPct = (d.pending / maxFee) * 100;
              const isHovered = hoveredMonth === d.key;
              return (
                <div
                  key={d.key}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative"
                  onMouseEnter={() => setHoveredMonth(d.key)}
                  onMouseLeave={() => setHoveredMonth((cur) => (cur === d.key ? null : cur))}
                  onClick={() => setHoveredMonth((cur) => (cur === d.key ? null : d.key))}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-[#111] text-white text-[11px] rounded-lg px-2.5 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                      <div className="font-semibold mb-1">{d.month} {d.year}</div>
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#80020E]" /><span className="text-white/70">Collected</span><span className="ml-2 tabular-nums">{fmtCurrency(d.collected)}</span></div>
                      <div className="flex items-center gap-1.5 mt-0.5"><span className="w-2 h-2 rounded-sm border border-white/40 bg-white/[0.06]" /><span className="text-white/70">Pending</span><span className="ml-2 tabular-nums">{fmtCurrency(d.pending)}</span></div>
                      <div className="border-t border-white/10 mt-1 pt-1 flex items-center justify-between gap-2">
                        <span className="text-white/70">Total</span>
                        <span className="font-semibold tabular-nums">{fmtCurrency(total)}</span>
                      </div>
                      {/* Caret */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#111]" />
                    </div>
                  )}
                  {/* Bar — single column with stacked collected (solid) + pending (outlined) */}
                  <div className="w-full flex justify-center items-end h-[170px] cursor-pointer">
                    <div className="w-full max-w-[26px] flex flex-col justify-end h-full">
                      {d.pending > 0 && (
                        <div
                          className={`w-full border border-[#80020E]/40 bg-[#80020E]/[0.06] ${d.collected > 0 ? "rounded-t border-b-0" : "rounded-t"} ${isHovered ? "bg-[#80020E]/[0.12]" : ""} transition-colors`}
                          style={{ height: `${pendingPct}%` }}
                        />
                      )}
                      {d.collected > 0 && (
                        <div
                          className={`w-full bg-[#80020E] ${d.pending > 0 ? "rounded-b" : "rounded-t"} ${isHovered ? "brightness-110" : ""} transition-all`}
                          style={{ height: `${collectedPct}%` }}
                        />
                      )}
                      {total === 0 && (
                        <div className="w-full rounded-t bg-[#f0f0f0]" style={{ height: "2px" }} />
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium ${d.isCurrent ? "text-[#80020E] font-semibold" : "text-[#999]"}`}>{d.month}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      {/* ── Properties by Fees Earned ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[14px] font-semibold text-[#111]">Properties by fees earned</div>
          <div className="text-[11px] text-[#999]">YTD · ranked</div>
        </div>
        <div className="divide-y divide-[#f3f3f3]">
          {propertyRanking.map(([prop, data], i) => (
            <div key={prop} className="flex items-center gap-3 py-3">
              <span className="text-[12px] font-medium text-[#bbb] w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#111] truncate">{prop}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[14px] font-bold text-[#111]">{fmtCurrency(data.fees)}</div>
                <div className="text-[10px] text-[#999]">{fmtCurrency(data.revenue)} rev</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reservation Detail Drawer */}
      {selectedReservation && <ReservationDrawer r={selectedReservation} onClose={() => setSelectedReservation(null)} />}
    </AppShell>
  );
}
