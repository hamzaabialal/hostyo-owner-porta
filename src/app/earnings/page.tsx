"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SummaryCard {
  label: string;
  value: string;
  badge?: string;
  badgeClass?: string;
}

interface PropertyRow {
  property: string;
  revenue: string;
  fees: string;
  expenses: string;
  net: string;
  payoutStatus: "Paid" | "Upcoming";
  ownerBalance: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const summaryCards: SummaryCard[] = [
  { label: "Gross Revenue", value: "\u00a327,450" },
  { label: "Net Owner Earnings", value: "\u00a318,240" },
  { label: "Paid Out", value: "\u00a314,018" },
  { label: "Upcoming Payouts", value: "\u00a34,222" },
  { label: "On Hold Amount", value: "\u00a30", badge: "Nothing held", badgeClass: "pill-paid" },
  { label: "Outstanding Owner Balance", value: "\u00a30", badge: "Fully settled", badgeClass: "pill-paid" },
];

const trendData = [
  { month: "Oct", value: 2480 },
  { month: "Nov", value: 3120 },
  { month: "Dec", value: 3860 },
  { month: "Jan", value: 2940 },
  { month: "Feb", value: 3410 },
  { month: "Mar", value: 3430 },
];

const distributionData = [
  { label: "Paid", value: 14018, color: "#27ae60", percent: 76.9 },
  { label: "Upcoming", value: 4222, color: "#3b82f6", percent: 23.1 },
  { label: "On Hold", value: 0, color: "#f39c12", percent: 0 },
];

const propertyRows: PropertyRow[] = [
  { property: "The Kensington Residence", revenue: "\u00a38,450", fees: "-\u00a31,267", expenses: "-\u00a3890", net: "\u00a36,293", payoutStatus: "Upcoming", ownerBalance: "\u00a30" },
  { property: "Villa Serena", revenue: "\u00a314,200", fees: "-\u00a32,130", expenses: "-\u00a31,860", net: "\u00a310,210", payoutStatus: "Paid", ownerBalance: "\u00a30" },
  { property: "Mayfair Studio", revenue: "\u00a34,800", fees: "-\u00a3720", expenses: "-\u00a3700", net: "\u00a33,380", payoutStatus: "Upcoming", ownerBalance: "\u00a30" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const trendMax = Math.max(...trendData.map((d) => d.value));

function statusPillClass(status: string): string {
  return status === "Paid" ? "pill pill-paid" : "pill pill-upcoming";
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function EarningsOverviewPage() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  return (
    <AppShell title="Earnings">
      <SubTabs active="Overview" />

      {/* Summary cards 3x2 */}
      <div className="grid grid-cols-3 gap-[18px] mb-7">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-[#eaeaea] rounded-xl px-6 py-[22px]"
          >
            <div className="text-[13px] font-medium text-[#555] mb-2">{card.label}</div>
            <div className="text-[26px] font-bold text-[#111] tracking-tight">{card.value}</div>
            {card.badge && (
              <span className={`${card.badgeClass} mt-2 inline-block`}>{card.badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-[18px] mb-7">
        {/* Earnings Trend - CSS bar chart */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
          <div className="text-[15px] font-semibold text-[#111] mb-5">Earnings Trend</div>
          <div className="flex items-end gap-3 h-[220px]">
            {trendData.map((d, i) => {
              const heightPct = (d.value / trendMax) * 100;
              return (
                <div
                  key={d.month}
                  className="flex-1 flex flex-col items-center gap-2"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div className="relative flex-1 w-full flex items-end justify-center">
                    {hoveredBar === i && (
                      <div className="absolute -top-7 bg-[#111] text-white text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap z-10">
                        {"\u00a3"}{d.value.toLocaleString()}
                      </div>
                    )}
                    <div
                      className="w-full max-w-[40px] rounded-t-md transition-all duration-200"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: hoveredBar === i ? "#6b010c" : "#80020E",
                        opacity: hoveredBar === i ? 1 : 0.85,
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#999] font-medium">{d.month}</span>
                </div>
              );
            })}
          </div>
          {/* Trend line overlay */}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-4 h-[3px] rounded bg-[#80020E]" />
            <span className="text-xs text-[#999]">Net Earnings</span>
          </div>
        </div>

        {/* Paid vs Upcoming vs On Hold - horizontal bars */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
          <div className="text-[15px] font-semibold text-[#111] mb-5">Paid vs Upcoming vs On Hold</div>
          <div className="flex flex-col gap-5 mt-4">
            {distributionData.map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm font-medium text-[#555]">{d.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#111]">
                    {"\u00a3"}{d.value.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-3 bg-[#f3f3f3] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.percent}%`, backgroundColor: d.color }}
                  />
                </div>
                <div className="text-right mt-0.5">
                  <span className="text-[11px] text-[#999]">{d.percent}%</span>
                </div>
              </div>
            ))}
          </div>
          {/* Total */}
          <div className="mt-4 pt-4 border-t border-[#eaeaea] flex items-center justify-between">
            <span className="text-sm font-medium text-[#555]">Total</span>
            <span className="text-base font-bold text-[#111]">
              {"\u00a3"}{distributionData.reduce((s, d) => s + d.value, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Property Breakdown */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
        <div className="text-[15px] font-semibold text-[#111] mb-5">Per-Property Breakdown</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Property", "Revenue", "Fees", "Expenses", "Net Earnings", "Payout Status", "Owner Balance"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[#999] uppercase tracking-wide px-3 pb-3 border-b border-[#eaeaea]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {propertyRows.map((r) => (
              <tr key={r.property} className="border-b border-[#f3f3f3] last:border-b-0">
                <td className="px-3 py-3.5 text-sm font-semibold text-[#111]">{r.property}</td>
                <td className="px-3 py-3.5 text-sm text-[#111]">{r.revenue}</td>
                <td className="px-3 py-3.5 text-sm text-[#c0392b]">{r.fees}</td>
                <td className="px-3 py-3.5 text-sm text-[#c0392b]">{r.expenses}</td>
                <td className="px-3 py-3.5 text-sm font-semibold text-[#111]">{r.net}</td>
                <td className="px-3 py-3.5 text-sm">
                  <span className={statusPillClass(r.payoutStatus)}>{r.payoutStatus}</span>
                </td>
                <td className="px-3 py-3.5 text-sm text-[#111]">{r.ownerBalance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
