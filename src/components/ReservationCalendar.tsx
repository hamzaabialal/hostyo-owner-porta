"use client";
import { useState, useMemo, useRef, useEffect } from "react";

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
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

const TOTAL_DAYS = 42;
const DAY_W = 48;

export default function ReservationCalendar({
  reservations,
  onReservationTap,
}: {
  reservations: CalendarReservation[];
  onReservationTap?: (r: CalendarReservation) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CalendarReservation | null>(null);
  const [offset, setOffset] = useState(-3); // start 3 days before today

  const today = useMemo(() => new Date(), []);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 3 * DAY_W;
  }, []);

  // Day columns
  const dayCols = useMemo(() => {
    const cols: { str: string; day: number; dow: string; month: string; isToday: boolean; isWeekend: boolean }[] = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset + i);
      const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
      const month = d.toLocaleDateString("en-GB", { month: "short" });
      cols.push({
        str: toDateStr(d), day: d.getDate(), dow, month,
        isToday: d.toDateString() === today.toDateString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return cols;
  }, [today, offset]);

  const rangeStart = dayCols[0].str;
  const rangeEnd = dayCols[TOTAL_DAYS - 1].str;

  // Active reservations in range
  const active = useMemo(() =>
    reservations.filter((r) => {
      if (!r.checkIn || !r.checkOut || r.status === "Cancelled") return false;
      return r.checkIn <= rangeEnd && r.checkOut > rangeStart;
    }).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
  [reservations, rangeStart, rangeEnd]);

  // Assign rows so bars don't overlap
  const rows = useMemo(() => {
    const rowEnds: string[] = []; // tracks when each row's last bar ends
    return active.map((r) => {
      let row = rowEnds.findIndex((end) => end <= r.checkIn);
      if (row === -1) { row = rowEnds.length; rowEnds.push(""); }
      rowEnds[row] = r.checkOut;
      return { ...r, row };
    });
  }, [active]);

  const totalRows = rows.length > 0 ? Math.max(...rows.map((r) => r.row)) + 1 : 1;
  const ROW_H = 44;

  const scrollWeek = (dir: number) => setOffset((o) => o + dir * 7);
  const goToday = () => setOffset(-3);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => scrollWeek(-1)} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-colors">Today</button>
          <button onClick={() => scrollWeek(1)} className="p-1.5 rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#333] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
          <span className="text-[13px] font-semibold text-[#111] ml-2">
            {dayCols[0]?.month} {dayCols[0]?.day} – {dayCols[TOTAL_DAYS - 1]?.month} {dayCols[TOTAL_DAYS - 1]?.day}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[10px] text-[#999]">
          {Object.entries(CHANNEL_COLORS).slice(0, 4).map(([name, { bg }]) => (
            <span key={name} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: bg }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Timeline — fits viewport */}
      <div className="border border-[#eaeaea] rounded-xl overflow-hidden bg-white flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
        {/* Date headers (fixed) */}
        <div className="flex border-b border-[#eaeaea] bg-[#fafafa] flex-shrink-0 overflow-hidden">
          {dayCols.map((col, i) => (
            <div
              key={i}
              className={`flex flex-col items-center justify-end py-1.5 border-r border-[#f0f0f0] flex-shrink-0 ${col.isWeekend ? "bg-[#f5f5f5]" : ""}`}
              style={{ width: `${100 / TOTAL_DAYS}%`, minWidth: DAY_W }}
            >
              {(col.day === 1 || i === 0) && <span className="text-[8px] font-bold text-[#bbb] uppercase">{col.month}</span>}
              <span className={`text-[9px] font-medium ${col.isToday ? "text-[#80020E]" : "text-[#bbb]"}`}>{col.dow}</span>
              <span className={`text-[11px] font-semibold leading-none mt-0.5 ${
                col.isToday ? "text-white bg-[#80020E] w-5 h-5 rounded-full flex items-center justify-center text-[10px]" : col.isWeekend ? "text-[#ccc]" : "text-[#555]"
              }`}>{col.day}</span>
            </div>
          ))}
        </div>

        {/* Scrollable bars area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="relative" style={{ height: Math.max(totalRows * ROW_H + 8, 200) + "px" }}>
            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {dayCols.map((col, i) => (
                <div key={i} className={`border-r border-[#f5f5f5] h-full flex-shrink-0 ${col.isWeekend ? "bg-[#fafafa]" : ""} ${col.isToday ? "bg-[#80020E]/[0.03]" : ""}`}
                  style={{ width: `${100 / TOTAL_DAYS}%`, minWidth: DAY_W }} />
              ))}
            </div>

            {/* Reservation bars */}
            {rows.map((r) => {
              const barStart = Math.max(0, daysBetween(rangeStart, r.checkIn));
              const barEnd = Math.min(TOTAL_DAYS, daysBetween(rangeStart, r.checkOut));
              const barWidth = barEnd - barStart;
              if (barWidth <= 0) return null;

              const { bg, text } = getColor(r.channel);
              const nights = daysBetween(r.checkIn, r.checkOut);
              const ch = r.channel.includes("Booking") ? "Booking.com" : r.channel.includes("Airbnb") ? "Airbnb" : r.channel;
              const pct = 100 / TOTAL_DAYS;

              return (
                <button
                  key={r.id}
                  onClick={() => { setSelected(r); onReservationTap?.(r); }}
                  className="absolute rounded-lg flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 hover:shadow-sm transition-all z-[1]"
                  style={{
                    left: `calc(${barStart * pct}% + 2px)`,
                    top: r.row * ROW_H + 4,
                    width: `calc(${barWidth * pct}% - 4px)`,
                    height: ROW_H - 8,
                    backgroundColor: bg,
                    color: text,
                  }}
                  title={`${r.guest} · ${ch} · ${nights}N`}
                >
                  <div className="truncate leading-tight">
                    <div className="text-[11px] font-semibold truncate">{r.guest}</div>
                    {barWidth > 2 && <div className="text-[9px] opacity-75 font-medium truncate">{ch} · {nights} night{nights !== 1 ? "s" : ""}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {active.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#999]">No reservations in this date range.</div>
          )}
        </div>
      </div>

      {/* Detail card */}
      {selected && (
        <div className="mt-3 bg-white border border-[#eaeaea] rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: getColor(selected.channel).bg }} />
                <span className="text-[14px] font-semibold text-[#111]">{selected.guest}</span>
              </div>
              <div className="text-[12px] text-[#888] mb-0.5">{selected.property}</div>
              <div className="text-[12px] text-[#666]">
                {new Date(selected.checkIn + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → {new Date(selected.checkOut + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {daysBetween(selected.checkIn, selected.checkOut)} nights
              </div>
              {selected.ownerPayout > 0 && (
                <div className="text-[13px] font-semibold text-[#111] mt-1.5">€{selected.ownerPayout.toFixed(2)}</div>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="p-1 text-[#999] hover:text-[#555]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
