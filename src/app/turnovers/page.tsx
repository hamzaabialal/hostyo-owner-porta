"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import InventoryView from "@/components/InventoryView";
import { useEffectiveSession } from "@/lib/useEffectiveSession";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Property = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any;

type TurnoverStatus = "Pending" | "In progress" | "Submitted" | "Completed";

interface TurnoverCard {
  propertyId: string;
  propertyName: string;
  location: string;
  coverUrl: string;
  // Departure: checkout of the most recent reservation that's checking out
  departure: string;
  nextArrival: string;
  guests: number;
  status: TurnoverStatus;
  completedSteps: number;
  totalSteps: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function fmtRelativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (dayStart.getTime() === today.getTime()) return `Today at ${timeStr}`;
    if (dayStart.getTime() === yesterday.getTime()) return `Yesterday at ${timeStr}`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function statusColor(status: TurnoverStatus): { dot: string; text: string } {
  switch (status) {
    case "Completed": return { dot: "#2F6B57", text: "text-[#2F6B57]" };
    case "Submitted": return { dot: "#3B5BA5", text: "text-[#3B5BA5]" };
    case "In progress": return { dot: "#D4A843", text: "text-[#8A6A2E]" };
    default: return { dot: "#D4A843", text: "text-[#8A6A2E]" };
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function TurnoversPage() {
  const { data: session } = useSession();
  const router = useRouter();
  void session;
  const { isAdmin } = useEffectiveSession();

  const [tab, setTab] = useState<"cleaning" | "issues" | "inventory">("cleaning");
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turnovers, setTurnovers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [issuesList, setIssuesList] = useState<any[]>([]);
  // Issues tab state
  const [issueSearch, setIssueSearch] = useState("");
  const [issueStatusFilter, setIssueStatusFilter] = useState("");
  const [issuePropertyFilter, setIssuePropertyFilter] = useState("");
  const [issueSort, setIssueSort] = useState<"created" | "severity">("created");
  const [issuePage, setIssuePage] = useState(1);
  const [issuesPerPage, setIssuesPerPage] = useState(10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [openIssue, setOpenIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterProperty, setFilterProperty] = useState<string>("");
  const [showAddTurnover, setShowAddTurnover] = useState(false);
  const [showAddIssue, setShowAddIssue] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/properties").then((r) => r.json()),
      fetch("/api/reservations").then((r) => r.json()),
      fetch("/api/turnovers").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/turnovers?issues=1").then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([pData, rData, tData, iData]) => {
        setProperties(pData?.data || []);
        setReservations(rData?.data || []);
        setTurnovers(tData?.data || []);
        setIssuesList(iData?.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build cleaning cards from properties with cleaning checkbox enabled.
  // For each property, find the most recent upcoming checkout (or the last one that's happened).
  const cleaningCards = useMemo<TurnoverCard[]>(() => {
    const today = new Date().toISOString().split("T")[0];
    const cleaningProps = properties.filter((p: Property) => p.cleaning === true);
    const seen = new Set<string>();

    const cards: TurnoverCard[] = [];
    for (const p of cleaningProps) {
      const propName = (p.name || "").trim().toLowerCase();
      const propReservations = reservations
        .filter((r: Reservation) => (r.property || "").trim().toLowerCase() === propName)
        .filter((r: Reservation) => r.status !== "Cancelled");

      // Find the next relevant checkout:
      //   1. If a checkout is today or in the future → that's the next cleaning
      //   2. Otherwise, use the most recent past checkout
      const upcomingCheckouts = propReservations
        .filter((r: Reservation) => (r.checkout || "") >= today)
        .sort((a: Reservation, b: Reservation) => (a.checkout || "").localeCompare(b.checkout || ""));
      const pastCheckouts = propReservations
        .filter((r: Reservation) => (r.checkout || "") < today)
        .sort((a: Reservation, b: Reservation) => (b.checkout || "").localeCompare(a.checkout || ""));

      const turnoverRes = upcomingCheckouts[0] || pastCheckouts[0];
      if (!turnoverRes) continue; // No reservations at all — skip

      const departure = turnoverRes.checkout || "";
      // Find the arrival that's after this checkout
      const nextArrivalRes = propReservations
        .filter((r: Reservation) => (r.checkin || "") >= departure && r.ref !== turnoverRes.ref)
        .sort((a: Reservation, b: Reservation) => (a.checkin || "").localeCompare(b.checkin || ""))[0];
      const nextArrival = nextArrivalRes?.checkin || "";
      const guests = nextArrivalRes ? ((nextArrivalRes.adults || 0) + (nextArrivalRes.children || 0) || 2) : 2;

      // Find existing turnover record for this property+departure combo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = turnovers.find((t: any) => t.propertyId === p.id && t.departureDate === departure);
      let cardStatus: TurnoverStatus = "Pending";
      let completed = 0;
      let total = 5;
      if (existing) {
        cardStatus = existing.status === "Submitted" || existing.status === "Completed" ? existing.status as TurnoverStatus : existing.status === "In progress" ? "In progress" : "Pending";
        // Count uploaded photos for rough progress indication
        completed = Object.keys(existing.items || {}).length;
        total = Math.max(total, completed);
      }

      cards.push({
        propertyId: p.id,
        propertyName: p.name || "Property",
        location: [p.city, p.country].filter(Boolean).join(", ") || p.address || "",
        coverUrl: p.coverUrl || "",
        departure,
        nextArrival,
        guests,
        status: cardStatus,
        completedSteps: completed,
        totalSteps: total,
      });
      seen.add(`${p.id}__${departure}`);
    }

    // Include any manually-created turnovers that aren't already surfaced via reservations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of turnovers as any[]) {
      const key = `${t.propertyId}__${t.departureDate}`;
      if (seen.has(key)) continue;
      const p = properties.find((pp: Property) => pp.id === t.propertyId);
      const propName = t.propertyName || p?.name || "Property";
      const propReservations = reservations
        .filter((r: Reservation) => (r.property || "").trim().toLowerCase() === (propName || "").trim().toLowerCase())
        .filter((r: Reservation) => r.status !== "Cancelled");
      const nextArrivalRes = propReservations
        .filter((r: Reservation) => (r.checkin || "") >= (t.departureDate || ""))
        .sort((a: Reservation, b: Reservation) => (a.checkin || "").localeCompare(b.checkin || ""))[0];

      const completed = Object.keys(t.items || {}).length;
      const total = Math.max(5, completed);
      const cardStatus: TurnoverStatus =
        t.status === "Submitted" || t.status === "Completed" ? t.status as TurnoverStatus :
        t.status === "In progress" ? "In progress" : "Pending";

      cards.push({
        propertyId: t.propertyId,
        propertyName: propName,
        location: t.propertyLocation || [p?.city, p?.country].filter(Boolean).join(", ") || p?.address || "",
        coverUrl: t.propertyCoverUrl || p?.coverUrl || "",
        departure: t.departureDate || "",
        nextArrival: nextArrivalRes?.checkin || "",
        guests: nextArrivalRes ? ((nextArrivalRes.adults || 0) + (nextArrivalRes.children || 0) || 2) : 2,
        status: cardStatus,
        completedSteps: completed,
        totalSteps: total,
      });
      seen.add(key);
    }

    // Sort: upcoming turnovers first (closest departure first), then past ones
    // ordered most-recent first. "Closest at top, furthest at bottom."
    cards.sort((a, b) => {
      const aDate = a.departure || "9999";
      const bDate = b.departure || "9999";
      const aPast = aDate < today;
      const bPast = bDate < today;
      if (aPast !== bPast) return aPast ? 1 : -1; // upcoming before past
      if (aPast && bPast) return bDate.localeCompare(aDate); // past: most recent first
      return aDate.localeCompare(bDate); // upcoming: soonest first
    });

    return cards;
  }, [properties, reservations, turnovers]);

  const filteredCards = useMemo(() => {
    return cleaningCards.filter((c) => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterProperty && c.propertyName !== filterProperty) return false;
      return true;
    });
  }, [cleaningCards, filterStatus, filterProperty]);

  // Issues filtering + sorting + pagination
  const sortedIssues = useMemo(() => {
    const q = issueSearch.toLowerCase().trim();
    const sevOrder = { High: 0, Medium: 1, Low: 2 } as Record<string, number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = issuesList.filter((iss: any) => {
      if (issueStatusFilter === "pending" && iss.resolved) return false;
      if (issueStatusFilter === "resolved" && !iss.resolved) return false;
      if (issuePropertyFilter && iss.propertyName !== issuePropertyFilter) return false;
      if (q) {
        const hay = `${iss.propertyName || ""} ${iss.title || ""} ${iss.description || ""} ${iss.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return filtered.sort((a: any, b: any) => {
      if (issueSort === "severity") {
        const sa = sevOrder[a.severity || "Low"] ?? 99;
        const sb = sevOrder[b.severity || "Low"] ?? 99;
        if (sa !== sb) return sa - sb;
      }
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [issuesList, issueSearch, issueStatusFilter, issuePropertyFilter, issueSort]);

  const totalIssuePages = Math.max(1, Math.ceil(sortedIssues.length / issuesPerPage));
  const pagedIssues = useMemo(() => {
    const start = (issuePage - 1) * issuesPerPage;
    return sortedIssues.slice(start, start + issuesPerPage);
  }, [sortedIssues, issuePage, issuesPerPage]);

  const issuePropertyOptions = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.from(new Set(issuesList.map((i: any) => i.propertyName).filter(Boolean))).sort() as string[];
  }, [issuesList]);

  const toggleResolveIssue = async (iss: { id: string; propertyId: string; departureDate: string; resolved?: boolean }) => {
    if (iss.resolved) return; // Only allow resolving (undo is done from the turnover detail)
    await fetch("/api/turnovers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: iss.propertyId, departureDate: iss.departureDate, resolveIssue: iss.id }),
    });
    // Refresh issues
    const res = await fetch("/api/turnovers?issues=1").then((r) => r.json()).catch(() => ({ data: [] }));
    setIssuesList(res?.data || []);
    if (openIssue?.id === iss.id) setOpenIssue({ ...openIssue, resolved: true });
  };

  if (!isAdmin) {
    return (
      <AppShell title="Turnovers">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">
          You don&apos;t have permission to access this page.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Turnovers">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#eaeaea] mb-5">
        {[
          { key: "cleaning" as const, label: "Cleaning" },
          { key: "issues" as const, label: "Issues" },
          { key: "inventory" as const, label: "Inventory" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "text-[#80020E] border-[#80020E]"
                : "text-[#999] border-transparent hover:text-[#555]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Cleaning Tab ═══ */}
      {tab === "cleaning" && (
        <>
          {/* Filters + Add */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <select className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]" value="">
              <option value="">Date</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="In progress">In progress</option>
              <option value="Submitted">Submitted</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E] max-w-[200px]"
            >
              <option value="">All properties</option>
              {Array.from(new Set(cleaningCards.map((c) => c.propertyName))).sort().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filters
            </button>
            <button onClick={() => setShowAddTurnover(true)} className="ml-auto flex items-center gap-1.5 h-[36px] px-3 rounded-lg bg-[#80020E] text-white text-[12px] font-medium hover:bg-[#6b010c] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add turnover
            </button>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading turnovers...</div>
          ) : filteredCards.length === 0 ? (
            <div className="bg-white border border-[#eaeaea] rounded-xl p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </div>
              <div className="text-[15px] font-semibold text-[#111] mb-1">No cleaning turnovers</div>
              <div className="text-[13px] text-[#888] max-w-[380px] mx-auto">
                Enable the <strong>Cleaning</strong> checkbox on properties in Notion to see them appear here automatically.
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filteredCards.map((c) => {
                  const sc = statusColor(c.status);
                  const progressPct = (c.completedSteps / c.totalSteps) * 100;
                  return (
                    <div
                      key={c.propertyId}
                      onClick={() => router.push(`/turnovers/${c.propertyId}?departure=${encodeURIComponent(c.departure)}`)}
                      className="bg-white border border-[#eaeaea] rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] transition-all cursor-pointer"
                    >
                      {/* Top row on mobile: photo + name/location + status pill */}
                      <div className="flex items-start gap-3 md:contents">
                        {/* Photo */}
                        <div className="w-[56px] h-[56px] md:w-[72px] md:h-[60px] rounded-lg bg-[#f5f5f5] overflow-hidden flex-shrink-0">
                          {c.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverUrl} alt={c.propertyName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            </div>
                          )}
                        </div>

                        {/* Property info */}
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] md:text-[15px] font-semibold text-[#111] truncate">{c.propertyName}</div>
                          {c.location && <div className="text-[11px] md:text-[12px] text-[#888] truncate">{c.location}</div>}
                          <div className="text-[11px] text-[#999] mt-1 flex items-center gap-3 flex-wrap">
                            <span className="whitespace-nowrap">Next arrival: {c.nextArrival ? fmtDate(c.nextArrival) : "—"}</span>
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                              {c.guests} guests
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status + Departure + Progress */}
                      <div className="flex flex-col items-stretch md:items-end gap-1.5 md:gap-2 md:flex-shrink-0 md:min-w-[260px]">
                        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.dot }} />
                            <span className={`text-[12px] font-medium ${sc.text}`}>{c.status}</span>
                          </div>
                          <div className="text-[11px] md:text-[12px] text-[#666] whitespace-nowrap">Departure: <span className="font-semibold text-[#111]">{fmtDate(c.departure)}</span></div>
                          <div className="text-[10px] md:text-[11px] text-[#999] whitespace-nowrap">{c.completedSteps} / {c.totalSteps} completed</div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#80020E]" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-[#999] mt-4">Showing {filteredCards.length} of {cleaningCards.length} turnovers</div>
            </>
          )}
        </>
      )}

      {/* ═══ Issues Tab ═══ */}
      {tab === "issues" && (
        <>
          <div className="mb-4">
            <div className="text-[18px] font-bold text-[#111] mb-0.5">Issues</div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="relative flex-1 min-w-[220px] max-w-[260px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={issueSearch}
                onChange={(e) => { setIssueSearch(e.target.value); setIssuePage(1); }}
                placeholder="Search issues..."
                className="w-full h-[36px] pl-8 pr-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <select value={issueStatusFilter} onChange={(e) => { setIssueStatusFilter(e.target.value); setIssuePage(1); }}
              className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={issuePropertyFilter} onChange={(e) => { setIssuePropertyFilter(e.target.value); setIssuePage(1); }}
              className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E] max-w-[200px]">
              <option value="">All properties</option>
              {issuePropertyOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={issueSort} onChange={(e) => setIssueSort(e.target.value as "created" | "severity")}
              className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]">
              <option value="created">Sort by created time</option>
              <option value="severity">Sort by severity</option>
            </select>
            <button onClick={() => setShowAddIssue(true)} className="ml-auto flex items-center gap-1.5 h-[36px] px-3 rounded-lg bg-[#80020E] text-white text-[12px] font-medium hover:bg-[#6b010c] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add issue
            </button>
          </div>

          {issuesList.length === 0 ? (
            <div className="bg-white border border-[#eaeaea] rounded-xl p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="text-[15px] font-semibold text-[#111] mb-1">No issues reported</div>
              <div className="text-[13px] text-[#888] max-w-[380px] mx-auto">Issues raised during turnovers will appear here.</div>
            </div>
          ) : (
            <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#fafafa]">
                      {["Property", "Issue", "Status", "Created", ""].map((h, i) => (
                        <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {pagedIssues.map((iss: any) => {
                      const isHigh = iss.severity === "High";
                      return (
                        <tr key={iss.id} onClick={() => setOpenIssue(iss)} className="border-b border-[#f3f3f3] last:border-b-0 hover:bg-[#fafafa] cursor-pointer transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {iss.propertyCoverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={iss.propertyCoverUrl} alt="" className="w-[36px] h-[28px] rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-[36px] h-[28px] rounded bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-[#111] truncate">{iss.propertyName || "—"}</div>
                                {iss.propertyLocation && <div className="text-[10px] text-[#999] truncate">{iss.propertyLocation}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#333] max-w-[280px]">
                            <div className="truncate">{iss.title || iss.description}</div>
                          </td>
                          <td className="px-4 py-3">
                            {iss.resolved ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#2F6B57]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#2F6B57]" />Resolved
                              </span>
                            ) : isHigh ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#B7484F]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#B7484F]" />High
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#8A6A2E]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4A843]" />Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#666] text-[12px] whitespace-nowrap">{fmtRelativeTime(iss.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setOpenIssue(iss); }} className="text-[16px] text-[#bbb] hover:text-[#555] transition-colors px-2">⋯</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden divide-y divide-[#f3f3f3]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {pagedIssues.map((iss: any) => {
                  const isHigh = iss.severity === "High";
                  return (
                    <div key={iss.id} onClick={() => setOpenIssue(iss)} className="flex items-start gap-3 p-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors">
                      {iss.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iss.photoUrl} alt="issue" className="w-[52px] h-[52px] rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-[52px] h-[52px] rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111] truncate">{iss.propertyName || "—"}</div>
                        <div className="text-[12px] text-[#555] truncate">{iss.title || iss.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {iss.resolved ? (
                            <span className="text-[10px] font-semibold text-[#2F6B57] bg-[#EAF3EF] px-1.5 py-0.5 rounded-full">Resolved</span>
                          ) : isHigh ? (
                            <span className="text-[10px] font-semibold text-[#B7484F] bg-[#F6EDED] px-1.5 py-0.5 rounded-full">High</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[#8A6A2E] bg-[#FBF1E2] px-1.5 py-0.5 rounded-full">Pending</span>
                          )}
                          <span className="text-[10px] text-[#999]">{fmtRelativeTime(iss.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
                <select value={issuesPerPage} onChange={(e) => { setIssuesPerPage(Number(e.target.value)); setIssuePage(1); }}
                  className="h-[30px] px-2 border border-[#e2e2e2] rounded-md text-[11px] text-[#555] bg-white">
                  <option value={10}>Show 10 / page</option>
                  <option value={25}>Show 25 / page</option>
                  <option value={50}>Show 50 / page</option>
                </select>
                <div className="flex items-center gap-1">
                  <button disabled={issuePage === 1} onClick={() => setIssuePage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#e2e2e2] text-[#666] disabled:opacity-40 hover:border-[#ccc] transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  {Array.from({ length: Math.min(totalIssuePages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button key={pageNum} onClick={() => setIssuePage(pageNum)}
                        className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-medium transition-colors ${issuePage === pageNum ? "bg-[#80020E] text-white" : "text-[#666] hover:bg-[#f0f0f0]"}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalIssuePages > 5 && <span className="text-[11px] text-[#999] px-1">...</span>}
                  <button disabled={issuePage === totalIssuePages} onClick={() => setIssuePage((p) => Math.min(totalIssuePages, p + 1))}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#e2e2e2] text-[#666] disabled:opacity-40 hover:border-[#ccc] transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Issue detail modal */}
          {openIssue && (
            <>
              <div className="fixed inset-0 bg-black/40 z-[100]" onClick={() => setOpenIssue(null)} />
              <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-[500px] md:w-full">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#eaeaea] flex items-center justify-between sticky top-0 bg-white z-10">
                  <div>
                    <div className="text-[15px] font-bold text-[#111]">Issue details</div>
                    <div className="text-[11px] text-[#888]">{fmtRelativeTime(openIssue.createdAt)}</div>
                  </div>
                  <button onClick={() => setOpenIssue(null)} className="p-1.5 text-[#999] hover:text-[#555] transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Status + severity + category pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {openIssue.resolved ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F6B57] bg-[#EAF3EF] px-2 py-1 rounded-full">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8A6A2E] bg-[#FBF1E2] px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4A843]" />Pending
                      </span>
                    )}
                    {openIssue.severity && (
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                        openIssue.severity === "High" ? "text-[#B7484F] bg-[#F6EDED]" :
                        openIssue.severity === "Medium" ? "text-[#8A6A2E] bg-[#FBF1E2]" :
                        "text-[#2F6B57] bg-[#EAF3EF]"
                      }`}>{openIssue.severity}</span>
                    )}
                    {openIssue.category && (
                      <span className="text-[11px] font-semibold text-[#555] bg-[#f5f5f5] px-2 py-1 rounded-full">{openIssue.category}</span>
                    )}
                  </div>

                  {/* Property card */}
                  <div className="flex items-center gap-3 bg-[#fafafa] border border-[#eaeaea] rounded-lg p-3">
                    {openIssue.propertyCoverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={openIssue.propertyCoverUrl} alt="" className="w-[48px] h-[40px] rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-[48px] h-[40px] rounded bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#111] truncate">{openIssue.propertyName || "—"}</div>
                      {openIssue.propertyLocation && <div className="text-[11px] text-[#888] truncate">{openIssue.propertyLocation}</div>}
                      <div className="text-[10px] text-[#999] mt-0.5">Checkout {new Date((openIssue.departureDate || "") + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                  </div>

                  {/* Title */}
                  {openIssue.title && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Issue type</div>
                      <div className="text-[14px] font-semibold text-[#111]">{openIssue.title}</div>
                    </div>
                  )}

                  {/* Photo */}
                  {openIssue.photoUrl && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Photo</div>
                      <a href={openIssue.photoUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[#eaeaea]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={openIssue.photoUrl} alt="issue" className="w-full max-h-[320px] object-cover" />
                      </a>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Description</div>
                    <div className="text-[13px] text-[#333] leading-relaxed bg-[#fafafa] border border-[#eaeaea] rounded-lg p-3 whitespace-pre-wrap">{openIssue.description}</div>
                  </div>

                  {/* Map location — tries location first, falls back to property name */}
                  {(() => {
                    const queryText = openIssue.propertyLocation || openIssue.propertyName || "";
                    if (!queryText) {
                      return (
                        <div>
                          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Location</div>
                          <div className="text-[12px] text-[#999] bg-[#fafafa] border border-[#eaeaea] rounded-lg p-3">
                            No location available. Add City/Country/Address to the property in Notion to see a map.
                          </div>
                        </div>
                      );
                    }
                    const query = encodeURIComponent(queryText);
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Location</div>
                          <a href={`https://www.google.com/maps?q=${query}`} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-[#80020E] hover:underline">Open in Google Maps ↗</a>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-[#eaeaea]">
                          <iframe
                            title="Issue location map"
                            src={`https://www.google.com/maps?q=${query}&output=embed`}
                            className="w-full h-[200px]"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                        <div className="text-[10px] text-[#999] mt-1.5">Based on: {queryText}</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-[#eaeaea] bg-[#fafafa] flex items-center justify-between gap-3 sticky bottom-0">
                  <button
                    onClick={() => {
                      const issCopy = openIssue;
                      setOpenIssue(null);
                      router.push(`/turnovers/${issCopy.propertyId}?departure=${encodeURIComponent(issCopy.departureDate)}`);
                    }}
                    className="text-[12px] font-medium text-[#80020E] hover:underline"
                  >
                    Open turnover →
                  </button>
                  {!openIssue.resolved ? (
                    <button onClick={() => toggleResolveIssue(openIssue)}
                      className="h-[36px] px-4 rounded-lg bg-[#2F6B57] text-white text-[12px] font-semibold hover:bg-[#225244] transition-colors">
                      Mark as resolved
                    </button>
                  ) : (
                    <span className="text-[12px] font-semibold text-[#2F6B57]">✓ Resolved</span>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ Inventory Tab ═══ */}
      {tab === "inventory" && <InventoryView properties={properties} />}

      {showAddTurnover && (
        <AddTurnoverModal
          properties={properties}
          reservations={reservations}
          onClose={() => setShowAddTurnover(false)}
          onSaved={async () => {
            const tData = await fetch("/api/turnovers").then((r) => r.json()).catch(() => ({ data: [] }));
            setTurnovers(tData?.data || []);
            setShowAddTurnover(false);
          }}
        />
      )}

      {showAddIssue && (
        <AddIssueModal
          properties={properties}
          reservations={reservations}
          turnovers={turnovers}
          onClose={() => setShowAddIssue(false)}
          onSaved={async () => {
            const [iData, tData] = await Promise.all([
              fetch("/api/turnovers?issues=1").then((r) => r.json()).catch(() => ({ data: [] })),
              fetch("/api/turnovers").then((r) => r.json()).catch(() => ({ data: [] })),
            ]);
            setIssuesList(iData?.data || []);
            setTurnovers(tData?.data || []);
            setShowAddIssue(false);
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Turnover Modal                                                 */
/* ------------------------------------------------------------------ */
function AddTurnoverModal({ properties, reservations, onClose, onSaved }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservations: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [cleanerName, setCleanerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only "Live" properties with a real name are selectable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveProperties = useMemo(() => properties.filter((p: any) => {
    const hasName = typeof p.name === "string" && p.name.trim().length > 0;
    const isLive = p.status === "Live";
    return hasName && isLive;
  }), [properties]);

  // Suggest upcoming checkouts for the selected property
  const suggestedDates = useMemo(() => {
    if (!propertyId) return [] as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = properties.find((p: any) => p.id === propertyId);
    if (!prop) return [];
    const propName = (prop.name || "").trim().toLowerCase();
    const today = new Date().toISOString().split("T")[0];
    return Array.from(new Set(reservations
      .filter((r) => (r.property || "").trim().toLowerCase() === propName)
      .filter((r) => r.status !== "Cancelled" && (r.checkout || "") >= today)
      .map((r) => r.checkout)
      .filter(Boolean)))
      .sort() as string[];
  }, [propertyId, properties, reservations]);

  const handleSave = async () => {
    setError("");
    if (!propertyId || !departureDate) {
      setError("Please select a property and departure date.");
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = properties.find((p: any) => p.id === propertyId);
      const res = await fetch("/api/turnovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          propertyName: prop?.name,
          propertyBedrooms: prop?.bedrooms,
          propertyBathrooms: prop?.bathrooms,
          propertyLocation: [prop?.city, prop?.country].filter(Boolean).join(", "),
          propertyCoverUrl: prop?.coverUrl,
          departureDate,
          cleanerName,
        }),
      }).then((r) => r.json());
      if (res?.error) {
        setError(res.error);
      } else {
        onSaved();
      }
    } catch {
      setError("Failed to create turnover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-center justify-between">
          <div className="text-[15px] font-bold text-[#111]">Add turnover</div>
          <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
              <option value="">Select property</option>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {liveProperties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Departure date</label>
            {suggestedDates.length > 0 ? (
              <select value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E] mb-2">
                <option value="">Select upcoming checkout...</option>
                {suggestedDates.map((d) => (
                  <option key={d} value={d}>{fmtDate(d)}</option>
                ))}
              </select>
            ) : null}
            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
            <div className="text-[11px] text-[#999] mt-1">
              {suggestedDates.length > 0 ? "Pick from upcoming checkouts, or enter a custom date." : "No upcoming checkouts found — enter a date manually."}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Cleaner name (optional)</label>
            <input type="text" value={cleanerName} onChange={(e) => setCleanerName(e.target.value)}
              placeholder="e.g. Maria"
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
          </div>
          {error && <div className="text-[12px] text-[#B7484F] bg-[#F6EDED] px-3 py-2 rounded-lg">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] flex justify-end gap-2">
          <button onClick={onClose} className="h-[36px] px-4 text-[12px] font-medium text-[#666] hover:text-[#111] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!propertyId || !departureDate || saving}
            className="h-[36px] px-4 rounded-lg bg-[#80020E] text-white text-[12px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
            {saving ? "Adding..." : "Add turnover"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Issue Modal                                                    */
/* ------------------------------------------------------------------ */
function AddIssueModal({ properties, reservations, turnovers, onClose, onSaved }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  turnovers: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High">("Medium");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only "Live" properties with a real name are selectable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveProperties = useMemo(() => properties.filter((p: any) => {
    const hasName = typeof p.name === "string" && p.name.trim().length > 0;
    const isLive = p.status === "Live";
    return hasName && isLive;
  }), [properties]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestedDates = useMemo(() => {
    if (!propertyId) return [] as string[];
    const prop = properties.find((p) => p.id === propertyId);
    if (!prop) return [];
    const propName = (prop.name || "").trim().toLowerCase();
    // Combine reservation checkouts AND existing turnover departure dates for this property
    const dates = new Set<string>();
    for (const r of reservations) {
      if ((r.property || "").trim().toLowerCase() !== propName) continue;
      if (r.status === "Cancelled") continue;
      if (r.checkout) dates.add(r.checkout);
    }
    for (const t of turnovers) {
      if (t.propertyId === propertyId && t.departureDate) dates.add(t.departureDate);
    }
    return Array.from(dates).sort((a, b) => (b as string).localeCompare(a as string));
  }, [propertyId, properties, reservations, turnovers]);

  // Auto-select the "current" departure date for the picked property:
  //   1. Existing turnover for this property (most recent), OR
  //   2. Next upcoming checkout, OR
  //   3. Most recent past checkout
  // This keeps the issue attached to the EXISTING cleaning card rather than
  // creating a new turnover record with an arbitrary date.
  useEffect(() => {
    if (!propertyId) { setDepartureDate(""); return; }
    const today = new Date().toISOString().split("T")[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (turnovers as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.propertyId === propertyId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (b.departureDate || "").localeCompare(a.departureDate || ""))[0];
    if (existing?.departureDate) { setDepartureDate(existing.departureDate); return; }
    const upcoming = suggestedDates.filter((d) => d >= today).sort()[0];
    if (upcoming) { setDepartureDate(upcoming); return; }
    const mostRecentPast = suggestedDates[0]; // already sorted desc
    if (mostRecentPast) { setDepartureDate(mostRecentPast); return; }
    setDepartureDate("");
  }, [propertyId, turnovers, suggestedDates]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/inventory/upload", { method: "POST", body: fd }).then((r) => r.json());
      if (res?.ok && res.url) setPhotoUrl(res.url);
      else setError(res?.error || "Upload failed");
    } catch { setError("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setError("");
    if (!propertyId || !departureDate || !description.trim()) {
      setError("Property, departure date and description are required.");
      return;
    }
    setSaving(true);
    try {
      const prop = properties.find((p) => p.id === propertyId);
      // PATCH auto-creates the turnover record if it doesn't exist yet
      // (admin-only). This avoids regenerating the cleaner token via POST.
      const httpRes = await fetch("/api/turnovers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          departureDate,
          propertyName: prop?.name,
          propertyBedrooms: prop?.bedrooms,
          propertyBathrooms: prop?.bathrooms,
          propertyLocation: [prop?.city, prop?.country].filter(Boolean).join(", "),
          propertyCoverUrl: prop?.coverUrl,
          addIssue: {
            category: category || undefined,
            title: title || undefined,
            description: description.trim(),
            severity,
            photoUrl: photoUrl || undefined,
          },
        }),
      });
      const res = await httpRes.json().catch(() => ({} as { error?: string; ok?: boolean }));
      if (!httpRes.ok || res?.error) {
        console.error("Add issue failed", { status: httpRes.status, body: res });
        setError(res?.error || `Failed (HTTP ${httpRes.status})`);
        return;
      }
      onSaved();
    } catch (e) {
      console.error("Add issue exception", e);
      setError("Failed to add issue — check console");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-center justify-between">
          <div className="text-[15px] font-bold text-[#111]">Add issue</div>
          <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">Property</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
                className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
                <option value="">Select property</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {liveProperties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">Departure date</label>
              {suggestedDates.length > 0 ? (
                <select value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
                  <option value="">Select checkout...</option>
                  {suggestedDates.map((d) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const existing = (turnovers as any[]).find((t: any) => t.propertyId === propertyId && t.departureDate === d);
                    return <option key={d} value={d}>{fmtDate(d)}{existing ? " — existing turnover" : ""}</option>;
                  })}
                </select>
              ) : (
                <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
              )}
              {propertyId && departureDate && (() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existing = (turnovers as any[]).find((t: any) => t.propertyId === propertyId && t.departureDate === departureDate);
                return (
                  <div className={`text-[10px] mt-1 ${existing ? "text-[#2F6B57]" : "text-[#8A6A2E]"}`}>
                    {existing
                      ? "✓ Attaching to existing turnover"
                      : "⚠ This will create a new turnover for this date"}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
                <option value="">Select category</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Bedroom">Bedroom</option>
                <option value="Living Room">Living Room</option>
                <option value="Bathroom">Bathroom</option>
                <option value="Balcony">Balcony</option>
                <option value="Hallway">Hallway</option>
                <option value="Exterior">Exterior</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as "Low" | "Medium" | "High")}
                className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Title (optional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken appliance"
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..." rows={4}
              className="w-full px-3 py-2 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E] resize-y" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Photo (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {photoUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#eaeaea]" />
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] text-[#80020E] font-medium hover:underline">Replace</button>
                <button type="button" onClick={() => setPhotoUrl("")} className="text-[12px] text-[#999] hover:text-[#B7484F]">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full h-[70px] border-2 border-dashed border-[#e2e2e2] rounded-lg text-[12px] text-[#888] hover:border-[#80020E] hover:text-[#80020E] transition-colors">
                {uploading ? "Uploading..." : "Click to upload photo"}
              </button>
            )}
          </div>
          {error && <div className="text-[12px] text-[#B7484F] bg-[#F6EDED] px-3 py-2 rounded-lg">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] flex justify-end gap-2">
          <button onClick={onClose} className="h-[36px] px-4 text-[12px] font-medium text-[#666] hover:text-[#111] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!propertyId || !departureDate || !description.trim() || saving}
            className="h-[36px] px-4 rounded-lg bg-[#80020E] text-white text-[12px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
            {saving ? "Adding..." : "Add issue"}
          </button>
        </div>
      </div>
    </>
  );
}
