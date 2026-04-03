"use client";
import { useState, useEffect } from "react";

interface ExportFilter {
  label: string;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  filters: ExportFilter[];
  recordCount: number;
  onExport: (format: "csv" | "pdf", options: { headers: boolean; currency: boolean }) => void;
}

export default function ExportModal({ open, onClose, filters, recordCount, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [headers, setHeaders] = useState(true);
  const [currency, setCurrency] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  const estimatedSize = format === "csv"
    ? `~${Math.max(1, Math.round(recordCount * 0.15))} KB`
    : `~${Math.max(1, Math.round(recordCount * 0.5))} KB`;

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      onExport(format, { headers, currency });
      setExporting(false);
      onClose();
    }, 400);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
        {/* Modal */}
        <div className="bg-[#faf8f6] rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div>
              <h2 className="text-[17px] font-bold text-[#111]">Export data</h2>
              <p className="text-[13px] text-[#888] mt-0.5">Based on your current filters</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-[#e2e2e2] bg-white flex items-center justify-center text-[#999] hover:text-[#555] hover:border-[#ccc] transition-colors flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Active Filters */}
            {filters.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-2">Active Filters</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {filters.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#e8e8e8] text-[11px] font-medium text-[#555]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#80020E]" />
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Format */}
            <div>
              <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-2">Format</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setFormat("csv")}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    format === "csv"
                      ? "border-[#80020E] bg-[#80020E]/[0.03]"
                      : "border-[#e8e8e8] bg-white hover:border-[#d0d0d0]"
                  }`}>
                  {format === "csv" && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#80020E] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-lg bg-[#80020E]/10 flex items-center justify-center mb-2.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#80020E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="text-[13px] font-semibold text-[#111]">CSV</div>
                  <div className="text-[11px] text-[#888] mt-0.5 leading-snug">Spreadsheet format, ready to open in Excel</div>
                </button>

                <button onClick={() => setFormat("pdf")}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    format === "pdf"
                      ? "border-[#80020E] bg-[#80020E]/[0.03]"
                      : "border-[#e8e8e8] bg-white hover:border-[#d0d0d0]"
                  }`}>
                  {format === "pdf" && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#80020E] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-lg bg-[#EEF1F5] flex items-center justify-center mb-2.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="text-[13px] font-semibold text-[#111]">PDF</div>
                  <div className="text-[11px] text-[#888] mt-0.5 leading-snug">Formatted report, ready to share or print</div>
                </button>
              </div>
            </div>

            {/* Options */}
            <div>
              <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-2">Options</div>
              <div className="bg-white rounded-xl border border-[#e8e8e8] divide-y divide-[#f3f3f3]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-[#111]">Include column headers</div>
                    <div className="text-[11px] text-[#999] mt-0.5">First row contains field names</div>
                  </div>
                  <button onClick={() => setHeaders(!headers)}
                    className={`relative w-[42px] h-[24px] rounded-full transition-colors flex-shrink-0 ${headers ? "bg-[#80020E]" : "bg-[#ddd]"}`}>
                    <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${headers ? "left-[21px]" : "left-[3px]"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-[#111]">Apply currency formatting</div>
                    <div className="text-[11px] text-[#999] mt-0.5">Format numbers as €1,234.56</div>
                  </div>
                  <button onClick={() => setCurrency(!currency)}
                    className={`relative w-[42px] h-[24px] rounded-full transition-colors flex-shrink-0 ${currency ? "bg-[#80020E]" : "bg-[#ddd]"}`}>
                    <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${currency ? "left-[21px]" : "left-[3px]"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-[12px] text-[#888] px-1">
              <span>{recordCount} records</span>
              <span>{estimatedSize}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-[13px] font-medium text-[#999] hover:text-[#555] transition-colors">
              Cancel
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 h-[42px] px-5 rounded-xl bg-[#111] text-white text-[13px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-60">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exporting ? "Exporting..." : `Export ${recordCount} records`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
