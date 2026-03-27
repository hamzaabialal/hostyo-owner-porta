"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChannelBadge, { getChannelIcon, normalizeChannel } from "@/components/ChannelBadge";
import FilterDropdown from "@/components/FilterDropdown";
import AppShell from "@/components/AppShell";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Expense {
  category: string;
  amount: number;
  vendor: string;
  status: string;
  notes: string;
}

interface Reservation {
  id: number;
  ref: string;
  property: string;
  guest: string;
  channel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  status: string;
  gross: number;
  platformFee: number;
  hostyoFee: number;
  cleaningFee: number;
  expensesTotal: number;
  payoutStatus: string;
  payoutCycle: string;
  expenses: Expense[];
}

/* ------------------------------------------------------------------ */
/*  Hardcoded Data                                                     */
/* ------------------------------------------------------------------ */
const reservations: Reservation[] = [
  {
    id: 1, ref: "BK-2026-0001", property: "The Kensington Residence", guest: "Emma Thompson", channel: "Airbnb",
    checkIn: "2026-03-01", checkOut: "2026-03-05", nights: 4, guests: 3, status: "Completed",
    gross: 1840, platformFee: -276, hostyoFee: -92, cleaningFee: -120, expensesTotal: -85,
    payoutStatus: "Paid", payoutCycle: "Mar 1-15, 2026",
    expenses: [
      { category: "Cleaning", amount: 120, vendor: "SparkClean Co.", status: "Paid", notes: "Deep clean after checkout" },
      { category: "Maintenance", amount: 85, vendor: "HandyFix Ltd.", status: "Paid", notes: "Replaced kitchen faucet seal" },
    ],
  },
  {
    id: 2, ref: "BK-2026-0002", property: "Villa Serena", guest: "James Whitaker", channel: "Booking.com",
    checkIn: "2026-03-02", checkOut: "2026-03-09", nights: 7, guests: 5, status: "Completed",
    gross: 4550, platformFee: -682.5, hostyoFee: -227.5, cleaningFee: -200, expensesTotal: -150,
    payoutStatus: "Paid", payoutCycle: "Mar 1-15, 2026",
    expenses: [
      { category: "Cleaning", amount: 200, vendor: "SparkClean Co.", status: "Paid", notes: "Standard turnover clean" },
      { category: "Supplies", amount: 95, vendor: "Amazon", status: "Paid", notes: "Restocked towels and linens" },
      { category: "Laundry", amount: 55, vendor: "FreshPress", status: "Paid", notes: "Bedding and towels service" },
    ],
  },
  {
    id: 3, ref: "BK-2026-0003", property: "Mayfair Studio", guest: "Sophie Chen", channel: "Airbnb",
    checkIn: "2026-03-03", checkOut: "2026-03-06", nights: 3, guests: 2, status: "Completed",
    gross: 870, platformFee: -130.5, hostyoFee: -43.5, cleaningFee: -75, expensesTotal: 0,
    payoutStatus: "Paid", payoutCycle: "Mar 1-15, 2026",
    expenses: [],
  },
  {
    id: 4, ref: "BK-2026-0004", property: "The Kensington Residence", guest: "Oliver Martinez", channel: "VRBO",
    checkIn: "2026-03-07", checkOut: "2026-03-12", nights: 5, guests: 4, status: "Completed",
    gross: 2300, platformFee: -345, hostyoFee: -115, cleaningFee: -120, expensesTotal: -65,
    payoutStatus: "Paid", payoutCycle: "Mar 1-15, 2026",
    expenses: [
      { category: "Cleaning", amount: 120, vendor: "SparkClean Co.", status: "Paid", notes: "Standard turnover clean" },
      { category: "Supplies", amount: 65, vendor: "Tesco", status: "Paid", notes: "Welcome basket items" },
    ],
  },
  {
    id: 5, ref: "BK-2026-0005", property: "Villa Serena", guest: "Amelia Brooks", channel: "Direct",
    checkIn: "2026-03-10", checkOut: "2026-03-14", nights: 4, guests: 6, status: "Completed",
    gross: 2600, platformFee: 0, hostyoFee: -130, cleaningFee: -200, expensesTotal: -280,
    payoutStatus: "Scheduled", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 200, vendor: "SparkClean Co.", status: "Paid", notes: "Post-checkout deep clean" },
      { category: "Maintenance", amount: 180, vendor: "PoolTech Ltd.", status: "Paid", notes: "Pool filter replacement" },
      { category: "Supplies", amount: 100, vendor: "Amazon", status: "Paid", notes: "Coffee machine pods and toiletries" },
    ],
  },
  {
    id: 6, ref: "BK-2026-0006", property: "Mayfair Studio", guest: "Liam O'Connor", channel: "Booking.com",
    checkIn: "2026-03-08", checkOut: "2026-03-10", nights: 2, guests: 1, status: "Cancelled",
    gross: 580, platformFee: 0, hostyoFee: 0, cleaningFee: 0, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "N/A",
    expenses: [],
  },
  {
    id: 7, ref: "BK-2026-0007", property: "The Kensington Residence", guest: "Isabella Rossi", channel: "Airbnb",
    checkIn: "2026-03-14", checkOut: "2026-03-18", nights: 4, guests: 2, status: "Completed",
    gross: 1840, platformFee: -276, hostyoFee: -92, cleaningFee: -120, expensesTotal: 0,
    payoutStatus: "Scheduled", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 120, vendor: "SparkClean Co.", status: "Paid", notes: "Standard turnover" },
    ],
  },
  {
    id: 8, ref: "BK-2026-0008", property: "Villa Serena", guest: "Marcus Johnson", channel: "VRBO",
    checkIn: "2026-03-16", checkOut: "2026-03-23", nights: 7, guests: 4, status: "Completed",
    gross: 4550, platformFee: -682.5, hostyoFee: -227.5, cleaningFee: -200, expensesTotal: -75,
    payoutStatus: "Scheduled", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 200, vendor: "SparkClean Co.", status: "Paid", notes: "Turnover clean" },
      { category: "Gardening", amount: 75, vendor: "GreenThumb Services", status: "Paid", notes: "Weekly garden maintenance" },
    ],
  },
  {
    id: 9, ref: "BK-2026-0009", property: "Mayfair Studio", guest: "Charlotte Evans", channel: "Airbnb",
    checkIn: "2026-03-12", checkOut: "2026-03-15", nights: 3, guests: 2, status: "Completed",
    gross: 870, platformFee: -130.5, hostyoFee: -43.5, cleaningFee: -75, expensesTotal: -40,
    payoutStatus: "Scheduled", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 75, vendor: "SparkClean Co.", status: "Paid", notes: "Standard clean" },
      { category: "Supplies", amount: 40, vendor: "Sainsbury's", status: "Paid", notes: "Coffee, tea, and snacks" },
    ],
  },
  {
    id: 10, ref: "BK-2026-0010", property: "The Kensington Residence", guest: "William Turner", channel: "Direct",
    checkIn: "2026-03-20", checkOut: "2026-03-27", nights: 7, guests: 3, status: "In House",
    gross: 3220, platformFee: 0, hostyoFee: -161, cleaningFee: -120, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 120, vendor: "SparkClean Co.", status: "Scheduled", notes: "Checkout clean booked" },
    ],
  },
  {
    id: 11, ref: "BK-2026-0011", property: "Villa Serena", guest: "Natasha Petrova", channel: "Booking.com",
    checkIn: "2026-03-24", checkOut: "2026-03-31", nights: 7, guests: 5, status: "In House",
    gross: 4550, platformFee: -682.5, hostyoFee: -227.5, cleaningFee: -200, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "Mar 16-31, 2026",
    expenses: [
      { category: "Cleaning", amount: 200, vendor: "SparkClean Co.", status: "Scheduled", notes: "Checkout clean booked" },
    ],
  },
  {
    id: 12, ref: "BK-2026-0012", property: "Mayfair Studio", guest: "Daniel Kim", channel: "VRBO",
    checkIn: "2026-03-22", checkOut: "2026-03-25", nights: 3, guests: 1, status: "In House",
    gross: 870, platformFee: -130.5, hostyoFee: -43.5, cleaningFee: -75, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "Mar 16-31, 2026",
    expenses: [],
  },
  {
    id: 13, ref: "BK-2026-0013", property: "The Kensington Residence", guest: "Hannah Mueller", channel: "Airbnb",
    checkIn: "2026-03-28", checkOut: "2026-04-02", nights: 5, guests: 2, status: "Upcoming",
    gross: 2300, platformFee: -345, hostyoFee: -115, cleaningFee: -120, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "Apr 1-15, 2026",
    expenses: [],
  },
  {
    id: 14, ref: "BK-2026-0014", property: "Villa Serena", guest: "Robert Andersen", channel: "Airbnb",
    checkIn: "2026-04-01", checkOut: "2026-04-08", nights: 7, guests: 6, status: "Upcoming",
    gross: 4550, platformFee: -682.5, hostyoFee: -227.5, cleaningFee: -200, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "Apr 1-15, 2026",
    expenses: [],
  },
  {
    id: 15, ref: "BK-2026-0015", property: "Mayfair Studio", guest: "Priya Sharma", channel: "Direct",
    checkIn: "2026-03-18", checkOut: "2026-03-20", nights: 2, guests: 2, status: "Cancelled",
    gross: 580, platformFee: 0, hostyoFee: 0, cleaningFee: 0, expensesTotal: 0,
    payoutStatus: "Pending", payoutCycle: "N/A",
    expenses: [],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  return n < 0 ? "-" + str : str;
}

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusPillClass(s: string): string {
  const map: Record<string, string> = {
    Upcoming: "pill pill-upcoming",
    "In House": "pill pill-inhouse",
    Completed: "pill pill-completed",
    Cancelled: "pill pill-cancelled",
  };
  return map[s] ?? "pill";
}

function payoutPillClass(s: string): string {
  const map: Record<string, string> = {
    Paid: "pill pill-paid",
    Scheduled: "pill pill-submitted",
    Pending: "pill pill-pending",
  };
  return map[s] ?? "pill";
}

/* ------------------------------------------------------------------ */
/*  Expense Icon                                                       */
/* ------------------------------------------------------------------ */
function ExpenseIcon({ category }: { category: string }) {
  const shared = "w-4 h-4 text-gray-500";
  switch (category) {
    case "Cleaning":
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
        </svg>
      );
    case "Maintenance":
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "Supplies":
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "Laundry":
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="22" height="22" rx="3" /><circle cx="12" cy="13" r="5" /><circle cx="12" cy="13" r="2" />
        </svg>
      );
    case "Gardening":
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22V8" /><path d="M5 12H2a10 10 0 0 0 10 10" /><path d="M19 12h3a10 10 0 0 1-10 10" /><path d="M12 8a6 6 0 0 0-6-6c0 3.31 2.69 6 6 6z" /><path d="M12 8a6 6 0 0 1 6-6c0 3.31-2.69 6-6 6z" />
        </svg>
      );
    default:
      return (
        <svg className={shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
function ReservationsContent() {
  const searchParams = useSearchParams();
  const guestParam = searchParams.get("guest") || "";

  /* --- data state --- */
  const [data, setData] = useState<Reservation[]>(reservations);
  const [loading, setLoading] = useState(true);

  /* --- filter state --- */
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [search, setSearch] = useState("");

  /* --- pagination --- */
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  /* --- drawer state --- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  /* --- fetch from Notion API --- */
  useEffect(() => {
    fetch("/api/reservations")
      .then((r) => r.json())
      .then((res) => {
        if (res.source === "notion" && res.data?.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: Reservation[] = res.data.map((r: any, i: number) => ({
            id: i + 1,
            ref: r.ref || `RES-${i + 1}`,
            property: (r.property || "").trim(),
            guest: r.guest || "",
            channel: r.channel || "Direct",
            checkIn: r.checkin || "",
            checkOut: r.checkout || "",
            nights: r.nights || 0,
            guests: (r.adults || 0) + (r.children || 0) || 1,
            status: r.status || "Pending",
            gross: r.grossAmount || 0,
            platformFee: -(r.platformFee || 0),
            hostyoFee: -(r.managementFee || 0),
            cleaningFee: -(r.cleaning || 0),
            expensesTotal: -(r.expenses || 0),
            payoutStatus: r.payoutStatus || "Pending",
            payoutCycle: "",
            expenses: [],
          }));
          setData(mapped);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* --- dynamic filter options from data --- */
  const propertyOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.property))).filter(Boolean).sort().map((p) => ({ value: p, label: p })),
  [data]);

  const statusOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.status))).filter(Boolean).sort().map((s) => ({ value: s, label: s })),
  [data]);

  const channelOptions = useMemo(() =>
    Array.from(new Set(data.map((r) => r.channel))).filter(Boolean).sort().map((c) => ({
      value: c,
      label: normalizeChannel(c) === "Direct" ? "Hostyo" : normalizeChannel(c),
      icon: getChannelIcon(c),
    })),
  [data]);

  /* --- filtered data --- */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((r) => {
      if (filterProperty && r.property !== filterProperty) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterChannel && r.channel !== filterChannel) return false;
      if (q && !r.guest.toLowerCase().includes(q) && !r.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filterProperty, filterStatus, filterChannel, search]);

  /* --- paginated data --- */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterProperty, filterStatus, filterChannel, search]);

  // Auto-open drawer if ?guest= param is present
  useEffect(() => {
    if (guestParam && data.length > 0 && !loading) {
      const match = data.find((r) => r.guest.toLowerCase() === guestParam.toLowerCase());
      if (match) {
        openDrawer(match);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestParam, data, loading]);

  /* --- open / close drawer --- */
  const openDrawer = useCallback((r: Reservation) => {
    setSelectedReservation(r);
    setDrawerOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedReservation(null);
    document.body.style.overflow = "";
  }, []);

  /* --- Escape key --- */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeDrawer]);

  /* --- compute net earnings for drawer --- */
  const netEarnings = selectedReservation
    ? selectedReservation.gross +
      selectedReservation.platformFee +
      selectedReservation.hostyoFee +
      selectedReservation.cleaningFee +
      selectedReservation.expensesTotal
    : 0;

  /* -------------------------------------------------------------- */
  /*  Select styling                                                 */
  /* -------------------------------------------------------------- */
  if (loading) {
    return (
      <AppShell title="Reservations">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading reservations...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reservations">
      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <FilterDropdown
          placeholder="All Properties"
          value={filterProperty}
          onChange={setFilterProperty}
          options={propertyOptions}
        />
        <FilterDropdown
          placeholder="All Statuses"
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions}
        />
        <FilterDropdown
          placeholder="All Channels"
          value={filterChannel}
          onChange={setFilterChannel}
          options={channelOptions}
        />

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-gray-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-[13px] font-medium text-gray-700 min-w-[260px] placeholder:text-gray-400 hover:border-gray-400 focus:outline-none focus:border-[#80020E]"
            placeholder="Search guest name or booking ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#fafafa]">
                {["Property", "Guest", "Channel", "Check-in", "Check-out", "Nights", "Status", "Gross Amount", "Expenses", "Payout Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide text-gray-400 border-b border-[#eaeaea] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400 text-sm">
                    No reservations match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDrawer(r)}
                    className="cursor-pointer transition-colors hover:bg-[#f9f9f9] border-b border-[#f0f0f0] last:border-b-0"
                  >
                    <td className="px-4 py-3.5 font-medium text-gray-900 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {r.property}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-900 whitespace-nowrap">{r.guest}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><ChannelBadge channel={r.channel} /></td>
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{fmtDate(r.checkIn)}</td>
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{fmtDate(r.checkOut)}</td>
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{r.nights}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={statusPillClass(r.status)}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums whitespace-nowrap">{fmtCurrency(r.gross)}</td>
                    <td className="px-4 py-3.5 tabular-nums text-red-800 whitespace-nowrap">
                      {r.expensesTotal !== 0 ? fmtCurrency(r.expensesTotal) : "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={payoutPillClass(r.payoutStatus)}>{r.payoutStatus}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-[13px] text-text-tertiary">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} reservations
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#e2e2e2] bg-white text-text-secondary hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-[13px] font-medium rounded-lg transition-colors ${
                      currentPage === page
                        ? "bg-accent text-white"
                        : "text-text-secondary hover:bg-[#f5f5f5]"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#e2e2e2] bg-white text-text-secondary hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer Overlay ── */}
      <div
        className={`drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
      />

      {/* ── Slide-over Drawer ── */}
      <div className={`drawer-panel ${drawerOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eaeaea] shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Reservation Details</h2>
          <button
            onClick={closeDrawer}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100 text-gray-500"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {selectedReservation && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Reservation Info */}
            <div className="mb-7">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3.5">
                Reservation Info
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Guest" value={selectedReservation.guest} />
                <InfoItem label="Booking Ref" value={selectedReservation.ref} />
                <InfoItem label="Property" value={selectedReservation.property} fullWidth />
                <div className="flex items-center justify-between py-2.5 border-b border-[#f2f2f2]">
                    <span className="text-[13px] text-text-tertiary">Channel</span>
                    <ChannelBadge channel={selectedReservation.channel} />
                  </div>
                <InfoItem label="Guests" value={String(selectedReservation.guests)} />
                <InfoItem label="Check-in" value={fmtDate(selectedReservation.checkIn)} />
                <InfoItem label="Check-out" value={fmtDate(selectedReservation.checkOut)} />
                <InfoItem label="Nights" value={String(selectedReservation.nights)} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Status</span>
                  <span className="text-sm font-medium text-gray-900">
                    <span className={statusPillClass(selectedReservation.status)}>{selectedReservation.status}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="mb-7">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3.5">
                Financial Breakdown
              </h3>
              <div className="bg-[#fafafa] border border-[#eaeaea] rounded-[10px] p-4.5">
                <FinancialRow label="Gross Price" value={fmtCurrency(selectedReservation.gross)} />
                {selectedReservation.platformFee !== 0 && (
                  <FinancialRow label="Platform Fee" value={fmtCurrency(selectedReservation.platformFee)} negative />
                )}
                {selectedReservation.hostyoFee !== 0 && (
                  <FinancialRow label="Hostyo Fee" value={fmtCurrency(selectedReservation.hostyoFee)} negative />
                )}
                {selectedReservation.cleaningFee !== 0 && (
                  <FinancialRow label="Cleaning Fee" value={fmtCurrency(selectedReservation.cleaningFee)} negative />
                )}
                {selectedReservation.expensesTotal !== 0 && (
                  <FinancialRow label="Linked Expenses" value={fmtCurrency(selectedReservation.expensesTotal)} negative />
                )}
                <div className="flex justify-between items-center py-2 border-t-2 border-[#eaeaea] mt-1 pt-3">
                  <span className="text-[13px] font-bold text-gray-900">Net Earnings Contribution</span>
                  <span className="text-[15px] font-bold text-[#80020E] tabular-nums">{fmtCurrency(netEarnings)}</span>
                </div>
              </div>
            </div>

            {/* Payout Cycle */}
            <div className="mb-7">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3.5">
                Payout Cycle
              </h3>
              <div className="flex items-center gap-4">
                <span className={payoutPillClass(selectedReservation.payoutStatus)}>{selectedReservation.payoutStatus}</span>
                <span className="text-[13px] text-gray-500">Cycle:</span>
                <span className="text-[13px] font-semibold text-gray-900">{selectedReservation.payoutCycle}</span>
              </div>
            </div>

            {/* Linked Expenses */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3.5">
                Linked Expenses
              </h3>
              {selectedReservation.expenses.length === 0 ? (
                <p className="text-[13px] text-gray-400 italic">No linked expenses for this reservation.</p>
              ) : (
                <div className="divide-y divide-[#f0f0f0]">
                  {selectedReservation.expenses.map((exp, i) => (
                    <div key={i} className="flex items-start gap-3 py-3 first:pt-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <ExpenseIcon category={exp.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] font-semibold text-gray-900">{exp.category}</span>
                          <span className="text-[13px] font-semibold text-red-800 tabular-nums">
                            {fmtCurrency(-exp.amount)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {exp.vendor} &middot; {exp.status}
                        </div>
                        {exp.notes && (
                          <div className="text-xs text-gray-500 mt-1 italic">{exp.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function InfoItem({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? "col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function FinancialRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-t border-[#f0f0f0] first:border-t-0">
      <span className="text-[13px] font-medium text-gray-500">{label}</span>
      <span className={`text-[13px] font-medium tabular-nums ${negative ? "text-red-800" : "text-gray-700"}`}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export with Suspense for useSearchParams                      */
/* ------------------------------------------------------------------ */
export default function ReservationsPage() {
  return (
    <Suspense fallback={<AppShell title="Reservations"><div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading...</div></AppShell>}>
      <ReservationsContent />
    </Suspense>
  );
}
