"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import FilterDropdown from "@/components/FilterDropdown";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ArchiveRow {
  report: string;
  property: string;
  period: string;
  generated: string;
  fileType: "PDF" | "CSV";
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const archiveRows: ArchiveRow[] = [
  { report: "Monthly Statement \u2014 February 2026", property: "All Properties", period: "Feb 2026", generated: "Mar 1, 2026", fileType: "PDF" },
  { report: "Monthly Statement \u2014 January 2026", property: "All Properties", period: "Jan 2026", generated: "Feb 1, 2026", fileType: "PDF" },
  { report: "Property Report \u2014 Kensington", property: "Kensington", period: "Q4 2025", generated: "Jan 5, 2026", fileType: "PDF" },
  { report: "CSV Export \u2014 All Reservations", property: "All Properties", period: "2025", generated: "Jan 2, 2026", fileType: "CSV" },
  { report: "Monthly Statement \u2014 December 2025", property: "All Properties", period: "Dec 2025", generated: "Jan 1, 2026", fileType: "PDF" },
  { report: "Property Report \u2014 Villa Serena", property: "Villa Serena", period: "Q4 2025", generated: "Jan 5, 2026", fileType: "PDF" },
  { report: "Monthly Statement \u2014 November 2025", property: "All Properties", period: "Nov 2025", generated: "Dec 1, 2025", fileType: "PDF" },
  { report: "Monthly Statement \u2014 October 2025", property: "All Properties", period: "Oct 2025", generated: "Nov 1, 2025", fileType: "PDF" },
];

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
/*  Toast component                                                    */
/* ------------------------------------------------------------------ */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`toast ${visible ? "show" : ""} flex items-center gap-2.5`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px] text-[#4caf50] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function EarningsReportsPage() {
  const [reportType, setReportType] = useState("Monthly Statement");
  const [reportProperty, setReportProperty] = useState("All Properties");
  const [dateFrom, setDateFrom] = useState("2026-01");
  const [dateTo, setDateTo] = useState("2026-02");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  return (
    <AppShell title="Earnings">
      <SubTabs active="Reports" />

      {/* Generate Report */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6 mb-6">
        <div className="text-[15px] font-semibold text-[#111] mb-5">Generate Report</div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#555]">
              Report Type
            </label>
            <FilterDropdown
              value={reportType}
              onChange={setReportType}
              placeholder="Monthly Statement"
              options={[
                { value: "Monthly Statement", label: "Monthly Statement" },
                { value: "CSV Export", label: "CSV Export" },
                { value: "Property Report", label: "Property Report" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#555]">
              Property
            </label>
            <FilterDropdown
              value={reportProperty}
              onChange={setReportProperty}
              placeholder="All Properties"
              options={[
                { value: "Kensington", label: "Kensington" },
                { value: "Villa Serena", label: "Villa Serena" },
                { value: "Mayfair", label: "Mayfair" },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date-from" className="text-[13px] font-medium text-[#555]">
              From
            </label>
            <input
              type="month"
              id="date-from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 px-3.5 border border-[#ddd] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date-to" className="text-[13px] font-medium text-[#555]">
              To
            </label>
            <input
              type="month"
              id="date-to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 px-3.5 border border-[#ddd] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => showToast("Report generated successfully")}
            className="h-10 px-[22px] bg-[#80020E] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-[#6b010c] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Generate PDF
          </button>
          <button
            onClick={() => showToast("CSV exported")}
            className="h-10 px-[22px] bg-white text-[#80020E] border-2 border-[#80020E] rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-[#fdf0f0] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Archive */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6">
        <div className="text-[15px] font-semibold text-[#111] mb-5">Report Archive</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Report", "Property", "Period", "Generated", "Actions"].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-[#999] uppercase tracking-wide px-3 pb-3 border-b border-[#eaeaea] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {archiveRows.map((r, i) => (
              <tr key={i} className="border-b border-[#f3f3f3] last:border-b-0">
                <td className="px-3 py-3.5 text-sm font-semibold text-[#111]">{r.report}</td>
                <td className="px-3 py-3.5 text-sm text-[#111]">{r.property}</td>
                <td className="px-3 py-3.5 text-sm text-[#111]">{r.period}</td>
                <td className="px-3 py-3.5 text-sm text-[#555]">{r.generated}</td>
                <td className="px-3 py-3.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                        r.fileType === "PDF"
                          ? "bg-[#fce4ec] text-[#c62828]"
                          : "bg-[#e8f5e9] text-[#2e7d32]"
                      }`}
                    >
                      {r.fileType}
                    </span>
                    <button
                      onClick={() => showToast("Downloading report...")}
                      title={`Download ${r.fileType}`}
                      className="w-[34px] h-[34px] rounded-lg border border-[#eaeaea] bg-white flex items-center justify-center cursor-pointer hover:bg-[#f5f5f5] hover:border-[#ccc] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4 text-[#555]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} />
    </AppShell>
  );
}
