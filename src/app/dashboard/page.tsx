"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ChannelBadge, { getChannelIcon } from "@/components/ChannelBadge";

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
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EAF3EF] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-[#111]">Arrivals</h3>
                <p className="text-[11px] text-[#999]">Check-ins today</p>
              </div>
            </div>
            <span className="text-[20px] font-semibold text-[#111]">{arrivals.length}</span>
          </div>
          {arrivals.length > 0 ? arrivals.map((a, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(a.guest)}`} className="flex items-center justify-between py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0">{getChannelIcon(a.channel)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111] truncate">{a.guest}</p>
                  <p className="text-[11px] text-[#999] truncate">{a.property} · {a.guests} guests</p>
                </div>
              </div>
              <ChannelBadge channel={a.channel} compact />
            </Link>
          )) : (
            <p className="text-[12px] text-[#999] py-4 text-center border-t border-[#f3f3f3]">No arrivals today</p>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EEF1F5] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-[#111]">Departures</h3>
                <p className="text-[11px] text-[#999]">Check-outs today</p>
              </div>
            </div>
            <span className="text-[20px] font-semibold text-[#111]">{departures.length}</span>
          </div>
          {departures.length > 0 ? departures.map((d, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(d.guest)}`} className="flex items-center justify-between py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0">{getChannelIcon(d.channel)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111] truncate">{d.guest}</p>
                  <p className="text-[11px] text-[#999] truncate">{d.property}</p>
                </div>
              </div>
              <ChannelBadge channel={d.channel} compact />
            </Link>
          )) : (
            <p className="text-[12px] text-[#999] py-4 text-center border-t border-[#f3f3f3]">No departures today</p>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F6F1E6] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-[#111]">Upcoming</h3>
                <p className="text-[11px] text-[#999]">Next 3 reservations</p>
              </div>
            </div>
            <Link href="/reservations" className="text-[11px] font-medium text-[#80020E] hover:underline transition-colors">View all →</Link>
          </div>
          {upcoming.length > 0 ? upcoming.map((r, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(r.guest)}`} className="block py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0">{getChannelIcon(r.channel)}</span>
                  <p className="text-[13px] font-medium text-[#111] truncate">{r.guest}</p>
                </div>
                <span className="text-[13px] font-semibold text-[#111] flex-shrink-0 ml-2">{r.amount}</span>
              </div>
              <div className="flex items-center justify-between pl-6">
                <p className="text-[11px] text-[#999] truncate">{r.property} · {r.dates}</p>
                <ChannelBadge channel={r.channel} compact />
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
