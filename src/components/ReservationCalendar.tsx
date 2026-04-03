"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { getChannelIcon } from "./ChannelBadge";

interface CalendarReservation {
  id: number;
  guest: string;
  property: string;
  channel: string;
  checkIn: string;
  checkOut: string;
  status: string;
  ownerPayout: number;
}

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  "Airbnb": { bg: "#FF5A5F", text: "#fff" },
  "Booking.com": { bg: "#003580", text: "#fff" },
  "Expedia": { bg: "#FBAF17", text: "#333" },
  "VRBO": { bg: "#3B5998", text: "#fff" },
  "Agoda": { bg: "#5D2E8C", text: "#fff" },
  "Direct": { bg: "#80020E", text: "#fff" },
};

function getColor(channel: string) {
  for (const [key, colors] of Object.entries(CHANNEL_COLORS)) {
    if (channel.toLowerCase().includes(key.toLowerCase())) return colors;
  }
  return { bg: "#80020E", text: "#fff" };
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ================================================================ */
/*  MONTHLY GRID (single property) — responsive month count          */
/* ================================================================ */
function MonthGrid({ year, month, reservations, onTap, showNav, onPrev, onNext }: {
  year: number; month: number;
  reservations: CalendarReservation[];
  onTap: (r: CalendarReservation) => void;
  showNav?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const todayStr = toStr(new Date());
  const monthStr = `${year}-${pad(month + 1)}`;
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${pad(daysInMonth)}`;

  const active = reservations.filter((r) => {
    if (!r.checkIn || !r.checkOut || r.status === "Cancelled") return false;
    return r.checkIn <= monthEnd && r.checkOut > monthStart;
  });

  const dayRes = useMemo(() => {
    const map: Record<number, { r: CalendarReservation; isStart: boolean; span: number }[]> = {};
    for (const r of active) {
      const ci = new Date(r.checkIn + "T00:00:00");
      const co = new Date(r.checkOut + "T00:00:00");
      for (let d = 1; d <= daysInMonth; d++) {
        const cur = new Date(year, month, d);
        if (cur >= ci && cur < co) {
          if (!map[d]) map[d] = [];
          const isStart = cur.getTime() === ci.getTime();
          const isMonthStart = d === 1 && cur > ci; // Reservation spans from previous month
          const dayOfWeek = cur.getDay();
          const daysLeft = 7 - dayOfWeek;
          const daysUntilEnd = daysBetween(toStr(cur), r.checkOut);
          const daysUntilMonthEnd = daysInMonth - d + 1;
          const shouldRenderBar = isStart || dayOfWeek === 0 || isMonthStart;
          const span = shouldRenderBar ? Math.min(daysUntilEnd, daysLeft, daysUntilMonthEnd) : 0;
          map[d].push({ r, isStart: shouldRenderBar, span });
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, daysInMonth, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border border-[#eaeaea] rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-center py-2 border-b border-[#eaeaea] bg-[#fafafa] relative">
        {showNav && (
          <button onClick={onPrev} className="absolute left-2 p-1 rounded-lg text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <span className="text-[13px] font-semibold text-[#111]">{MONTHS[month]} {year}</span>
        {showNav && (
          <button onClick={onNext} className="absolute right-2 p-1 rounded-lg text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 border-b border-[#eaeaea]">
        {DOW.map((d, i) => (
          <div key={d} className={`text-center text-[9px] md:text-[10px] font-semibold py-1 ${i === 5 || i === 6 ? "text-[#FF5A5F]" : "text-[#999]"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} className="h-[60px] md:h-[70px] border-r border-b border-[#f0f0f0] bg-[#fafafa]/50" />;
          const dateStr = `${monthStr}-${pad(day)}`;
          const isT = dateStr === todayStr;
          const entries = dayRes[day] || [];
          return (
            <div key={day} className={`h-[60px] md:h-[70px] border-r border-b border-[#f0f0f0] relative overflow-visible ${isT ? "bg-[#80020E]/[0.03]" : ""}`}>
              <div className={`text-[9px] md:text-[10px] font-medium px-0.5 md:px-1 pt-0.5 ${isT ? "text-[#80020E] font-bold" : "text-[#777]"}`}>
                {isT ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#80020E] text-white text-[8px]">{day}</span> : day}
              </div>
              <div className="mt-0.5 space-y-0.5 px-0.5">
                {entries.filter((e) => e.isStart || new Date(year, month, day).getDay() === 0).slice(0, 2).map((entry) => {
                  const { bg, text } = getColor(entry.r.channel);
                  const nights = daysBetween(entry.r.checkIn, entry.r.checkOut);
                  const span = Math.max(1, entry.span);
                  return (
                    <button key={entry.r.id} onClick={() => onTap(entry.r)}
                      className="block text-left rounded px-0.5 md:px-1 py-0.5 text-[7px] md:text-[9px] font-semibold leading-tight truncate cursor-pointer hover:brightness-110 relative z-[1]"
                      style={{ backgroundColor: bg, color: text, width: `calc(${span * 100}% + ${(span - 1) * 1}px)` }}
                      title={`${entry.r.guest} · ${nights}N`}>
                      <span className="flex items-center gap-0.5 truncate">
                        <span className="hidden md:inline-flex flex-shrink-0 [&_img]:w-[10px] [&_img]:h-[10px] [&_svg]:w-[10px] [&_svg]:h-[10px]">{getChannelIcon(entry.r.channel)}</span>
                        {entry.r.guest.split(" ")[0]} · {nights}N
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================ */
/*  HORIZONTAL TIMELINE (all properties) — synced scroll             */
/* ================================================================ */
function TimelineView({ reservations, onTap, onPropertyTap, propertyImages }: {
  reservations: CalendarReservation[];
  onTap: (r: CalendarReservation) => void;
  onPropertyTap?: (propertyName: string) => void;
  propertyImages?: Record<string, string>;
}) {
  const today = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(-3);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const DAYS = 35;
  const ROW_H = 52;

  const propScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Sync vertical scroll between property list and timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineScrollRef.current && propScrollRef.current) {
      propScrollRef.current.scrollTop = timelineScrollRef.current.scrollTop;
    }
  }, []);

  const handlePropScroll = useCallback(() => {
    if (propScrollRef.current && timelineScrollRef.current) {
      timelineScrollRef.current.scrollTop = propScrollRef.current.scrollTop;
    }
  }, []);

  // Scroll to start (left edge) on mount
  useEffect(() => {
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = 0;
    }
  }, [offset]);

  useEffect(() => {
    const timeline = timelineScrollRef.current;
    const propList = propScrollRef.current;
    if (timeline) timeline.addEventListener("scroll", handleTimelineScroll);
    if (propList) propList.addEventListener("scroll", handlePropScroll);
    return () => {
      if (timeline) timeline.removeEventListener("scroll", handleTimelineScroll);
      if (propList) propList.removeEventListener("scroll", handlePropScroll);
    };
  }, [handleTimelineScroll, handlePropScroll]);

  const dayCols = useMemo(() => {
    const cols: { str: string; day: number; dow: string; month: string; isToday: boolean; isWeekend: boolean }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today); d.setDate(d.getDate() + offset + i);
      cols.push({
        str: toStr(d), day: d.getDate(),
        dow: d.toLocaleDateString("en-GB", { weekday: "short" }),
        month: d.toLocaleDateString("en-GB", { month: "short" }),
        isToday: d.toDateString() === today.toDateString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return cols;
  }, [today, offset]);

  const rangeStart = dayCols[0].str;
  const rangeEnd = dayCols[DAYS - 1].str;

  const allProps = useMemo(() => Array.from(new Set(reservations.map((r) => r.property))).sort(), [reservations]);

  const resMap = useMemo(() => {
    const map: Record<string, CalendarReservation[]> = {};
    for (const r of reservations) {
      if (!r.checkIn || !r.checkOut || r.status === "Cancelled") continue;
      if (r.checkIn > rangeEnd || r.checkOut <= rangeStart) continue;
      if (!map[r.property]) map[r.property] = [];
      map[r.property].push(r);
    }
    return map;
  }, [reservations, rangeStart, rangeEnd]);

  return (
    <div className="border border-[#eaeaea] rounded-xl bg-white flex flex-col" style={{ height: "calc(100vh - 200px)", minHeight: "400px", overflow: "hidden" }}>
      {/* Nav — Today + Month picker only, no scroll arrows */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#eaeaea] bg-[#fafafa] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(-3)} className="px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[11px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-colors">Today</button>

          {/* Month/Year dropdown */}
          <div className="relative ml-2">
            <button onClick={() => setMonthPickerOpen(!monthPickerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[13px] font-semibold text-[#111] hover:border-[#ccc] transition-colors">
              {(() => {
                const startD = new Date(today);
                startD.setDate(startD.getDate() + offset);
                return `${MONTHS[startD.getMonth()]} ${startD.getFullYear()}`;
              })()}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#999]"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {monthPickerOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e2e2] rounded-xl shadow-lg z-50 p-3 w-[260px]">
                {/* Year selector */}
                {(() => {
                  const currentYear = new Date(today.getTime() + offset * 86400000).getFullYear();
                  const years = [currentYear - 1, currentYear, currentYear + 1];
                  return (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-3">
                        {years.map((y) => (
                          <button key={y} className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${
                            y === currentYear ? "bg-[#80020E] text-white" : "text-[#555] hover:bg-[#f5f5f5]"
                          }`} onClick={() => {
                            const target = new Date(y, new Date(today.getTime() + offset * 86400000).getMonth(), 1);
                            const diff = Math.floor((target.getTime() - today.getTime()) / 86400000);
                            setOffset(diff);
                          }}>{y}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {MONTHS.map((m, i) => {
                          const isActive = i === new Date(today.getTime() + offset * 86400000).getMonth() && currentYear === new Date(today.getTime() + offset * 86400000).getFullYear();
                          return (
                            <button key={m} onClick={() => {
                              const target = new Date(currentYear, i, 1);
                              const diff = Math.floor((target.getTime() - today.getTime()) / 86400000);
                              setOffset(diff);
                              setMonthPickerOpen(false);
                            }} className={`px-2 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                              isActive ? "bg-[#80020E] text-white" : "text-[#555] hover:bg-[#f5f5f5]"
                            }`}>{m.slice(0, 3)}</button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content — property list fixed left, timeline scrolls horizontally */}
      <div className="flex flex-1 min-h-0">
        {/* Property column (fixed, only vertical scroll) */}
        <div className="flex-shrink-0 w-[200px] border-r border-[#eaeaea] bg-white z-10 flex flex-col">
          <div className="h-[46px] px-3 flex items-end pb-1.5 border-b border-[#eaeaea] bg-[#fafafa] flex-shrink-0">
            <span className="text-[10px] font-semibold text-[#999] uppercase">Property</span>
          </div>
          <div ref={propScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
            {allProps.map((prop) => {
              const img = propertyImages?.[prop];
              return (
                <button key={prop} onClick={() => onPropertyTap?.(prop)}
                  className="w-full px-2.5 flex items-center gap-2 border-b border-[#f0f0f0] text-left hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                  style={{ height: ROW_H, minHeight: ROW_H }}>
                  <div className="w-8 h-8 rounded-md bg-[#f0f0f0] flex-shrink-0 overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[#333] truncate hover:text-[#80020E] transition-colors">{prop}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline — 100% width, no overflow, percentage-based columns */}
        <div ref={timelineScrollRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
          <div className="w-full">
            {/* Date headers */}
            <div className="flex h-[46px] border-b border-[#eaeaea] bg-[#fafafa] sticky top-0 z-10">
              {dayCols.map((col, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center justify-end pb-1 border-r border-[#f0f0f0] min-w-0 ${col.isWeekend ? "bg-[#f5f5f5]" : ""}`}>
                  {(col.day === 1 || i === 0) && <span className="text-[8px] font-bold text-[#bbb] uppercase">{col.month}</span>}
                  <span className={`text-[9px] ${col.isToday ? "text-[#80020E]" : "text-[#bbb]"}`}>{col.dow}</span>
                  <span className={`text-[11px] font-semibold ${col.isToday ? "text-white bg-[#80020E] w-5 h-5 rounded-full flex items-center justify-center text-[10px]" : col.isWeekend ? "text-[#ccc]" : "text-[#555]"}`}>{col.day}</span>
                </div>
              ))}
            </div>
            {/* Property rows */}
            {allProps.map((prop) => {
              const propRes = resMap[prop] || [];
              const pct = 100 / DAYS;
              return (
                <div key={prop} className="relative border-b border-[#f0f0f0]" style={{ height: ROW_H }}>
                  {/* Grid bg */}
                  <div className="absolute inset-0 flex">
                    {dayCols.map((col, i) => (
                      <div key={i} className={`flex-1 border-r border-[#f5f5f5] h-full min-w-0 ${col.isWeekend ? "bg-[#fafafa]" : ""} ${col.isToday ? "bg-[#80020E]/[0.03]" : ""}`} />
                    ))}
                  </div>
                  {/* Bars — percentage-based positioning */}
                  {propRes.map((r) => {
                    const barStart = Math.max(0, daysBetween(rangeStart, r.checkIn));
                    const barEnd = Math.min(DAYS, daysBetween(rangeStart, r.checkOut));
                    const w = barEnd - barStart;
                    if (w <= 0) return null;
                    const { bg, text } = getColor(r.channel);
                    const nights = daysBetween(r.checkIn, r.checkOut);
                    const ch = r.channel.includes("Booking") ? "Booking.com" : r.channel.includes("Airbnb") ? "Airbnb" : r.channel;
                    return (
                      <button key={r.id} onClick={() => onTap(r)}
                        className="absolute top-[7px] rounded-lg flex items-center gap-1 px-2 overflow-hidden cursor-pointer hover:brightness-110 transition-all z-[1]"
                        style={{ left: `calc(${barStart * pct}% + 2px)`, width: `calc(${w * pct}% - 4px)`, height: ROW_H - 14, backgroundColor: bg, color: text }}>
                        <span className="flex-shrink-0 [&_img]:w-[11px] [&_img]:h-[11px] [&_svg]:w-[11px] [&_svg]:h-[11px]">{getChannelIcon(r.channel)}</span>
                        <div className="truncate text-[10px] font-semibold leading-tight">
                          {r.guest}
                          {w > 3 && <span className="text-[8px] opacity-75 font-medium ml-1">{ch} · {nights}N</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  MAIN EXPORT                                                      */
/* ================================================================ */
export default function ReservationCalendar({
  reservations,
  onReservationTap,
  onPropertyTap,
  propertyImages,
  showAllProperties = false,
}: {
  reservations: CalendarReservation[];
  onReservationTap?: (r: CalendarReservation) => void;
  onPropertyTap?: (propertyName: string) => void;
  propertyImages?: Record<string, string>;
  showAllProperties?: boolean;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());


  const handleTap = (r: CalendarReservation) => { onReservationTap?.(r); };

  // All Properties on desktop → timeline view
  // On mobile, always show monthly grid (timeline doesn't fit small screens)
  const [isMobile, setIsMobile] = useState(true); // default to mobile-safe
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (showAllProperties && !isMobile) {
    return <TimelineView reservations={reservations} onTap={handleTap} onPropertyTap={onPropertyTap} propertyImages={propertyImages} />;
  }

  // Monthly grid: mobile=1, tablet=3, desktop=6
  const monthCount = isMobile ? 1 : 6;
  const monthGrids: { y: number; m: number }[] = [];
  for (let i = 0; i < monthCount; i++) {
    let m = viewMonth + i;
    let y = viewYear;
    while (m > 11) { m -= 12; y += 1; }
    monthGrids.push({ y, m });
  }

  // Nav jump = number of months shown
  const jumpPrev = () => {
    let m = viewMonth - monthCount;
    let y = viewYear;
    while (m < 0) { m += 12; y -= 1; }
    setViewMonth(m); setViewYear(y);
  };
  const jumpNext = () => {
    let m = viewMonth + monthCount;
    let y = viewYear;
    while (m > 11) { m -= 12; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const rangeLabel = monthCount === 1
    ? `${MONTHS[viewMonth]} ${viewYear}`
    : `${MONTHS[viewMonth]} – ${MONTHS[monthGrids[monthGrids.length - 1].m]} ${monthGrids[monthGrids.length - 1].y}`;

  return (
    <div>
      {/* Month nav — only on desktop (mobile nav is inside the MonthGrid header) */}
      {!isMobile && (
        <div className="flex items-center justify-center gap-3 mb-4">
          <button onClick={jumpPrev} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-[14px] font-semibold text-[#111] min-w-[140px] text-center">{rangeLabel}</span>
          <button onClick={jumpNext} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>
      )}

      {/* Month grids — responsive: 1 mobile, 3 tablet, 3 desktop (2 rows) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {monthGrids.map(({ y, m }) => (
          <MonthGrid key={`${y}-${m}`} year={y} month={m} reservations={reservations} onTap={handleTap}
            showNav={isMobile} onPrev={jumpPrev} onNext={jumpNext} />
        ))}
      </div>
    </div>
  );
}
