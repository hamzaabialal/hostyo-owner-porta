"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ChannelBadge from "@/components/ChannelBadge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LinkedItem {
  type: "reservation" | "expense";
  ref: string;
  desc: string;
  channel?: string;
}

interface Payout {
  cycle: string;
  property: string;
  propShort: string;
  gross: number;
  deductions: number;
  net: number;
  status: "paid" | "upcoming" | "onhold" | "adjusted";
  scheduledDate: string;
  fees: number;
  expenses: number;
  holdReason: string | null;
  balance: number;
  linked: LinkedItem[];
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const payouts: Payout[] = [
  {
    cycle: "Mar 1\u201315, 2026", property: "The Kensington Residence", propShort: "Kensington",
    gross: 4500, deductions: -1278, net: 3222, status: "upcoming", scheduledDate: "Mar 20, 2026",
    fees: -780, expenses: -498, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0412", desc: "Guest: M. Thompson, Mar 2\u20138" , channel: "Airbnb" },
      { type: "reservation", ref: "RES-2026-0418", desc: "Guest: J. Kim, Mar 9\u201314" , channel: "Airbnb" },
      { type: "expense", ref: "EXP-2026-0087", desc: "Deep cleaning, Mar 8" },
    ],
  },
  {
    cycle: "Mar 1\u201315, 2026", property: "Villa Serena", propShort: "Villa Serena",
    gross: 6800, deductions: -2190, net: 4610, status: "onhold", scheduledDate: "\u2014",
    fees: -1020, expenses: -1170, holdReason: "Approved expenses exceed payoutable earnings for this cycle", balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0420", desc: "Guest: A. Rossi, Mar 1\u201310" , channel: "Vrbo" },
      { type: "reservation", ref: "RES-2026-0425", desc: "Guest: L. Dubois, Mar 11\u201315" , channel: "Booking.com" },
      { type: "expense", ref: "EXP-2026-0091", desc: "Pool maintenance, Mar 5" },
    ],
  },
  {
    cycle: "Mar 1\u201315, 2026", property: "Mayfair Studio", propShort: "Mayfair",
    gross: 2100, deductions: -620, net: 1480, status: "upcoming", scheduledDate: "Mar 20, 2026",
    fees: -315, expenses: -305, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0415", desc: "Guest: S. Patel, Mar 3\u201312" , channel: "Booking.com" },
      { type: "expense", ref: "EXP-2026-0089", desc: "Linen replacement, Mar 6" },
    ],
  },
  {
    cycle: "Feb 15\u201328, 2026", property: "The Kensington Residence", propShort: "Kensington",
    gross: 3800, deductions: -980, net: 2820, status: "paid", scheduledDate: "Mar 5, 2026",
    fees: -570, expenses: -410, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0380", desc: "Guest: R. Chen, Feb 16\u201322" , channel: "Booking.com" },
      { type: "reservation", ref: "RES-2026-0387", desc: "Guest: E. Wagner, Feb 23\u201327" , channel: "Airbnb" },
      { type: "expense", ref: "EXP-2026-0078", desc: "HVAC repair, Feb 18" },
    ],
  },
  {
    cycle: "Feb 15\u201328, 2026", property: "Villa Serena", propShort: "Villa Serena",
    gross: 5400, deductions: -1800, net: 3600, status: "paid", scheduledDate: "Mar 5, 2026",
    fees: -810, expenses: -990, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0382", desc: "Guest: P. Moreau, Feb 15\u201324" , channel: "Airbnb" },
      { type: "reservation", ref: "RES-2026-0390", desc: "Guest: K. Novak, Feb 25\u201328" , channel: "Expedia" },
      { type: "expense", ref: "EXP-2026-0080", desc: "Garden service, Feb 20" },
    ],
  },
  {
    cycle: "Feb 15\u201328, 2026", property: "Mayfair Studio", propShort: "Mayfair",
    gross: 1900, deductions: -540, net: 1360, status: "adjusted", scheduledDate: "Mar 5, 2026",
    fees: -285, expenses: -255, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0385", desc: "Guest: D. Santos, Feb 17\u201325" , channel: "Airbnb" },
      { type: "expense", ref: "EXP-2026-0082", desc: "Appliance repair, Feb 22" },
      { type: "expense", ref: "EXP-2026-0084", desc: "Late checkout refund adjustment" },
    ],
  },
  {
    cycle: "Feb 1\u201314, 2026", property: "The Kensington Residence", propShort: "Kensington",
    gross: 2950, deductions: -750, net: 2200, status: "paid", scheduledDate: "Feb 20, 2026",
    fees: -442, expenses: -308, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0350", desc: "Guest: H. Tanaka, Feb 2\u20138" , channel: "Airbnb" },
      { type: "reservation", ref: "RES-2026-0358", desc: "Guest: C. Brown, Feb 9\u201313" , channel: "Airbnb" },
      { type: "expense", ref: "EXP-2026-0070", desc: "Cleaning supplies, Feb 4" },
    ],
  },
  {
    cycle: "Feb 1\u201314, 2026", property: "Villa Serena", propShort: "Villa Serena",
    gross: 4200, deductions: -1400, net: 2800, status: "paid", scheduledDate: "Feb 20, 2026",
    fees: -630, expenses: -770, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0352", desc: "Guest: M. Garcia, Feb 1\u201310" , channel: "Booking.com" },
      { type: "reservation", ref: "RES-2026-0360", desc: "Guest: A. Smith, Feb 11\u201314" , channel: "Booking.com" },
      { type: "expense", ref: "EXP-2026-0072", desc: "Landscaping, Feb 7" },
    ],
  },
  {
    cycle: "Feb 1\u201314, 2026", property: "Mayfair Studio", propShort: "Mayfair",
    gross: 2300, deductions: -680, net: 1620, status: "paid", scheduledDate: "Feb 20, 2026",
    fees: -345, expenses: -335, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0355", desc: "Guest: O. Muller, Feb 3\u201311" , channel: "Airbnb" },
      { type: "expense", ref: "EXP-2026-0074", desc: "Key replacement, Feb 6" },
    ],
  },
  {
    cycle: "Jan 15\u201331, 2026", property: "The Kensington Residence", propShort: "Kensington",
    gross: 3100, deductions: -820, net: 2280, status: "paid", scheduledDate: "Feb 5, 2026",
    fees: -465, expenses: -355, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0310", desc: "Guest: F. Johnson, Jan 16\u201324" , channel: "Booking.com" },
      { type: "reservation", ref: "RES-2026-0318", desc: "Guest: V. Petrov, Jan 25\u201330" , channel: "Expedia" },
      { type: "expense", ref: "EXP-2026-0060", desc: "Plumbing repair, Jan 20" },
    ],
  },
  {
    cycle: "Jan 15\u201331, 2026", property: "Villa Serena", propShort: "Villa Serena",
    gross: 5800, deductions: -1900, net: 3900, status: "paid", scheduledDate: "Feb 5, 2026",
    fees: -870, expenses: -1030, holdReason: null, balance: 0,
    linked: [
      { type: "reservation", ref: "RES-2026-0312", desc: "Guest: I. Nakamura, Jan 15\u201325" , channel: "Booking.com" },
      { type: "reservation", ref: "RES-2026-0320", desc: "Guest: B. Williams, Jan 26\u201331" , channel: "Expedia" },
      { type: "expense", ref: "EXP-2026-0063", desc: "Heating system service, Jan 22" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmt(n: number): string {
  const abs = Math.abs(n);
  const str = "\u00a3" + abs.toLocaleString("en-GB");
  return n < 0 ? "-" + str : str;
}

function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    paid: "pill pill-paid",
    upcoming: "pill pill-upcoming",
    onhold: "pill pill-onhold",
    adjusted: "pill pill-adjusted",
  };
  return map[status] || "pill";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    paid: "Paid",
    upcoming: "Upcoming",
    onhold: "On Hold",
    adjusted: "Adjusted",
  };
  return map[status] || status;
}

/* ------------------------------------------------------------------ */
/*  Sub-navigation                                                     */
/* ------------------------------------------------------------------ */
function SubTabs({ active }: { active: string }) {
  const tabs = [
    { label: "Overview", href: "/earnings" },
    { label: "Payouts", href: "/earnings/payouts" },
    { label: "Reports", href: "/earnings/reports" },
  ];
  return (
    <div className="flex gap-7 px-8 bg-white border-b border-[#eaeaea] -mx-8 -mt-8 mb-7">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`inline-block py-3.5 text-sm font-medium border-b-2 transition-colors ${
            t.label === active
              ? "text-[#80020E] font-semibold border-[#80020E]"
              : "text-[#999] border-transparent hover:text-[#555]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawer                                                             */
/* ------------------------------------------------------------------ */
function PayoutDrawer({
  payout,
  onClose,
}: {
  payout: Payout | null;
  onClose: () => void;
}) {
  const isOpen = payout !== null;

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!payout) {
    return (
      <>
        <div className={`drawer-overlay`} />
        <div className={`drawer-panel`} />
      </>
    );
  }

  const p = payout;

  return (
    <>
      {/* Overlay */}
      <div className={`drawer-overlay ${isOpen ? "open" : ""}`} onClick={onClose} />

      {/* Panel */}
      <div className={`drawer-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eaeaea]">
          <span className="text-[17px] font-bold text-[#111]">Payout Details</span>
          <button
            onClick={onClose}
            className="w-[34px] h-[34px] rounded-lg border border-[#eaeaea] bg-white flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px] text-[#555]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Summary */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Summary</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#999] font-medium">Payout Cycle</span>
                <span className="text-sm text-[#111] font-semibold">{p.cycle}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#999] font-medium">Property</span>
                <span className="text-sm text-[#111] font-semibold">{p.property}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#999] font-medium">Status</span>
                <span className="text-sm"><span className={statusPillClass(p.status)}>{statusLabel(p.status)}</span></span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#999] font-medium">
                  {p.status === "paid" ? "Paid Date" : "Scheduled Date"}
                </span>
                <span className="text-sm text-[#111] font-semibold">{p.scheduledDate}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Financial Breakdown</div>
            <div className="bg-[#f8f8f8] border border-[#eaeaea] rounded-xl px-5 py-[18px]">
              <div className="flex justify-between items-center py-2 border-b border-[#eee]">
                <span className="text-sm text-[#555] font-medium">Gross Earnings</span>
                <span className="text-sm font-semibold text-[#111]">{fmt(p.gross)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#eee]">
                <span className="text-sm text-[#555] font-medium">Fees Deducted</span>
                <span className="text-sm font-semibold text-[#c0392b]">{fmt(p.fees)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#eee]">
                <span className="text-sm text-[#555] font-medium">Expenses Deducted</span>
                <span className="text-sm font-semibold text-[#c0392b]">{fmt(p.expenses)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-[#555] font-medium">Final Payout Amount</span>
                <span className="text-base font-bold text-[#80020E]">{fmt(p.net)}</span>
              </div>
            </div>
          </div>

          {/* Hold Reason (conditional) */}
          {p.status === "onhold" && p.holdReason && (
            <div className="mb-6">
              <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Hold Reason</div>
              <div className="bg-[#fff3e0] border border-[#ffe0b2] rounded-xl px-[18px] py-3.5 flex gap-2.5 items-start text-[13px] text-[#e65100] leading-relaxed">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-5 h-5 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>{p.holdReason}</span>
              </div>
            </div>
          )}

          {/* Balance Impact */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Balance Impact</div>
            <div className="bg-[#f8f8f8] border border-[#eaeaea] rounded-xl px-[18px] py-3.5 text-sm text-[#555]">
              Outstanding balance created: <strong className="text-[#111]">{fmt(p.balance)}</strong>
            </div>
          </div>

          {/* Linked Items */}
          <div>
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Linked Items</div>
            <ul className="list-none">
              {p.linked.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 py-2 border-b border-[#f3f3f3] last:border-b-0 text-[13px] text-[#555]"
                >
                  {item.type === "reservation" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4 shrink-0 text-[#999]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4 shrink-0 text-[#999]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z" />
                    </svg>
                  )}
                  <span className="flex-1 min-w-0">
                    <strong className="text-[#111]">{item.ref}</strong> &middot; {item.desc}
                  </span>
                  <span className="flex items-center gap-2 ml-auto flex-shrink-0">
                    {item.type === "reservation" && item.channel && (
                      <ChannelBadge channel={item.channel} compact />
                    )}
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.type === "reservation"
                          ? "bg-[#e3f2fd] text-[#1565c0]"
                          : "bg-[#fff3e0] text-[#e65100]"
                      }`}
                    >
                      {item.type === "reservation" ? "Reservation" : "Expense"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function EarningsPayoutsPage() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const closeDrawer = useCallback(() => setSelectedIndex(null), []);

  return (
    <AppShell title="Earnings">
      <SubTabs active="Payouts" />

      {/* Payouts table */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
        <div className="text-[15px] font-semibold text-[#111] mb-5">Payouts</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Payout Cycle", "Property", "Gross Earnings", "Total Deductions", "Net Payout", "Status", "Scheduled Date"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[#999] uppercase tracking-wide px-3 pb-3 border-b border-[#eaeaea] whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, i) => (
              <tr
                key={i}
                onClick={() => setSelectedIndex(i)}
                className="border-b border-[#f3f3f3] last:border-b-0 cursor-pointer transition-colors hover:bg-[#fafafa]"
              >
                <td className="px-3 py-3.5 text-sm text-[#111]">{p.cycle}</td>
                <td className="px-3 py-3.5 text-sm font-semibold text-[#111]">{p.propShort}</td>
                <td className="px-3 py-3.5 text-sm text-[#111]">{fmt(p.gross)}</td>
                <td className="px-3 py-3.5 text-sm text-[#c0392b]">{fmt(p.deductions)}</td>
                <td className="px-3 py-3.5 text-sm font-bold text-[#111]">{fmt(p.net)}</td>
                <td className="px-3 py-3.5 text-sm">
                  <span className={statusPillClass(p.status)}>{statusLabel(p.status)}</span>
                </td>
                <td className="px-3 py-3.5 text-sm text-[#555]">{p.scheduledDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <PayoutDrawer
        payout={selectedIndex !== null ? payouts[selectedIndex] : null}
        onClose={closeDrawer}
      />
    </AppShell>
  );
}
