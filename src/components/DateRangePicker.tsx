"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 4 weeks", days: 28 },
  { label: "Month to date", days: -1 },
  { label: "All time", days: -2 },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtDisplay(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad(m)} / ${pad(d)} / ${y}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);

  // Calendar view state — left month
  const [viewYear, setViewYear] = useState(() => {
    if (from) { const [y] = from.split("-").map(Number); return y; }
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (from) { const [, m] = from.split("-").map(Number); return m - 1; }
    // Show previous month on left
    const m = today.getMonth() - 1;
    return m < 0 ? 11 : m;
  });

  // Temporary selection state
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);
  const [activePreset, setActivePreset] = useState("");

  useEffect(() => {
    if (open) { setTempFrom(from); setTempTo(to); }
  }, [open, from, to]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Right month
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(dateStr);
      setTempTo("");
      setActivePreset("");
    } else {
      if (dateStr < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(dateStr);
      } else {
        setTempTo(dateStr);
      }
      setActivePreset("");
    }
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.label);
    const now = new Date();
    if (preset.days === 0) {
      // Today
      const d = fmt(now);
      setTempFrom(d);
      setTempTo(d);
    } else if (preset.days === -1) {
      // Month to date
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setTempFrom(fmt(start));
      setTempTo(fmt(now));
    } else if (preset.days === -2) {
      // All time
      setTempFrom("");
      setTempTo("");
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - preset.days);
      setTempFrom(fmt(start));
      setTempTo(fmt(now));
    }
  };

  const handleApply = useCallback(() => {
    onFromChange(tempFrom);
    onToChange(tempTo);
    setOpen(false);
  }, [tempFrom, tempTo, onFromChange, onToChange]);

  const handleClear = () => {
    setTempFrom("");
    setTempTo("");
    setActivePreset("");
    onFromChange("");
    onToChange("");
    setOpen(false);
  };

  const isInRange = (dateStr: string) => {
    if (!tempFrom || !tempTo) return false;
    return dateStr > tempFrom && dateStr < tempTo;
  };
  const isStart = (dateStr: string) => dateStr === tempFrom;
  const isEnd = (dateStr: string) => dateStr === tempTo;
  const isToday = (dateStr: string) => dateStr === fmt(today);

  function renderMonth(year: number, month: number) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="w-[220px]">
        <div className="text-center text-[13px] font-semibold text-[#333] mb-3">
          {MONTH_NAMES[month]} {year} <span className="text-[#bbb]">&#9662;</span>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-[#aaa] py-1">{d}</div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`e${i}`} />;
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const start = isStart(dateStr);
            const end = isEnd(dateStr);
            const inRange = isInRange(dateStr);
            const todayD = isToday(dateStr);

            let bg = "";
            let text = "text-[#333]";
            let roundedL = "rounded-full";
            let rangeBg = "";

            if (start || end) {
              bg = "bg-[#80020E]";
              text = "text-white";
              roundedL = start && end ? "rounded-full" : start ? "rounded-l-full" : "rounded-r-full";
            } else if (inRange) {
              rangeBg = "bg-[#80020E]/10";
              text = "text-[#80020E]";
              roundedL = "";
            } else if (todayD) {
              bg = "bg-[#f0f0f0]";
              roundedL = "rounded-full";
            }

            return (
              <div key={dateStr} className={`relative ${rangeBg}`}>
                {inRange && start && <div className="absolute inset-y-0 right-0 w-1/2 bg-[#80020E]/10" />}
                <button
                  onClick={() => handleDayClick(dateStr)}
                  className={`relative z-10 w-full aspect-square flex items-center justify-center text-[12px] font-medium ${bg} ${text} ${roundedL} hover:bg-[#80020E]/20 hover:text-[#80020E] transition-colors`}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const displayLabel = from && to
    ? `${fmtDisplay(from)} – ${fmtDisplay(to)}`
    : from
    ? `From ${fmtDisplay(from)}`
    : to
    ? `Until ${fmtDisplay(to)}`
    : "Select dates";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="dropdown-trigger min-w-[150px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[#999] flex-shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className="text-[13px] truncate">{displayLabel}</span>
        {(from || to) && (
          <button
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="p-0.5 text-[#999] hover:text-[#555] transition-colors flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-[#e2e2e2] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] z-50 p-0 flex">
          {/* Presets */}
          <div className="w-[130px] border-r border-[#f0f0f0] py-3 flex-shrink-0">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className={`w-full text-left px-4 py-2 text-[12px] font-medium transition-colors ${
                  activePreset === preset.label
                    ? "text-[#80020E] bg-[#80020E]/5"
                    : "text-[#555] hover:text-[#80020E] hover:bg-[#fafafa]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar area */}
          <div className="p-4">
            {/* Start / End display */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#999] font-medium">Start</span>
                <span className="text-[13px] font-medium text-[#333] border border-[#e2e2e2] rounded-lg px-3 py-1.5 min-w-[120px]">
                  {tempFrom ? fmtDisplay(tempFrom) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#999] font-medium">End</span>
                <span className="text-[13px] font-medium text-[#333] border border-[#e2e2e2] rounded-lg px-3 py-1.5 min-w-[120px]">
                  {tempTo ? fmtDisplay(tempTo) : "—"}
                </span>
              </div>
            </div>

            {/* Two-month calendar */}
            <div className="flex items-start gap-6">
              {/* Left nav */}
              <button onClick={prevMonth} className="mt-0.5 p-1 text-[#999] hover:text-[#333] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              {renderMonth(viewYear, viewMonth)}
              {renderMonth(rightYear, rightMonth)}

              {/* Right nav */}
              <button onClick={nextMonth} className="mt-0.5 p-1 text-[#999] hover:text-[#333] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#f0f0f0]">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-[12px] font-medium text-[#999] hover:text-[#555] transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 bg-[#80020E] text-white rounded-lg text-[12px] font-semibold hover:bg-[#6b010c] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
