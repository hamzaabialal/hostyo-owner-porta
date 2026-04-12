"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { getChannelIcon } from "@/components/ChannelBadge";
// No reconciliation walker needed — simple balance formula used directly

interface InHouseGuest { guest: string; property: string; channel: string; daysLeft: number; }
interface NextArrival { guest: string; property: string; channel: string; daysAway: number; date: string; }
interface Payment { balance: string; paidThisMonth: string; pending: string; forecast?: string; }

function fmtCurrencyShort(n: number): string {
  return "€" + Math.round(Math.abs(n)).toLocaleString("en-IE");
}

export default function DashboardPage() {
  const [inHouse, setInHouse] = useState<InHouseGuest[]>([]);
  const [nextArrivals, setNextArrivals] = useState<NextArrival[]>([]);
  const [payment, setPayment] = useState<Payment>({ balance: "€0", paidThisMonth: "€0", pending: "€0" });
  const [expenses, setExpenses] = useState("€0");
  const [totalDeficit, setTotalDeficit] = useState(0);
  const [propertiesOnHold, setPropertiesOnHold] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/today").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/reservations").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/properties").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([todayData, expData, resData, propData]) => {
      setInHouse(todayData.inHouse || []);
      setNextArrivals(todayData.nextArrivals || []);
      setPayment(todayData.payment || { balance: "€0", paidThisMonth: "€0", pending: "€0" });
      // Calculate expenses this month
      const thisMonth = new Date().toISOString().slice(0, 7);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const monthExp = (expData.data || []).filter((e: any) => (e.date || "").startsWith(thisMonth)).reduce((s: number, e: any) => s + (e.amount || 0), 0);
      setExpenses(`€${monthExp.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);

      // Balance per property = Σ(Owner Payout where Status=Completed AND Payout Status=Pending)
      // No expense subtraction — expenses are handled at payout time, not in the balance.
      // Skip-automation properties are excluded.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allProps: any[] = propData.data || [];
      const skipNames = allProps
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p.skipAutomation === true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => (p.name || "").trim().toLowerCase())
        .filter(Boolean);
      const isSkipped = (name: string): boolean => {
        const n = (name || "").trim().toLowerCase();
        if (!n) return false;
        return skipNames.some((s: string) => s === n || s.startsWith(n) || n.startsWith(s));
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allRes: any[] = (resData.data || []).filter((r: any) => !isSkipped(r.property || ""));

      // Group by property — sum completed+pending owner payouts only
      const balanceByProp: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of allRes) {
        if (r.status === "Completed" && r.payoutStatus === "Pending") {
          const key = (r.property || "").trim().toLowerCase();
          if (!key) continue;
          balanceByProp[key] = (balanceByProp[key] || 0) + (r.ownerPayout || 0);
        }
      }

      // Sum up deficits across all properties
      let total = 0;
      let count = 0;
      for (const key of Object.keys(balanceByProp)) {
        const bal = balanceByProp[key];
        if (bal < 0) {
          total += Math.abs(bal);
          count++;
        }
      }
      setTotalDeficit(total);
      setPropertiesOnHold(count);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell title="Today">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Today">
      <p className="text-[13px] text-[#888] mb-6 -mt-1">A live view of today&apos;s activity across your portfolio</p>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {totalDeficit > 0 ? (
          <Link
            href="/finances/payouts"
            className="bg-white border border-[#80020E] rounded-xl p-4 hover:shadow-sm hover:bg-[#FBF6F6] transition-all"
          >
            <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Balance</span>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#80020E] mt-1.5">
              <span className="w-2 h-2 rounded-full bg-[#80020E]" />
              On hold
            </p>
            <p className="text-[22px] font-bold text-[#80020E] mt-0.5">−{fmtCurrencyShort(totalDeficit)}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">
              Payouts paused{propertiesOnHold > 1 ? ` · ${propertiesOnHold} properties` : ""}
            </p>
          </Link>
        ) : (
          <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
            <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Balance</span>
            <p className="text-[22px] font-bold text-[#111] mt-1">{payment.balance}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">Payout pending</p>
          </Link>
        )}
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Paid Out</span>
          <p className="text-[22px] font-bold text-[#111] mt-1">{payment.paidThisMonth}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">This month</p>
        </Link>
        <Link href="/finances/expenses" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Expenses</span>
          <p className="text-[22px] font-bold text-[#111] mt-1">{expenses}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">This month</p>
        </Link>
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Forecast</span>
          <p className="text-[22px] font-bold text-[#111] mt-1">{payment.forecast || "€0"}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">Upcoming reservations</p>
        </Link>
      </div>

      {/* ── In House + Next Arrivals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* In House */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <h3 className="text-[15px] font-semibold text-[#111] mb-4">In house</h3>
          {inHouse.length === 0 ? (
            <p className="text-[13px] text-[#999] py-4 text-center">No guests currently in house</p>
          ) : (
            <div className="space-y-0">
              {inHouse.map((g, i) => (
                <Link key={i} href={`/reservations?guest=${encodeURIComponent(g.guest)}`}
                  className="flex items-center gap-3 py-3 border-t border-[#f3f3f3] first:border-t-0 hover:bg-[#f9f9f9] -mx-2 px-2 rounded-lg transition-colors">
                  <span className="flex-shrink-0">{getChannelIcon(g.channel)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] truncate">{g.guest}</p>
                    <p className="text-[12px] text-[#999] truncate">{g.property}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[18px] font-bold text-[#111]">{g.daysLeft}</div>
                    <div className="text-[10px] text-[#999]">days left</div>
                    {g.daysLeft === 0 && <div className="text-[10px] text-[#FF5A5F] font-semibold">Departing today</div>}
                    {g.daysLeft === 1 && <div className="text-[10px] text-[#FF5A5F] font-semibold">Departing tomorrow</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Next Arrivals */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#111]">Next arrivals</h3>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#999]">{nextArrivals.length} upcoming</span>
              <Link href="/reservations" className="text-[12px] font-medium text-[#888] hover:text-[#555] transition-colors">View all →</Link>
            </div>
          </div>
          {nextArrivals.length === 0 ? (
            <p className="text-[13px] text-[#999] py-4 text-center">No upcoming arrivals</p>
          ) : (
            <div className="space-y-0">
              {nextArrivals.map((a, i) => (
                <Link key={i} href={`/reservations?guest=${encodeURIComponent(a.guest)}`}
                  className="flex items-center gap-3 py-3 border-t border-[#f3f3f3] first:border-t-0 hover:bg-[#f9f9f9] -mx-2 px-2 rounded-lg transition-colors">
                  <span className="flex-shrink-0">{getChannelIcon(a.channel)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] truncate">{a.guest}</p>
                    <p className="text-[12px] text-[#999] truncate">{a.property}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[18px] font-bold text-[#111]">{a.daysAway}</div>
                    <div className="text-[10px] text-[#999]">days away</div>
                    {a.daysAway === 0 && <div className="text-[10px] text-[#2F6B57] font-semibold">Arriving today</div>}
                    {a.daysAway === 1 && <div className="text-[10px] text-[#2F6B57] font-semibold">Arriving tomorrow</div>}
                    {a.daysAway > 1 && <div className="text-[10px] text-[#999]">{a.date}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
