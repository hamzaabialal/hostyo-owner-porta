"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChannelBadge, { getChannelIcon, normalizeChannel } from "@/components/ChannelBadge";
import FilterDropdown from "@/components/FilterDropdown";
import DateRangePicker from "@/components/DateRangePicker";
import ReservationCalendar from "@/components/ReservationCalendar";
import AppShell from "@/components/AppShell";
import { useData } from "@/lib/DataContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Reservation {
  id: number;
  notionId: string;
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
  ownerPayout: number;
  payoutStatus: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtCurrency(n: number): string {
  const prefix = n < 0 ? "-" : "";
  return prefix + "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusPillClass(s: string): string {
  const map: Record<string, string> = {
    Pending: "pill pill-pending",
    "Check-In": "pill pill-checkin",
    "Check-Out": "pill pill-checkout",
    Cancelled: "pill pill-cancelled",
    Completed: "pill pill-completed",
    "In-House": "pill pill-inhouse",
  };
  return map[s] || "pill";
}

/* ------------------------------------------------------------------ */
/*  Accordion Detail Tabs                                              */
/* ------------------------------------------------------------------ */
function AccordionDetail({ r }: { r: Reservation }) {
  const [tab, setTab] = useState<"overview" | "earnings" | "expenses">("overview");

  const netEarnings = r.gross + r.platformFee + r.hostyoFee + r.cleaningFee + r.expensesTotal;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "earnings" as const, label: "Earnings" },
    { key: "expenses" as const, label: "Expenses" },
  ];

  return (
    <div className="px-6 md:px-10 py-5">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#eaeaea] mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={(e) => { e.stopPropagation(); setTab(t.key); }}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.key ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <DetailItem label="Guest" value={r.guest} />
          <DetailItem label="Booking Ref" value={r.ref} />
          <DetailItem label="Property" value={r.property} />
          <div>
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide block mb-1">Channel</span>
            <ChannelBadge channel={r.channel} />
          </div>
          <DetailItem label="Total Guests" value={String(r.guests || 1)} />
          <DetailItem label="Total Nights" value={String(r.nights)} />
          <DetailItem label="Check-in" value={fmtDate(r.checkIn)} />
          <DetailItem label="Check-out" value={fmtDate(r.checkOut)} />
          <div>
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide block mb-1">Status</span>
            <span className={statusPillClass(r.status)}>{r.status}</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide block mb-1">Payout Status</span>
            <span className={statusPillClass(r.payoutStatus)}>{r.payoutStatus}</span>
          </div>
        </div>
      )}

      {/* Earnings Tab */}
      {tab === "earnings" && (
        <div className="max-w-[400px]">
          <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-4">
            <FinRow label="Gross Booking" value={fmtCurrency(r.gross)} />
            {r.platformFee !== 0 && <FinRow label="Platform Fee" value={fmtCurrency(r.platformFee)} neg />}
            {r.hostyoFee !== 0 && <FinRow label="Management Fee" value={fmtCurrency(r.hostyoFee)} neg />}
            {r.cleaningFee !== 0 && <FinRow label="Cleaning" value={fmtCurrency(r.cleaningFee)} neg />}
            {r.expensesTotal !== 0 && <FinRow label="Expenses" value={fmtCurrency(r.expensesTotal)} neg />}
            <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-[#e2e2e2]">
              <span className="text-[13px] font-bold text-[#111]">Owner Payout</span>
              <span className="text-[15px] font-bold text-[#80020E] tabular-nums">{fmtCurrency(r.ownerPayout || netEarnings)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {tab === "expenses" && (
        <div>
          <p className="text-[13px] text-[#999] mb-3">Expenses linked to this reservation.</p>
          {r.expensesTotal === 0 ? (
            <p className="text-[13px] text-[#bbb] italic">No linked expenses for this reservation.</p>
          ) : (
            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-4 max-w-[400px]">
              <FinRow label="Total Linked Expenses" value={fmtCurrency(r.expensesTotal)} neg />
            </div>
          )}
          {r.notionId && (
            <div className="mt-4">
              <ExpenseLinkButton notionId={r.notionId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide block mb-1">{label}</span>
      <span className="text-[13px] font-medium text-[#111]">{value || "—"}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f3f3f3] last:border-b-0">
      <span className="text-[12px] text-[#999]">{label}</span>
      <span className="text-[13px] font-medium text-[#111] text-right">{value}</span>
    </div>
  );
}

function FinRow({ label, value, neg }: { label: string; value: string; neg?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#f0f0f0] last:border-b-0">
      <span className="text-[13px] text-[#666]">{label}</span>
      <span className={`text-[13px] font-medium tabular-nums ${neg ? "text-[#7A5252]" : "text-[#111]"}`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expense Link Button                                                */
/* ------------------------------------------------------------------ */
function ExpenseLinkButton({ notionId }: { notionId: string }) {
  const [link, setLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/submit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: notionId }),
      });
      const data = await res.json();
      if (data.ok) setLink(data.url);
    } catch (e) {
      console.error("Failed to generate link:", e);
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!link) {
    return (
      <button onClick={generate} disabled={generating}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#80020E] text-white rounded-xl text-[12px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
        {generating ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        )}
        {generating ? "Generating..." : "Generate Expense Link"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2.5 bg-[#f8f8f8] border border-[#e2e2e2] rounded-xl">
        <input type="text" value={link} readOnly className="flex-1 text-[11px] text-[#555] bg-transparent outline-none font-mono truncate" />
        <button onClick={copyLink} className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${copied ? "bg-[#EAF3EF] text-[#2F6B57]" : "bg-[#80020E] text-white hover:bg-[#6b010c]"}`}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-[10px] text-[#999]">Share with vendor via WhatsApp, SMS, or email.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Content                                                       */
/* ------------------------------------------------------------------ */
function ReservationsContent() {
  const searchParams = useSearchParams();
  const guestParam = searchParams.get("guest") || "";

  const [data, setData] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "calendar">("list");
  const [drawerRes, setDrawerRes] = useState<Reservation | null>(null);
  const [propertyDrawerName, setPropertyDrawerName] = useState<string | null>(null);

  // Filters
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Fetch
  const { fetchData } = useData();
  useEffect(() => {
    fetchData("reservations", "/api/reservations")
      .then((res: unknown) => {
        const d = res as { source?: string; data?: unknown[] };
        if (d.source === "notion" && d.data?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: Reservation[] = d.data.map((r: any, i: number) => ({
            id: i + 1,
            notionId: r.notionId || "",
            ref: r.ref || "",
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
            ownerPayout: r.ownerPayout || 0,
            payoutStatus: r.payoutStatus || "Pending",
          }));
          setData(mapped);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // All property names for filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allPropertyNames, setAllPropertyNames] = useState<string[]>([]);
  useEffect(() => {
    fetchData("properties", "/api/properties")
      .then((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = d as { data?: any[] };
        const props = res.data || [];
        setAllProperties(props);
        const names = props.map((p) => p.name).filter((n: string) => n).sort((a: string, b: string) => a.localeCompare(b));
        setAllPropertyNames(names);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propertyImages = useMemo(() => {
    const map: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allProperties.forEach((p: any) => { if (p.name && p.coverUrl) map[p.name] = p.coverUrl; });
    return map;
  }, [allProperties]);

  const propertyOptions = useMemo(() =>
    allPropertyNames.map((p) => ({ value: p, label: p })),
  [allPropertyNames]);

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

  // Show property column only if >1 unique property AND "All Properties"
  const uniqueProperties = useMemo(() => new Set(data.map((r) => r.property)), [data]);
  const showPropertyCol = uniqueProperties.size > 1 && !filterProperty;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((r) => {
      if (filterProperty && r.property !== filterProperty) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterChannel && r.channel !== filterChannel) return false;
      if (q && !r.guest.toLowerCase().includes(q) && !r.ref.toLowerCase().includes(q)) return false;
      if (dateFrom && r.checkIn < dateFrom) return false;
      if (dateTo && r.checkIn > dateTo) return false;
      return true;
    });
  }, [data, filterProperty, filterStatus, filterChannel, search, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Auto-expand if ?guest= param
  useEffect(() => {
    if (guestParam && data.length > 0 && !loading) {
      const match = data.find((r) => r.guest.toLowerCase() === guestParam.toLowerCase());
      if (match) setExpandedId(match.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestParam, data, loading]);

  const toggleRow = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading) {
    return (
      <AppShell title="Reservations" minimalTopBar>
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading reservations...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reservations" minimalTopBar>
      {/* ── Mobile Search ── */}
      <div className="mb-3 md:hidden">
        <div className="relative">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reservations"
            className="w-full h-[40px] pl-9 pr-3 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
        </div>
      </div>

      {/* ── Mobile Filters (compact) ── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto md:hidden pb-1">
        <FilterDropdown placeholder="Properties" value={filterProperty} onChange={setFilterProperty} options={propertyOptions} searchable />
        <FilterDropdown placeholder="Status" value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
        <FilterDropdown placeholder="Channels" value={filterChannel} onChange={setFilterChannel} options={channelOptions} />
        <FilterDropdown placeholder="Dates" value={dateFrom ? "Filtered" : ""} onChange={() => {}} options={[]} />
      </div>

      {/* ── Mobile View Toggle (List / Calendar) ── */}
      <div className="flex gap-1 mb-4 md:hidden">
        <button onClick={() => setMobileView("list")} className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${mobileView === "list" ? "bg-[#80020E] text-white" : "bg-white text-[#555] border border-[#e2e2e2]"}`}>List</button>
        <button onClick={() => setMobileView("calendar")} className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${mobileView === "calendar" ? "bg-[#80020E] text-white" : "bg-white text-[#555] border border-[#e2e2e2]"}`}>Calendar</button>
      </div>

      {/* ── Desktop Filters + View Toggle ── */}
      <div className="hidden md:flex items-center gap-3 mb-4 flex-wrap">
        <FilterDropdown placeholder="All Properties" value={filterProperty} onChange={setFilterProperty} options={propertyOptions} searchable />
        <FilterDropdown placeholder="All Statuses" value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
        <FilterDropdown placeholder="All Channels" value={filterChannel} onChange={setFilterChannel} options={channelOptions} />
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest name or booking ref..."
            className="w-full h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
        </div>
        {/* List / Calendar toggle */}
        <div className="flex items-center border border-[#e2e2e2] rounded-lg overflow-hidden ml-auto">
          <button onClick={() => setMobileView("list")} className={`px-3.5 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-colors ${mobileView === "list" ? "bg-accent text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            List
          </button>
          <button onClick={() => setMobileView("calendar")} className={`px-3.5 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-colors ${mobileView === "calendar" ? "bg-accent text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Calendar
          </button>
        </div>
      </div>

      {/* ── Mobile Calendar View ── */}
      {mobileView === "calendar" && (
        <div className="md:hidden">
          <ReservationCalendar
            reservations={filtered.map((r) => ({ id: r.id, guest: r.guest, property: r.property, channel: r.channel, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, ownerPayout: r.ownerPayout }))}
            onReservationTap={(res) => {
              const match = filtered.find((r) => r.id === res.id);
              if (match) setDrawerRes(match);
            }}
            onPropertyTap={(name) => setPropertyDrawerName(name)}
            propertyImages={propertyImages}
            showAllProperties={showPropertyCol}
          />
        </div>
      )}

      {/* ── Mobile Card List ── */}
      {mobileView === "list" && (
        <div className="md:hidden space-y-3">
          {paginated.length === 0 ? (
            <div className="text-center py-10 text-[#999] text-sm">No reservations match your filters.</div>
          ) : paginated.map((r) => {
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isOpen ? "border-[#d0d0d0] shadow-sm" : "border-[#eaeaea]"}`}>
                {/* Card header */}
                <div onClick={() => toggleRow(r.id)} className="p-4 cursor-pointer">
                  {/* Status + Channel */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={statusPillClass(r.status)}>{r.status}</span>
                    <ChannelBadge channel={r.channel} compact />
                  </div>
                  {/* Guest name */}
                  <div className="text-[16px] font-semibold text-[#111] mb-0.5">{r.guest}</div>
                  {/* Property */}
                  <div className="text-[13px] text-[#888] mb-1.5 truncate">{r.property}</div>
                  {/* Dates + nights + guests */}
                  <div className="text-[12px] text-[#666] mb-2">
                    {fmtDateShort(r.checkIn)} → {fmtDateShort(r.checkOut)} · {r.nights} night{r.nights !== 1 ? "s" : ""} · {r.guests} guest{r.guests !== 1 ? "s" : ""}
                  </div>
                  {/* Payout */}
                  {r.ownerPayout > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#111]">{fmtCurrency(r.ownerPayout)}</span>
                      <span className="text-[11px] text-[#999]">· {r.payoutStatus} payout</span>
                    </div>
                  )}
                </div>
                {/* Accordion expansion */}
                <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="border-t border-[#eaeaea] bg-[#fafafa]">
                    <AccordionDetail r={r} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* ── Desktop Calendar ── */}
      {mobileView === "calendar" && (
        <div className={`hidden md:block ${showPropertyCol ? "" : "bg-white border border-[#eaeaea] rounded-xl p-6"}`}>
          <ReservationCalendar
            reservations={filtered.map((r) => ({ id: r.id, guest: r.guest, property: r.property, channel: r.channel, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, ownerPayout: r.ownerPayout }))}
            onReservationTap={(res) => { const match = filtered.find((rr) => rr.id === res.id); if (match) setDrawerRes(match); }}
            onPropertyTap={(name) => setPropertyDrawerName(name)}
            propertyImages={propertyImages}
            showAllProperties={showPropertyCol}
          />
        </div>
      )}

      {/* ── Desktop Table ── */}
      {mobileView === "list" && (
      <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-[13px] table-fixed">
          <colgroup>
            <col style={{ width: "110px" }} />
            {showPropertyCol && <col style={{ width: "200px" }} />}
            <col />
            <col style={{ width: "160px" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr className="bg-[#fafafa]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">Status</th>
              {showPropertyCol && <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">Property</th>}
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">Guest</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">Dates</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">Payout</th>
            </tr>
          </thead>
          {paginated.length === 0 ? (
            <tbody><tr><td colSpan={showPropertyCol ? 5 : 4} className="text-center py-10 text-[#999] text-sm">No reservations match your filters.</td></tr></tbody>
          ) : paginated.map((r) => {
            const isOpen = expandedId === r.id;
            const cols = showPropertyCol ? 5 : 4;
            return (
              <tbody key={r.id}>
                <tr onClick={() => toggleRow(r.id)}
                  className={`cursor-pointer transition-colors border-b ${isOpen ? "bg-[#fafafa] border-[#e2e2e2]" : "hover:bg-[#f9f9f9] border-[#f0f0f0]"}`}>
                  <td className="px-4 py-3.5">
                    <span className={statusPillClass(r.status)}>{r.status}</span>
                  </td>
                  {showPropertyCol && (
                    <td className="px-4 py-3.5">
                      <span className="text-[13px] text-[#555] truncate block">{r.property}</span>
                    </td>
                  )}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0">{getChannelIcon(r.channel)}</span>
                      <span className="text-[13px] font-medium text-[#111]">{r.guest}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#666] whitespace-nowrap">{fmtDateShort(r.checkIn)} – {fmtDateShort(r.checkOut)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-[13px] font-semibold text-[#111] tabular-nums">{fmtCurrency(r.ownerPayout || 0)}</span>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={cols} className="p-0 bg-[#fafafa] border-b border-[#e2e2e2]">
                      <AccordionDetail r={r} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#eaeaea]">
            <p className="text-[13px] text-[#999]">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:bg-[#f5f5f5] disabled:opacity-40 transition-colors">Prev</button>
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:bg-[#f5f5f5] disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Property Detail Drawer ── */}
      {propertyDrawerName && (() => {
        const prop = allProperties.find((p) => p.name === propertyDrawerName);
        if (!prop) return null;
        const location = [prop.city, prop.country].filter(Boolean).join(", ") || prop.address || "";
        return (
          <>
            <div className="fixed inset-0 bg-black/20 z-[100]" onClick={() => setPropertyDrawerName(null)} />
            <div className="fixed top-0 right-0 bottom-0 w-full md:max-w-[480px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[101] flex flex-col">
              <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
                <div className="text-[15px] font-semibold text-[#111]">Property Details</div>
                <button onClick={() => setPropertyDrawerName(null)} className="p-2 text-[#999] hover:text-[#555] transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Cover */}
                {prop.coverUrl && (
                  <div className="h-[160px] rounded-xl overflow-hidden mb-4 bg-[#f5f5f5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={prop.coverUrl} alt={prop.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-[18px] font-semibold text-[#111] mb-1">{prop.name}</div>
                {location && <div className="text-[13px] text-[#888] mb-1">{location}</div>}
                {prop.propertyType && <div className="text-[12px] text-[#666] bg-[#f5f5f5] px-2 py-0.5 rounded inline-block mb-3">{prop.propertyType}</div>}
                {prop.status && <div className="mb-4"><span className={`pill pill-${prop.status.toLowerCase().replace(/\s+/g, "")}`}>{prop.status}</span></div>}

                {/* Details */}
                <div className="space-y-2.5 mb-5">
                  {prop.bedrooms > 0 && <DetailRow label="Bedrooms" value={String(prop.bedrooms)} />}
                  {prop.bathrooms > 0 && <DetailRow label="Bathrooms" value={String(prop.bathrooms)} />}
                  {prop.maxGuests > 0 && <DetailRow label="Max Guests" value={String(prop.maxGuests)} />}
                  {prop.address && <DetailRow label="Address" value={prop.address} />}
                  {prop.price > 0 && <DetailRow label="Price" value={`€${prop.price}/night`} />}
                  {prop.cleaningFee > 0 && <DetailRow label="Cleaning Fee" value={`€${prop.cleaningFee}`} />}
                  {prop.accessCode && <DetailRow label="Access Code" value={prop.accessCode} />}
                  {prop.license && <DetailRow label="License" value={prop.license} />}
                </div>

                {/* Connected Channels */}
                {prop.connectedChannels?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[#999] uppercase tracking-wide mb-2">Connected Channels</div>
                    <div className="flex gap-2 flex-wrap">
                      {prop.connectedChannels.map((ch: string) => (
                        <ChannelBadge key={ch} channel={ch} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Calendar Detail Drawer ── */}
      {drawerRes && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[100]" onClick={() => setDrawerRes(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full md:max-w-[480px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[101] flex flex-col">
            <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
              <div className="text-[15px] font-semibold text-[#111]">Reservation Details</div>
              <button onClick={() => setDrawerRes(null)} className="p-2 text-[#999] hover:text-[#555] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AccordionDetail r={drawerRes} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */
export default function ReservationsPage() {
  return (
    <Suspense fallback={<AppShell title="Reservations" minimalTopBar><div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading...</div></AppShell>}>
      <ReservationsContent />
    </Suspense>
  );
}
