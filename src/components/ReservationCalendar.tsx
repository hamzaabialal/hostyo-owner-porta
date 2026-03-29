"use client";
import { useState, useMemo } from "react";

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

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CHANNEL_COLORS: Record<string, string> = {
  "Airbnb": "#FF5A5F",
  "Booking.com": "#003580",
  "Expedia": "#FBAF17",
  "VRBO": "#3B5998",
  "Agoda": "#5D2E8C",
  "Direct": "#80020E",
};

function getColor(channel: string): string {
  for (const [key, color] of Object.entries(CHANNEL_COLORS)) {
    if (channel.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#80020E";
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function fmtDateShort(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ReservationCalendar({
  reservations,
  onReservationTap,
}: {
  reservations: CalendarReservation[];
  onReservationTap?: (r: CalendarReservation) => void;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedRes, setSelectedRes] = useState<CalendarReservation | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Build calendar grid
  const { days, startOffset } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; // Monday = 0
    const d: number[] = [];
    for (let i = 1; i <= daysInMonth; i++) d.push(i);
    return { days: d, startOffset: firstDay };
  }, [year, month]);

  // Find reservations overlapping this month
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const monthEnd = `${year}-${pad(month + 1)}-${pad(days.length)}`;

  const overlapping = useMemo(() => {
    return reservations.filter((r) => {
      if (!r.checkIn || !r.checkOut) return false;
      if (r.status === "Cancelled") return false;
      return r.checkIn <= monthEnd && r.checkOut >= monthStart;
    });
  }, [reservations, monthStart, monthEnd]);

  // Map days to reservations
  const dayMap = useMemo(() => {
    const map: Record<number, CalendarReservation[]> = {};
    for (const r of overlapping) {
      const ciDate = new Date(r.checkIn + "T00:00:00");
      const coDate = new Date(r.checkOut + "T00:00:00");
      for (let d = 1; d <= days.length; d++) {
        const current = new Date(year, month, d);
        if (current >= ciDate && current < coDate) {
          if (!map[d]) map[d] = [];
          map[d].push(r);
        }
      }
    }
    return map;
  }, [overlapping, days.length, year, month]);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div>
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 text-[#999] hover:text-[#333] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-[15px] font-semibold text-[#111]">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-2 text-[#999] hover:text-[#333] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#999] uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-[#eaeaea]">
        {/* Empty cells for offset */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`e${i}`} className="h-[72px] md:h-[90px] border-r border-b border-[#eaeaea] bg-[#fafafa]" />
        ))}

        {/* Day cells */}
        {days.map((d) => {
          const resForDay = dayMap[d] || [];
          const isT = isToday(d);

          return (
            <div key={d} className="h-[72px] md:h-[90px] border-r border-b border-[#eaeaea] p-0.5 overflow-hidden relative">
              <div className={`text-[11px] font-medium px-1 py-0.5 ${isT ? "text-white bg-[#80020E] rounded-full w-5 h-5 flex items-center justify-center text-[10px] mx-auto" : "text-[#666]"}`}>
                {d}
              </div>
              <div className="space-y-0.5 mt-0.5">
                {resForDay.slice(0, 2).map((r) => {
                  const color = getColor(r.channel);
                  const ciDay = new Date(r.checkIn + "T00:00:00").getDate();
                  const isStart = year === new Date(r.checkIn + "T00:00:00").getFullYear() &&
                                  month === new Date(r.checkIn + "T00:00:00").getMonth() &&
                                  d === ciDay;
                  return (
                    <button
                      key={`${r.id}-${d}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedRes(r); onReservationTap?.(r); }}
                      className="w-full text-left px-1 py-0.5 rounded text-[9px] md:text-[10px] font-medium text-white truncate block leading-tight"
                      style={{ backgroundColor: color + "dd" }}
                      title={`${r.guest} - ${r.property}`}
                    >
                      {isStart ? r.guest.split(" ")[0] : ""}
                    </button>
                  );
                })}
                {resForDay.length > 2 && (
                  <div className="text-[8px] text-[#999] px-1">+{resForDay.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected reservation popover */}
      {selectedRes && (
        <div className="mt-4 bg-white border border-[#eaeaea] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(selectedRes.channel) }} />
              <span className="text-[14px] font-semibold text-[#111]">{selectedRes.guest}</span>
            </div>
            <button onClick={() => setSelectedRes(null)} className="p-1 text-[#999] hover:text-[#555]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="text-[12px] text-[#888] mb-1">{selectedRes.property}</div>
          <div className="text-[12px] text-[#666]">{fmtDateShort(selectedRes.checkIn)} → {fmtDateShort(selectedRes.checkOut)}</div>
          {selectedRes.ownerPayout > 0 && (
            <div className="text-[13px] font-semibold text-[#111] mt-2">€{selectedRes.ownerPayout.toFixed(2)}</div>
          )}
        </div>
      )}
    </div>
  );
}
