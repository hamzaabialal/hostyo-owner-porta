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
    Completed: "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#4D625A] bg-[#EDF3F0] border-[#DBE6E0]",
  };
  return map[s] || "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border text-[#555] bg-[#f5f5f5] border-[#e5e5e5]";
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
    <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
      <div className="text-[13px] font-semibold text-[#111] mb-4">Balance Summary</div>
      <div className="flex h-[6px] rounded-full overflow-hidden bg-[#f0f0f0] mb-5">
        <div className="bg-[#2F6B57] rounded-l-full" style={{ width: `${paidPct}%` }} />
        <div className="bg-[#d4a843]" style={{ width: `${pendingPct}%` }} />
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[13px]">
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
function TrendChart({ data }: { data: { month: string; earnings: number; expenses: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.earnings), 1);
  return (
    <div className="flex items-end gap-3 h-[140px]">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="flex gap-[2px] items-end w-full justify-center h-[110px]">
            <div className="w-[14px] rounded-t bg-accent/20" style={{ height: `${(d.earnings / maxVal) * 100}%` }} title={`Earnings: ${fmtCurrency(d.earnings)}`} />
            <div className="w-[14px] rounded-t bg-[#e8d8d8]" style={{ height: `${(d.expenses / maxVal) * 100}%` }} title={`Expenses: ${fmtCurrency(d.expenses)}`} />
          </div>
          <span className="text-[10px] text-[#999] font-medium">{d.month}</span>
        </div>
      ))}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    Promise.all([
      fetchData("reservations", "/api/reservations"),
      fetchData("expenses", "/api/expenses"),
    ])
      .then(([resResult, expResult]: unknown[]) => {
        const rr = resResult as { data?: Reservation[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const er = expResult as { data?: any[] };
        if (rr.data) setReservations(rr.data);
        if (er.data) setExpensesData(er.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute financial summaries from real data
  const now = new Date();
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

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { month: string; earnings: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short" });
      const earnings = reservations
        .filter((r) => (r.checkout || "").startsWith(key))
        .reduce((s, r) => s + (r.ownerPayout || 0), 0);
      const exp = expensesData
        .filter((e) => (e.date || "").startsWith(key))
        .reduce((s, e) => s + (e.amount || 0), 0);
      months.push({ month: label, earnings, expenses: exp });
    }
    return months;
  }, [reservations, expensesData, now]);

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
      <div className="text-[13px] text-[#888] mb-6 -mt-1 hidden md:block">Your financial overview across all properties.</div>

      {/* ── A. Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <SummaryCard label="Owner Balance" value={fmtCurrency(ownerBalance)} accent subtitle="Completed stays, payout pending" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Paid This Month" value={fmtCurrency(paidThisMonth)} subtitle={new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Pending Payment" value={fmtCurrency(pendingPayment)} subtitle="Net owner payout after all fees" onClick={() => router.push("/finances/earnings")} />
        <SummaryCard label="Upcoming (Forecast)" value={fmtCurrency(upcomingPayouts)} subtitle="Based on future bookings" onClick={() => router.push("/finances/earnings")} />
      </div>

      {/* ── B & D. Balance Summary + Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <BalanceSummarySection paid={paidThisMonth} pending={pendingPayment} upcoming={upcomingPayouts} />
        <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-semibold text-[#111]">Earnings vs Expenses</div>
            <div className="flex items-center gap-4 text-[11px] text-[#999]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent/20" />Earnings</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#e8d8d8]" />Expenses</span>
            </div>
          </div>
          <TrendChart data={monthlyTrend} />
        </div>
      </div>

      {/* ── C. Recent Payouts ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl mb-6">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <div className="text-[13px] font-semibold text-[#111]">Recent Payouts</div>
        </div>
        {recentPayouts.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#aaa]">No recent payouts to show.</div>
        ) : (
          <div className="divide-y divide-[#f3f3f3]">
            {recentPayouts.map((r, i) => (
              <div key={i} onClick={() => setSelectedReservation(r)} className="flex items-center gap-3 px-4 md:px-5 py-3 text-[13px] cursor-pointer hover:bg-[#fafafa] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#111] truncate text-[12px] md:text-[13px]">{r.property}</div>
                  <div className="text-[11px] md:text-[12px] text-[#999] mt-0.5 truncate">{r.guest} &middot; {fmtDateShort(r.checkin)} – {fmtDateShort(r.checkout)}</div>
                </div>
                <div className="hidden md:block flex-shrink-0"><ChannelBadge channel={r.channel} compact /></div>
                <div className="text-right font-semibold text-[#111] flex-shrink-0 text-[12px] md:text-[13px]">{fmtCurrency(r.ownerPayout || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── C. Upcoming Payouts / Forecast ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <div className="text-[13px] font-semibold text-[#111]">Upcoming Payouts (Forecast)</div>
        </div>
        {upcomingRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#aaa]">No upcoming payouts forecasted.</div>
        ) : (
          <div className="divide-y divide-[#f3f3f3]">
            {upcomingRows.map((r, i) => (
              <div key={i} onClick={() => setSelectedReservation(r)} className="flex items-center gap-4 px-5 py-3.5 text-[13px] cursor-pointer hover:bg-[#fafafa] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#111] truncate">{r.property}</div>
                  <div className="text-[12px] text-[#999] mt-0.5">{r.guest} &middot; {fmtDateShort(r.checkin)} – {fmtDateShort(r.checkout)}</div>
                </div>
                <div className="flex-shrink-0"><ChannelBadge channel={r.channel} compact /></div>
                <div className="w-[90px] text-right font-semibold text-[#111] flex-shrink-0">{fmtCurrency(r.ownerPayout || 0)}</div>
                <div className="flex-shrink-0"><span className={statusPillFinance("Upcoming")}>Upcoming</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reservation Detail Drawer */}
      {selectedReservation && <ReservationDrawer r={selectedReservation} onClose={() => setSelectedReservation(null)} />}
    </AppShell>
  );
}
