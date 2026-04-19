"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { buildChecklist, countChecklistItems, itemKey, type ChecklistCategory } from "@/lib/turnover-checklist";

/* ------------------------------------------------------------------ */
interface TurnoverPhoto { url: string; uploadedAt: string; exifDateTime?: string; deviceModel?: string; latitude?: number; longitude?: number; }
interface TurnoverIssue { id: string; description: string; photoUrl?: string; createdAt: string; categoryId?: string; subcategoryId?: string; itemId?: string; resolved?: boolean; }
interface TurnoverRecord {
  id: string; propertyId: string; propertyName?: string; departureDate: string;
  status: "Pending" | "In progress" | "Submitted" | "Completed";
  items: Record<string, TurnoverPhoto[]>;
  issues: TurnoverIssue[];
  notes?: string;
  cleanerName?: string;
  cleanerToken?: string;
  cleanerLinkExpired?: boolean;
  timerStartedAt?: string;
  timerStoppedAt?: string;
  timerDurationSec?: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Property = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any;

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}
function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ------------------------------------------------------------------ */
export default function TurnoverDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.role === "admin";

  const propertyId = String(params?.id || "");
  const departureDate = search?.get("departure") || "";

  const [property, setProperty] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [record, setRecord] = useState<TurnoverRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cleanerName, setCleanerName] = useState("");
  const [copied, setCopied] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [pRes, rRes, tRes] = await Promise.all([
        fetch("/api/properties").then((r) => r.json()),
        fetch("/api/reservations").then((r) => r.json()),
        fetch(`/api/turnovers?propertyId=${encodeURIComponent(propertyId)}&departureDate=${encodeURIComponent(departureDate)}`).then((r) => r.json()),
      ]);
      const propList: Property[] = pRes?.data || [];
      const found = propList.find((p: Property) => p.id === propertyId);
      setProperty(found || null);
      setReservations(rRes?.data || []);
      setRecord(tRes?.data || null);
      if (tRes?.data?.cleanerName) setCleanerName(tRes.data.cleanerName);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [propertyId, departureDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const checklist = useMemo<ChecklistCategory[]>(() => {
    if (!property) return [];
    return buildChecklist({ bedrooms: property.bedrooms, bathrooms: property.bathrooms });
  }, [property]);

  const totalItems = useMemo(() => countChecklistItems(checklist), [checklist]);
  const completedItems = useMemo(() => {
    if (!record) return 0;
    let count = 0;
    for (const cat of checklist) {
      for (const sub of cat.subcategories) {
        for (const it of sub.items) {
          if ((record.items[itemKey(cat.id, sub.id, it.id)] || []).length > 0) count++;
        }
      }
    }
    return count;
  }, [record, checklist]);
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const nextInfo = useMemo(() => {
    if (!property || !departureDate) return { nextArrival: "", guests: 0 };
    const propName = (property.name || "").trim().toLowerCase();
    const arrRes = reservations
      .filter((r: Reservation) => (r.property || "").trim().toLowerCase() === propName)
      .filter((r: Reservation) => (r.checkin || "") >= departureDate && r.status !== "Cancelled")
      .sort((a: Reservation, b: Reservation) => (a.checkin || "").localeCompare(b.checkin || ""))[0];
    if (!arrRes) return { nextArrival: "", guests: 0 };
    return { nextArrival: arrRes.checkin, guests: (arrRes.adults || 0) + (arrRes.children || 0) || 2 };
  }, [property, reservations, departureDate]);

  const toggleCollapse = (catId: string) => setCollapsed((prev) => ({ ...prev, [catId]: !prev[catId] }));

  const assignCleaner = async () => {
    if (!cleanerName.trim()) { alert("Enter a cleaner name first."); return; }
    const location = [property?.city, property?.country].filter(Boolean).join(", ") || property?.address || "";
    const res = await fetch("/api/turnovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        propertyName: property?.name,
        propertyBedrooms: property?.bedrooms,
        propertyBathrooms: property?.bathrooms,
        propertyLocation: location,
        propertyCoverUrl: property?.coverUrl,
        departureDate,
        cleanerName: cleanerName.trim(),
      }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const stopTimer = async () => {
    const res = await fetch("/api/turnovers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, departureDate, stopTimer: true }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const resolveIssue = async (issueId: string) => {
    const res = await fetch("/api/turnovers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, departureDate, resolveIssue: issueId }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const approve = async () => {
    if (!confirm("Approve this turnover? This will mark it as completed and expire the cleaner's link.")) return;
    const res = await fetch("/api/turnovers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, departureDate, approve: true }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const cleanerUrl = record?.cleanerToken && typeof window !== "undefined"
    ? `${window.location.origin}/clean/${record.cleanerToken}?p=${encodeURIComponent(propertyId)}&d=${encodeURIComponent(departureDate)}`
    : "";

  const copyLink = async () => {
    if (!cleanerUrl) return;
    try { await navigator.clipboard.writeText(cleanerUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  if (!isAdmin) return <AppShell title="Turnover"><div className="flex items-center justify-center h-64 text-[#999] text-sm">You don&apos;t have permission to access this page.</div></AppShell>;
  if (loading) return <AppShell title="Turnover"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading turnover...</div></AppShell>;
  if (!property) return <AppShell title="Turnover"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Property not found.</div></AppShell>;

  const status = record?.status || "Pending";
  const statusCls = status === "Completed" ? "text-[#2F6B57]" : status === "Submitted" ? "text-[#3B5BA5]" : "text-[#8A6A2E]";
  const location = [property.city, property.country].filter(Boolean).join(", ") || property.address || "";
  const openIssues = (record?.issues || []).filter((i) => !i.resolved);

  return (
    <AppShell title="Turnover">
      <button onClick={() => router.push("/turnovers")} className="flex items-center gap-1 text-[13px] text-[#999] hover:text-[#555] mb-4 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Turnovers
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold text-[#111] mb-1">{property.name}</h1>
            {location && <div className="text-[13px] text-[#888] mb-2">{location}</div>}
            <div className="text-[12px] text-[#666] flex items-center gap-4 flex-wrap">
              <span>Checkout: <span className="font-semibold text-[#111]">{fmtDate(departureDate)}</span></span>
              {nextInfo.nextArrival && <span>Next arrival: <span className="font-semibold text-[#111]">{fmtDate(nextInfo.nextArrival)}</span></span>}
              {nextInfo.guests > 0 && <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {nextInfo.guests} guests
              </span>}
            </div>
          </div>
          <div className="flex items-center gap-3 min-w-[220px]">
            <div className="text-right">
              <div className={`text-[12px] font-semibold ${statusCls}`}>{status}</div>
              <div className="text-[11px] text-[#999]">{completedItems} / {totalItems} ({progressPct}%)</div>
            </div>
            <div className="w-[160px] h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#80020E] transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Assign cleaner + link */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[14px] font-bold text-[#111] mb-0.5">Cleaner assignment</div>
            <div className="text-[11px] text-[#999]">Generate a unique link for the assigned cleaner to upload photos.</div>
          </div>
          {record?.cleanerLinkExpired && <span className="text-[11px] font-semibold text-[#999] bg-[#f5f5f5] px-2 py-0.5 rounded-full">Link expired</span>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={cleanerName}
            onChange={(e) => setCleanerName(e.target.value)}
            placeholder="Cleaner name (e.g. Emma Roberts)"
            className="flex-1 min-w-[200px] h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors"
          />
          <button onClick={assignCleaner} className="h-[38px] px-4 rounded-lg bg-[#80020E] text-white text-[13px] font-semibold hover:bg-[#6b010c] transition-colors">
            {record?.cleanerToken ? "Regenerate link" : "Generate link"}
          </button>
        </div>

        {cleanerUrl && !record?.cleanerLinkExpired && (
          <div className="mt-3 flex items-center gap-2 bg-[#fafafa] border border-[#eaeaea] rounded-lg p-2.5">
            <code className="flex-1 text-[11px] text-[#555] truncate font-mono">{cleanerUrl}</code>
            <button onClick={copyLink} className="text-[11px] font-semibold text-[#80020E] hover:underline flex-shrink-0">
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        )}

        {(record?.timerStartedAt || record?.timerDurationSec) && (
          <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center gap-4 flex-wrap text-[12px]">
            <span className="text-[#666]">Timer:</span>
            {record.timerStartedAt && <span>Started <span className="font-medium text-[#111]">{fmtDateTime(record.timerStartedAt)}</span></span>}
            {record.timerStoppedAt && <span>Stopped <span className="font-medium text-[#111]">{fmtDateTime(record.timerStoppedAt)}</span></span>}
            {record.timerDurationSec !== undefined && <span>Duration: <span className="font-semibold text-[#111]">{fmtDuration(record.timerDurationSec)}</span></span>}
            {record.timerStartedAt && !record.timerStoppedAt && (
              <button onClick={stopTimer} className="ml-auto h-[28px] px-3 rounded border border-[#80020E] text-[#80020E] text-[11px] font-semibold hover:bg-[#80020E]/5 transition-colors">
                Stop timer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Issues alert */}
      {openIssues.length > 0 && (
        <div className="bg-[#FBF1E2] border border-[#E8DDC7] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span className="text-[13px] font-bold text-[#8A6A2E]">{openIssues.length} open issue{openIssues.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {openIssues.map((iss) => (
              <div key={iss.id} className="flex items-start gap-3 bg-white rounded-lg p-2.5 border border-[#E8DDC7]">
                {iss.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iss.photoUrl} alt="issue" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#555]">{iss.description}</div>
                  <div className="text-[10px] text-[#999] mt-0.5">{fmtDateTime(iss.createdAt)}</div>
                </div>
                <button onClick={() => resolveIssue(iss.id)} className="text-[11px] font-semibold text-[#2F6B57] hover:underline flex-shrink-0">Resolve</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {checklist.map((cat) => {
          const isCollapsed = collapsed[cat.id];
          let catTotal = 0, catDone = 0;
          for (const sub of cat.subcategories) {
            for (const it of sub.items) {
              catTotal++;
              if ((record?.items[itemKey(cat.id, sub.id, it.id)] || []).length > 0) catDone++;
            }
          }
          return (
            <div key={cat.id} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0] bg-[#fafafa]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] font-bold text-[#111]">{cat.label}</span>
                  <span className="text-[11px] text-[#999]">{catDone} / {catTotal}</span>
                </div>
                <button onClick={() => toggleCollapse(cat.id)} className="text-[11px] font-medium text-[#666] hover:text-[#111] px-2.5 py-1 rounded border border-[#e2e2e2] hover:border-[#bbb] transition-colors">
                  {isCollapsed ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed && (
                <div className="p-5 space-y-5">
                  {cat.subcategories.map((sub) => (
                    <div key={sub.id}>
                      <div className="text-[12px] font-semibold text-[#111] mb-2.5">{sub.label}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {sub.items.map((it) => {
                          const key = itemKey(cat.id, sub.id, it.id);
                          const photos = record?.items[key] || [];
                          const hasPhoto = photos.length > 0;
                          const firstPhoto = photos[0];
                          return (
                            <div key={it.id}>
                              <div className={`relative w-full aspect-[4/3] rounded-lg overflow-hidden border ${hasPhoto ? "border-[#2F6B57]/40" : "border-dashed border-[#d0d0d0] bg-[#fafafa]"}`}>
                                {hasPhoto ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={firstPhoto.url} alt={it.label} className="w-full h-full object-cover" />
                                    {photos.length > 1 && <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">+{photos.length - 1}</span>}
                                    <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2F6B57] flex items-center justify-center">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    </span>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-[#aaa] gap-1">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
                                    <span className="text-[10px]">No photo yet</span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#555]">
                                <span className={`inline-flex items-center justify-center w-3 h-3 border rounded flex-shrink-0 ${hasPhoto ? "bg-[#2F6B57] border-[#2F6B57]" : "border-[#ccc] bg-white"}`}>
                                  {hasPhoto && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                </span>
                                <span className="truncate">{it.label}</span>
                              </div>
                              {hasPhoto && firstPhoto.uploadedAt && (
                                <div className="text-[10px] text-[#999] mt-0.5 ml-4">{fmtDateTime(firstPhoto.uploadedAt)}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {status === "Submitted" && (
          <button onClick={approve} className="h-[38px] px-5 rounded-lg bg-[#2F6B57] text-white text-[13px] font-semibold hover:bg-[#225244] transition-colors">
            Approve & mark completed
          </button>
        )}
        {status !== "Submitted" && status !== "Completed" && (
          <div className="text-[12px] text-[#888]">
            {status === "In progress" ? "Cleaner is working on this turnover..." : "Awaiting cleaner submission"}
          </div>
        )}
        {status === "Completed" && <span className="text-[12px] font-semibold text-[#2F6B57]">✓ Completed {record?.completedAt ? fmtDateTime(record.completedAt) : ""}</span>}
      </div>
    </AppShell>
  );
}
