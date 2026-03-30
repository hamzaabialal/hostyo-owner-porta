"use client";
import { useState, useMemo } from "react";
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
/*  MONTHLY GRID VIEW (single property default)                      */
/* ================================================================ */
function MonthGrid({ year, month, reservations, onTap }: {
  year: number; month: number;
  reservations: CalendarReservation[];
  onTap: (r: CalendarReservation) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const today = new Date();
  const todayStr = toStr(today);
  const monthStr = `${year}-${pad(month + 1)}`;

  // Reservations that overlap this month
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${pad(daysInMonth)}`;
  const active = reservations.filter((r) => {
    if (!r.checkIn || !r.checkOut || r.status === "Cancelled") return false;
    return r.checkIn <= monthEnd && r.checkOut > monthStart;
  });

  // For each day, find reservations
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
          // Calculate how many days the bar spans from this day (within this week row)
          const dayOfWeek = cur.getDay();
          const daysLeft = 7 - dayOfWeek; // days until end of week
          const daysUntilEnd = daysBetween(toStr(cur), r.checkOut);
          const daysUntilMonthEnd = daysInMonth - d + 1;
          const span = isStart || dayOfWeek === 0 ? Math.min(daysUntilEnd, daysLeft, daysUntilMonthEnd) : 0;
          map[d].push({ r, isStart, span });
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
    <div className="border border-[#eaeaea] rounded-xl overflow-hidden bg-white">
      <div className="text-center py-2 text-[14px] font-semibold text-[#111] border-b border-[#eaeaea] bg-[#fafafa]">
        {MONTHS[month]} {year}
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[#eaeaea]">
        {DOW.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-semibold py-1.5 ${i === 5 || i === 6 ? "text-[#FF5A5F]" : "text-[#999]"}`}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e${idx}`} className="h-[80px] md:h-[100px] border-r border-b border-[#f0f0f0] bg-[#fafafa]/50" />;
          }
          const dateStr = `${monthStr}-${pad(day)}`;
          const isT = dateStr === todayStr;
          const entries = dayRes[day] || [];

          return (
            <div key={day} className={`h-[80px] md:h-[100px] border-r border-b border-[#f0f0f0] relative overflow-visible ${isT ? "bg-[#80020E]/[0.03]" : ""}`}>
              <div className={`text-[11px] font-medium px-1.5 pt-1 ${isT ? "text-[#80020E] font-bold" : "text-[#777]"}`}>
                {isT ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#80020E] text-white text-[10px]">{day}</span>
                ) : day}
              </div>
              <div className="mt-0.5 space-y-0.5 px-0.5">
                {entries.filter((e) => e.isStart || new Date(year, month, day).getDay() === 0).slice(0, 2).map((entry) => {
                  const { bg, text } = getColor(entry.r.channel);
                  const nights = daysBetween(entry.r.checkIn, entry.r.checkOut);
                  const ch = entry.r.channel.includes("Booking") ? "Booking.com" : entry.r.channel.includes("Airbnb") ? "Airbnb" : entry.r.channel;
                  const span = Math.max(1, entry.span);
                  return (
                    <button
                      key={entry.r.id}
                      onClick={() => onTap(entry.r)}
                      className="block text-left rounded px-1 py-0.5 text-[9px] md:text-[10px] font-semibold leading-tight truncate cursor-pointer hover:brightness-110 relative z-[2]"
                      style={{
                        backgroundColor: bg, color: text,
                        width: `calc(${span * 100}% + ${(span - 1) * 1}px)`,
                      }}
                      title={`${entry.r.guest} · ${ch} · ${nights}N`}
                    >
                      <span className="flex items-center gap-0.5 truncate">
                        <span className="flex-shrink-0 [&_svg]:w-[10px] [&_svg]:h-[10px]">{getChannelIcon(entry.r.channel)}</span>
                        {entry.r.guest.split(" ")[0]}
                      </span>
                      <span className="text-[8px] opacity-80 block truncate">{ch} · {nights}N</span>
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
/*  HORIZONTAL TIMELINE VIEW (all properties)                        */
/* ================================================================ */
function TimelineView({ reservations, onTap }: {
  reservations: CalendarReservation[];
  onTap: (r: CalendarReservation) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(-3);
  const DAYS = 35;
  const DAY_W = 48;

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

  const propertyGroups = useMemo(() => {
    const active = reservations.filter((r) => {
      if (!r.checkIn || !r.checkOut || r.status === "Cancelled") return false;
      return r.checkIn <= rangeEnd && r.checkOut > rangeStart;
    });
    const groups: Record<string, CalendarReservation[]> = {};
    for (const r of active) {
      if (!groups[r.property]) groups[r.property] = [];
      groups[r.property].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [reservations, rangeStart, rangeEnd]);

  const ROW_H = 48;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <button onClick={() => setOffset((o) => o - 7)} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => setOffset(-3)} className="px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-colors">Today</button>
        <button onClick={() => setOffset((o) => o + 7)} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
        <span className="text-[13px] font-semibold text-[#111] ml-2">{dayCols[0]?.month} {dayCols[0]?.day} – {dayCols[DAYS - 1]?.month} {dayCols[DAYS - 1]?.day}</span>
      </div>

      <div className="border border-[#eaeaea] rounded-xl overflow-hidden bg-white flex flex-col" style={{ height: "calc(100vh - 240px)", minHeight: "400px" }}>
        <div className="flex flex-1 overflow-hidden">
          {/* Property names */}
          <div className="flex-shrink-0 w-[180px] border-r border-[#eaeaea] bg-white z-10 overflow-y-auto">
            <div className="h-[50px] px-3 flex items-end pb-2 border-b border-[#eaeaea] bg-[#fafafa]">
              <span className="text-[10px] font-semibold text-[#999] uppercase">Property</span>
            </div>
            {propertyGroups.map(([prop]) => (
              <div key={prop} className="px-3 flex items-center border-b border-[#f0f0f0]" style={{ height: ROW_H }}>
                <span className="text-[11px] font-medium text-[#333] truncate">{prop}</span>
              </div>
            ))}
          </div>

          {/* Scrollable area */}
          <div className="flex-1 overflow-auto">
            <div style={{ width: DAYS * DAY_W }}>
              {/* Headers */}
              <div className="flex h-[50px] border-b border-[#eaeaea] bg-[#fafafa] sticky top-0 z-10">
                {dayCols.map((col, i) => (
                  <div key={i} className={`flex flex-col items-center justify-end pb-1 border-r border-[#f0f0f0] ${col.isWeekend ? "bg-[#f5f5f5]" : ""}`}
                    style={{ width: DAY_W, minWidth: DAY_W }}>
                    {(col.day === 1 || i === 0) && <span className="text-[8px] font-bold text-[#bbb] uppercase">{col.month}</span>}
                    <span className={`text-[9px] ${col.isToday ? "text-[#80020E]" : "text-[#bbb]"}`}>{col.dow}</span>
                    <span className={`text-[11px] font-semibold ${col.isToday ? "text-white bg-[#80020E] w-5 h-5 rounded-full flex items-center justify-center text-[10px]" : col.isWeekend ? "text-[#ccc]" : "text-[#555]"}`}>{col.day}</span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {propertyGroups.map(([, propRes]) => (
                <div key={propRes[0]?.property} className="relative border-b border-[#f0f0f0]" style={{ height: ROW_H }}>
                  <div className="absolute inset-0 flex">
                    {dayCols.map((col, i) => (
                      <div key={i} className={`border-r border-[#f5f5f5] h-full ${col.isWeekend ? "bg-[#fafafa]" : ""} ${col.isToday ? "bg-[#80020E]/[0.03]" : ""}`}
                        style={{ width: DAY_W, minWidth: DAY_W }} />
                    ))}
                  </div>
                  {propRes.filter((r) => r.status !== "Cancelled").map((r) => {
                    const barStart = Math.max(0, daysBetween(rangeStart, r.checkIn));
                    const barEnd = Math.min(DAYS, daysBetween(rangeStart, r.checkOut));
                    const w = barEnd - barStart;
                    if (w <= 0) return null;
                    const { bg, text } = getColor(r.channel);
                    const nights = daysBetween(r.checkIn, r.checkOut);
                    const ch = r.channel.includes("Booking") ? "Booking.com" : r.channel.includes("Airbnb") ? "Airbnb" : r.channel;
                    return (
                      <button key={r.id} onClick={() => onTap(r)}
                        className="absolute top-[6px] rounded-lg flex items-center gap-1 px-2 overflow-hidden cursor-pointer hover:brightness-110 transition-all z-[1]"
                        style={{ left: barStart * DAY_W + 2, width: w * DAY_W - 4, height: ROW_H - 12, backgroundColor: bg, color: text }}>
                        <span className="flex-shrink-0 [&_svg]:w-[12px] [&_svg]:h-[12px]">{getChannelIcon(r.channel)}</span>
                        <div className="truncate text-[10px] font-semibold leading-tight">
                          {r.guest}
                          {w > 3 && <span className="text-[8px] opacity-75 font-medium ml-1">{ch} · {nights}N</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
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
}: {
  reservations: CalendarReservation[];
  onReservationTap?: (r: CalendarReservation) => void;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [calMode, setCalMode] = useState<"month" | "timeline">("month");

  const uniqueProps = useMemo(() => new Set(reservations.map((r) => r.property)), [reservations]);
  const hasMultipleProperties = uniqueProps.size > 1;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const handleTap = (r: CalendarReservation) => { onReservationTap?.(r); };

  return (
    <div>
      {/* View toggle + month nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {calMode === "month" && (
            <>
              <button onClick={prevMonth} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-[14px] font-semibold text-[#111] min-w-[140px] text-center">{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
              </button>
            </>
          )}
        </div>

        {hasMultipleProperties && (
          <div className="flex items-center gap-1 border border-[#e2e2e2] rounded-lg p-0.5">
            <button onClick={() => setCalMode("month")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${calMode === "month" ? "bg-[#80020E] text-white" : "text-[#555] hover:bg-[#f5f5f5]"}`}>
              Monthly
            </button>
            <button onClick={() => setCalMode("timeline")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${calMode === "timeline" ? "bg-[#80020E] text-white" : "text-[#555] hover:bg-[#f5f5f5]"}`}>
              All Properties
            </button>
          </div>
        )}
      </div>

      {/* Calendar content */}
      {calMode === "month" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthGrid year={viewYear} month={viewMonth} reservations={reservations} onTap={handleTap} />
          <MonthGrid year={viewMonth === 11 ? viewYear + 1 : viewYear} month={viewMonth === 11 ? 0 : viewMonth + 1} reservations={reservations} onTap={handleTap} />
        </div>
      ) : (
        <TimelineView reservations={reservations} onTap={handleTap} />
      )}
    </div>
  );
}
