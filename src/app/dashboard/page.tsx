"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ChannelBadge from "@/components/ChannelBadge";

interface Arrival { guest: string; property: string; guests: number; channel: string; }
interface Departure { guest: string; property: string; guests: number; channel: string; }
interface Upcoming { guest: string; property: string; dates: string; amount: string; channel: string; }
interface Payment { balance: string; paidThisMonth: string; pending: string; }

export default function DashboardPage() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [payment, setPayment] = useState<Payment>({ balance: "£0", paidThisMonth: "£0", pending: "£0" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then((data) => {
        setArrivals(data.arrivals || []);
        setDepartures(data.departures || []);
        setUpcoming(data.upcoming || []);
        setPayment(data.payment || { balance: "£0", paidThisMonth: "£0", pending: "£0" });
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
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold text-text-primary tracking-[-0.3px]">Today</h2>
        <p className="text-[14px] text-text-tertiary mt-1">A live view of today&apos;s activity across your portfolio</p>
      </div>

      {/* Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Arrivals */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#EAF3EF] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-text-primary">Arrivals</h3>
                <p className="text-[12px] text-text-tertiary">Check-ins today</p>
              </div>
            </div>
            <span className="text-[22px] font-bold text-text-primary">{arrivals.length}</span>
          </div>
          {arrivals.length > 0 ? arrivals.map((a, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(a.guest)}`} className="flex items-center justify-between py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
              <div>
                <p className="text-[14px] font-medium text-text-primary">{a.guest}</p>
                <p className="text-[12px] text-text-tertiary">{a.property} · {a.guests} guests</p>
              </div>
              <ChannelBadge channel={a.channel} />
            </Link>
          )) : (
            <p className="text-[13px] text-text-tertiary py-4 text-center border-t border-[#f3f3f3]">No arrivals today</p>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#EEF1F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-text-primary">Departures</h3>
                <p className="text-[12px] text-text-tertiary">Check-outs today</p>
              </div>
            </div>
            <span className="text-[22px] font-bold text-text-primary">{departures.length}</span>
          </div>
          {departures.length > 0 ? departures.map((d, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(d.guest)}`} className="flex items-center justify-between py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
              <div>
                <p className="text-[14px] font-medium text-text-primary">{d.guest}</p>
                <p className="text-[12px] text-text-tertiary">{d.property}</p>
              </div>
              <ChannelBadge channel={d.channel} />
            </Link>
          )) : (
            <p className="text-[13px] text-text-tertiary py-4 text-center border-t border-[#f3f3f3]">No departures today</p>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#F6F1E6] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-text-primary">Upcoming</h3>
                <p className="text-[12px] text-text-tertiary">Next 3 reservations</p>
              </div>
            </div>
            <Link href="/reservations" className="text-[12px] font-medium text-accent hover:text-accent-hover transition-colors">View all →</Link>
          </div>
          {upcoming.length > 0 ? upcoming.map((r, i) => (
            <Link key={i} href={`/reservations?guest=${encodeURIComponent(r.guest)}`} className="block py-2.5 border-t border-[#f3f3f3] hover:bg-[#f9f9f9] rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[14px] font-medium text-text-primary">{r.guest}</p>
                <span className="text-[14px] font-semibold text-text-primary">{r.amount}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-tertiary">{r.property} · {r.dates}</p>
                <ChannelBadge channel={r.channel} />
              </div>
            </Link>
          )) : (
            <p className="text-[13px] text-text-tertiary py-4 text-center border-t border-[#f3f3f3]">No upcoming reservations</p>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <h3 className="text-[15px] font-semibold text-text-primary mb-4">Payment summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: "Balance", value: payment.balance, desc: "Unpaid from completed reservations", icon: "wallet", bg: "bg-[#F6F1E6]", stroke: "#8A6A2E" },
          { label: "Paid this month", value: payment.paidThisMonth, desc: "Total transferred this month", icon: "check", bg: "bg-[#EAF3EF]", stroke: "#2F6B57" },
          { label: "Pending payment", value: payment.pending, desc: "Scheduled but not yet sent", icon: "clock", bg: "bg-[#EEF1F5]", stroke: "#5E6673" },
        ].map((p, i) => (
          <Link key={i} href="/earnings" className="bg-white border border-[#eaeaea] rounded-xl p-5 hover:shadow-sm hover:border-[#ddd] transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.bg}`}>
                {p.icon === "wallet" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.stroke} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>}
                {p.icon === "check" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.stroke} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
                {p.icon === "clock" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.stroke} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              </div>
              <span className="text-[13px] font-medium text-text-secondary">{p.label}</span>
            </div>
            <p className="text-[26px] font-bold text-text-primary tracking-[-0.5px] mb-1">{p.value}</p>
            <p className="text-[12px] text-text-tertiary">{p.desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
