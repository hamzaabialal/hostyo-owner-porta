"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import ChannelBadge, { getChannelIcon } from "@/components/ChannelBadge";
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

function fmtDateShort(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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
function BalanceSummarySection({ paid, pending, upcoming }: { paid: number; pending: number; upcoming: number }) {
  const total = paid + pending + upcoming;
  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

  const rows = [
    { label: "Paid this month", amount: paid, dot: "bg-[#2F6B57]" },
    { label: "Pending payment", amount: pending, dot: "bg-[#d4a843]" },
    { label: "Upcoming (forecast)", amount: upcoming, dot: "bg-[#5E6673]" },
  ];

  return (
    <div className="bg-white border border-[#eaeaea] rounded-xl p-4 md:p-6">
      <div className="text-[12px] md:text-[13px] font-semibold text-[#111] mb-3 md:mb-4">Balance Summary</div>
      <div className="flex h-[6px] rounded-full overflow-hidden bg-[#f0f0f0] mb-4 md:mb-5">
        <div className="bg-[#2F6B57] rounded-l-full" style={{ width: `${paidPct}%` }} />
        <div className="bg-[#d4a843]" style={{ width: `${pendingPct}%` }} />
      </div>
      <div className="space-y-2.5 md:space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[12px] md:text-[13px]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${r.dot}`} />
              <span className="text-[#555]">{r.label}</span>
            </div>
            <span className="font-semibold text-[#111]">{fmtCurrency(r.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trend Chart                                                        */
/* ------------------------------------------------------------------ */
function PayoutBarChart({ data }: { data: { month: string; payout: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.payout), 1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="flex items-end gap-1.5 md:gap-2 h-[120px] md:h-[160px]">
        {data.map((d, i) => {
          const pct = maxVal > 0 ? (d.payout / maxVal) * 100 : 0;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0 relative"
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              {/* Tooltip */}
              {hoveredIdx === i && d.payout > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap z-10">
                  {d.month}: {fmtCurrency(d.payout)}
                </div>
              )}
              <div className="w-full flex justify-center h-[95px] md:h-[130px] items-end">
                <div
                  className="w-full max-w-[32px] md:max-w-[40px] rounded-t-md bg-[#80020E] hover:bg-[#6b010c] transition-colors cursor-pointer"
                  style={{ height: `${Math.max(pct, d.payout > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="text-[9px] md:text-[10px] text-[#999] font-medium">{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  useEffect(() => {
    fetchData("reservations", "/api/reservations")
      .then((res: unknown) => {
        const rr = res as { data?: Reservation[] };
        if (rr.data) setReservations(rr.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute financial summaries from real data
  const now = useMemo(() => new Date(), []);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const ownerBalance = useMemo(() =>
    reservations
      .filter((r) => r.status === "Completed" && r.payoutStatus === "Pending")
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0),
  [reservations]);

  const paidThisMonth = useMemo(() =>
    reservations
      .filter((r) => r.payoutStatus === "Paid" && (r.checkout || "").startsWith(thisMonth))
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0),
  [reservations, thisMonth]);

  const pendingPayment = useMemo(() =>
    reservations
      .filter((r) => r.payoutStatus === "Pending")
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0),
  [reservations]);

  const upcomingPayouts = useMemo(() => {
    const today = now.toISOString().split("T")[0];
    return reservations
      .filter((r) => r.checkin > today && r.status !== "Cancelled")
      .reduce((sum, r) => sum + (r.ownerPayout || 0), 0);
  }, [reservations, now]);

  // Recent payouts: completed + paid
  const recentPayouts = useMemo(() =>
    reservations
      .filter((r) => r.payoutStatus === "Paid")
      .sort((a, b) => (b.checkout || "").localeCompare(a.checkout || ""))
      .slice(0, 6),
  [reservations]);

  // Upcoming forecast: future reservations
  const upcomingRows = useMemo(() => {
    const today = now.toISOString().split("T")[0];
    return reservations
      .filter((r) => r.checkin > today && r.status !== "Cancelled")
      .sort((a, b) => a.checkin.localeCompare(b.checkin))
      .slice(0, 6);
  }, [reservations, now]);

  // Monthly owner payouts (last 6 months)
  const monthlyPayouts = useMemo(() => {
    const months: { month: string; payout: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short" });
      const payout = reservations
        .filter((r) => (r.checkout || "").startsWith(key))
        .reduce((s, r) => s + (r.ownerPayout || 0), 0);
      months.push({ month: label, payout });
    }
    return months;
  }, [reservations, now]);

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

  // Additional computed values
  const today = now.toISOString().split("T")[0];
  const activeProperties = useMemo(() => new Set(reservations.filter((r) => r.status !== "Cancelled").map((r) => r.property)).size, [reservations]);
  const feesThisMonth = useMemo(() => reservations.filter((r) => (r.checkout || "").startsWith(thisMonth)).reduce((s, r) => s + (r.managementFee || 0), 0), [reservations, thisMonth]);
  const upcomingConfirmed = useMemo(() => reservations.filter((r) => r.checkin > today && r.status !== "Cancelled").length, [reservations, today]);

  // YTD fees (Nov previous year to current month)
  const ytdStart = `${now.getFullYear() - 1}-11`;
  const feesYTD = useMemo(() => reservations.filter((r) => { const co = (r.checkout || ""); return co >= ytdStart && co <= thisMonth + "-31"; }).reduce((s, r) => s + (r.managementFee || 0), 0), [reservations, ytdStart, thisMonth]);
  const ytdBookings = useMemo(() => reservations.filter((r) => { const co = (r.checkout || ""); return co >= ytdStart && co <= thisMonth + "-31" && r.status !== "Cancelled"; }).length, [reservations, ytdStart, thisMonth]);
  const avgPerBooking = ytdBookings > 0 ? feesYTD / ytdBookings : 0;
  const avgPerProperty = activeProperties > 0 ? feesYTD / activeProperties : 0;

  // Properties ranked by fees earned
  const propertyRanking = useMemo(() => {
    const map: Record<string, { fees: number; revenue: number }> = {};
    for (const r of reservations) {
      if (r.status === "Cancelled") continue;
      const p = r.property || "Unknown";
      if (!map[p]) map[p] = { fees: 0, revenue: 0 };
      map[p].fees += r.managementFee || 0;
      map[p].revenue += r.grossAmount || 0;
    }
    return Object.entries(map).sort(([, a], [, b]) => b.fees - a.fees).slice(0, 10);
  }, [reservations]);

  // Monthly management fees chart (last 6 months)
  const monthlyFees = useMemo(() => {
    const months: { month: string; collected: number; forecast: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short" });
      const isPast = key < thisMonth;
      const isCurrent = key === thisMonth;
      const fees = reservations.filter((r) => (r.checkout || "").startsWith(key)).reduce((s, r) => s + (r.managementFee || 0), 0);
      months.push({ month: label, collected: isPast || isCurrent ? fees : 0, forecast: !isPast ? fees : 0 });
    }
    return months;
  }, [reservations, now, thisMonth]);

  const maxFee = Math.max(...monthlyFees.map((d) => Math.max(d.collected, d.forecast)), 1);

  return (
    <AppShell title="Finances">
      <MobileTabs tabs={FINANCE_TABS} />

      {/* ── Row 1: Dark stat cards ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        {[
          { label: "Properties", value: String(activeProperties), sub: "Active" },
          { label: `Fees · ${now.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}`, value: fmtCurrency(feesThisMonth), sub: "This month" },
          { label: "Upcoming", value: fmtCurrency(upcomingPayouts), sub: `${upcomingConfirmed} Confirmed` },
          { label: "Fees YTD", value: fmtCurrency(feesYTD), sub: `Nov ${now.getFullYear() - 1} – ${now.toLocaleDateString("en-GB", { month: "short" })} ${String(now.getFullYear()).slice(2)}` },
          { label: "Avg / Booking", value: fmtCurrency(avgPerBooking), sub: "YTD" },
          { label: "Avg / Property", value: fmtCurrency(avgPerProperty), sub: "YTD" },
        ].map((c) => (
          <div key={c.label} className="bg-[#1a1a1a] rounded-xl p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">{c.label}</div>
            <div className="text-[16px] md:text-[20px] font-bold text-white truncate">{c.value}</div>
            <div className="text-[9px] md:text-[10px] text-[#666] mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Light stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
        <SummaryCard label="Owner Balance" value={fmtCurrency(ownerBalance)} accent subtitle="Payout pending" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Owner Payouts" value={fmtCurrency(paidThisMonth)} subtitle="This month" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Pending Payout" value={fmtCurrency(pendingPayment)} subtitle="Net after fees" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Revenue Forecast" value={fmtCurrency(upcomingPayouts)} subtitle="Future bookings" onClick={() => router.push("/finances/earnings")} />
      </div>

      {/* ── Monthly Management Fees Chart ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[14px] font-semibold text-[#111]">Monthly management fees</div>
          <div className="flex items-center gap-4 text-[11px] text-[#999]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#80020E]" />Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#80020E]/20" />Forecast</span>
            <span>collected vs forecast</span>
          </div>
        </div>
        {/* Y-axis + bars */}
        <div className="flex gap-2">
          <div className="flex flex-col justify-between text-[10px] text-[#bbb] text-right w-[40px] h-[180px] pb-6">
            {[...Array(6)].map((_, i) => <span key={i}>€{((maxFee / 5) * (5 - i) / 1000).toFixed(1)}k</span>)}
          </div>
          <div className="flex-1 flex items-end gap-2 md:gap-4 h-[180px] border-b border-[#f0f0f0] pb-0">
            {monthlyFees.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center items-end h-[150px] gap-[2px]">
                  {d.collected > 0 && <div className="w-full max-w-[28px] rounded-t bg-[#80020E]" style={{ height: `${(d.collected / maxFee) * 100}%` }} />}
                  {d.forecast > 0 && d.forecast !== d.collected && <div className="w-full max-w-[28px] rounded-t bg-[#80020E]/20" style={{ height: `${(d.forecast / maxFee) * 100}%` }} />}
                  {d.collected === 0 && d.forecast === 0 && <div className="w-full max-w-[28px] rounded-t bg-[#f0f0f0]" style={{ height: "2px" }} />}
                </div>
                <span className="text-[10px] text-[#999] font-medium">{d.month}</span>
              </div>
            ))}
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
