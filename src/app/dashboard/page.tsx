"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { getChannelIcon } from "@/components/ChannelBadge";

interface Arrival { guest: string; property: string; guests: number; channel: string; }
interface Departure { guest: string; property: string; guests: number; channel: string; }
interface Upcoming { guest: string; property: string; dates: string; amount: string; channel: string; }
interface Payment { balance: string; paidThisMonth: string; pending: string; forecast?: string; }

export default function DashboardPage() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [payment, setPayment] = useState<Payment>({ balance: "€0", paidThisMonth: "€0", pending: "€0" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then((data) => {
        setArrivals(data.arrivals || []);
        setDepartures(data.departures || []);
        setUpcoming(data.upcoming || []);
        setPayment(data.payment || { balance: "€0", paidThisMonth: "€0", pending: "€0" });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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
      {/* Subtitle only — no duplicate "Today" heading */}
      <p className="text-[13px] text-[#888] mb-6 -mt-1">A live view of today&apos;s activity across your portfolio</p>

      {/* Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Arrivals */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-[#111]">Arrivals</h3>
              <p className="text-[11px] text-[#999]">Check-ins today</p>
            </div>
            <span className="text-[20px] font-medium text-[#111]">{arrivals.length}</span>
          </div>
          {arrivals.length > 0 ? arrivals.map((a, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(a.guest)}`} className="flex items-center gap-2 py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <span className="flex-shrink-0">{getChannelIcon(a.channel)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#111] truncate">{a.guest}</p>
                <p className="text-[11px] text-[#999] truncate">{a.property} · {a.guests} guests</p>
              </div>
            </Link>
          )) : (
            <p className="text-[12px] text-[#999] py-4 text-center border-t border-[#f3f3f3]">No arrivals today</p>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-[#111]">Departures</h3>
              <p className="text-[11px] text-[#999]">Check-outs today</p>
            </div>
            <span className="text-[20px] font-medium text-[#111]">{departures.length}</span>
          </div>
          {departures.length > 0 ? departures.map((d, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(d.guest)}`} className="flex items-center gap-2 py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <span className="flex-shrink-0">{getChannelIcon(d.channel)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#111] truncate">{d.guest}</p>
                <p className="text-[11px] text-[#999] truncate">{d.property}</p>
              </div>
            </Link>
          )) : (
            <p className="text-[12px] text-[#999] py-4 text-center border-t border-[#f3f3f3]">No departures today</p>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-[#111]">Upcoming</h3>
              <p className="text-[11px] text-[#999]">Next 3 reservations</p>
            </div>
            <Link href="/reservations" className="text-[11px] font-medium text-[#333] hover:text-[#111] transition-colors">View all →</Link>
          </div>
          {upcoming.length > 0 ? upcoming.map((r, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(r.guest)}`} className="flex items-center gap-2 py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <span className="flex-shrink-0">{getChannelIcon(r.channel)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#111] truncate">{r.guest}</p>
                <p className="text-[11px] text-[#999] truncate">{r.property} · {r.dates}</p>
              </div>
            </Link>
          )) : (
            <p className="text-[12px] text-[#999] py-4 text-center border-t border-[#f3f3f3]">No upcoming reservations</p>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <h3 className="text-[14px] font-medium text-[#111] mb-3">Payment summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] md:text-[11px] font-medium text-[#888] uppercase tracking-wide">Balance</span>
          <p className="text-[18px] md:text-[22px] font-medium text-[#111] mt-1">{payment.balance}</p>
          <p className="text-[10px] text-[#aaa] mt-0.5">In-house reservations total</p>
        </Link>
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] md:text-[11px] font-medium text-[#888] uppercase tracking-wide">Paid this month</span>
          <p className="text-[18px] md:text-[22px] font-medium text-[#111] mt-1">{payment.paidThisMonth}</p>
          <p className="text-[10px] text-[#aaa] mt-0.5">Total transferred this month</p>
        </Link>
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] md:text-[11px] font-medium text-[#888] uppercase tracking-wide">Pending payment</span>
          <p className="text-[18px] md:text-[22px] font-medium text-[#111] mt-1">{payment.pending}</p>
          <p className="text-[10px] text-[#aaa] mt-0.5">Completed, payout pending</p>
        </Link>
        <Link href="/finances" className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:shadow-sm hover:border-[#ddd] transition-all">
          <span className="text-[10px] md:text-[11px] font-medium text-[#888] uppercase tracking-wide">Forecast</span>
          <p className="text-[18px] md:text-[22px] font-medium text-[#111] mt-1">{payment.forecast || "€0.00"}</p>
          <p className="text-[10px] text-[#aaa] mt-0.5">Upcoming reservations total</p>
        </Link>
      </div>
    </AppShell>
  );
}
