"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { buildChecklist, countChecklistItems, itemKey, type ChecklistCategory } from "@/lib/turnover-checklist";

/* ------------------------------------------------------------------ */
interface TurnoverPhoto { url: string; uploadedAt: string; exifDateTime?: string; deviceModel?: string; latitude?: number; longitude?: number; }
interface TurnoverIssue { id: string; description: string; photoUrl?: string; createdAt: string; resolved?: boolean; }
interface TurnoverRecord {
  id: string; propertyId: string; propertyName?: string; departureDate: string;
  status: "Pending" | "In progress" | "Submitted" | "Completed";
  items: Record<string, TurnoverPhoto[]>;
  issues: TurnoverIssue[];
  cleanerName?: string;
  cleanerToken?: string;
  cleanerLinkExpired?: boolean;
  timerStartedAt?: string;
  timerStoppedAt?: string;
  timerDurationSec?: number;
  notes?: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Property = any;

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
}
function fmtTime(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

/** Extract basic EXIF metadata from a JPEG if possible. */
async function extractExif(file: File): Promise<{ exifDateTime?: string; deviceModel?: string }> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) return {};
  try {
    const buffer = await file.arrayBuffer();
    const dv = new DataView(buffer);
    if (dv.getUint16(0, false) !== 0xFFD8) return {};
    let offset = 2;
    const length = buffer.byteLength;
    while (offset < length) {
      if (dv.getUint8(offset) !== 0xFF) return {};
      const marker = dv.getUint8(offset + 1);
      if (marker === 0xE1) {
        const exifStart = offset + 4;
        if (dv.getUint32(exifStart, false) !== 0x45786966) return {};
        const tiffOffset = exifStart + 6;
        const little = dv.getUint16(tiffOffset, false) === 0x4949;
        const ifd0Offset = tiffOffset + dv.getUint32(tiffOffset + 4, little);
        const entryCount = dv.getUint16(ifd0Offset, little);
        let deviceModel: string | undefined;
        let exifIfdPointer = 0;
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifd0Offset + 2 + i * 12;
          const tag = dv.getUint16(entryOffset, little);
          if (tag === 0x0110) { // Model
            const count = dv.getUint32(entryOffset + 4, little);
            const valOffset = count > 4 ? tiffOffset + dv.getUint32(entryOffset + 8, little) : entryOffset + 8;
            let s = "";
            for (let j = 0; j < count - 1; j++) s += String.fromCharCode(dv.getUint8(valOffset + j));
            deviceModel = s;
          }
          if (tag === 0x8769) {
            exifIfdPointer = tiffOffset + dv.getUint32(entryOffset + 8, little);
          }
        }
        let exifDateTime: string | undefined;
        if (exifIfdPointer) {
          const subCount = dv.getUint16(exifIfdPointer, little);
          for (let i = 0; i < subCount; i++) {
            const e = exifIfdPointer + 2 + i * 12;
            const tag = dv.getUint16(e, little);
            if (tag === 0x9003) { // DateTimeOriginal
              const count = dv.getUint32(e + 4, little);
              const valOffset = count > 4 ? tiffOffset + dv.getUint32(e + 8, little) : e + 8;
              let s = "";
              for (let j = 0; j < count - 1; j++) s += String.fromCharCode(dv.getUint8(valOffset + j));
              exifDateTime = s;
              break;
            }
          }
        }
        return { exifDateTime, deviceModel };
      } else {
        offset += 2 + dv.getUint16(offset + 2, false);
      }
    }
  } catch { /* ignore */ }
  return {};
}

async function getGeolocation(): Promise<{ latitude?: number; longitude?: number }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return {};
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({}), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timeout); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { clearTimeout(timeout); resolve({}); },
      { timeout: 4000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}

/* ------------------------------------------------------------------ */
export default function CleanerPage() {
  const params = useParams();
  const search = useSearchParams();
  const token = String(params?.token || "");
  const propertyId = search?.get("p") || "";
  const departureDate = search?.get("d") || "";

  const [record, setRecord] = useState<TurnoverRecord | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [now, setNowTick] = useState(Date.now());

  // Report issue modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueText, setIssueText] = useState("");
  const [issuePhoto, setIssuePhoto] = useState<{ url: string } | null>(null);
  const [issueSeverity, setIssueSeverity] = useState<"Low" | "Medium" | "High" | "">("");
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issuePhotoUploading, setIssuePhotoUploading] = useState(false);
  const issueFileRef = useRef<HTMLInputElement>(null);

  const resetIssueForm = () => {
    setIssueCategory("");
    setIssueTitle("");
    setIssueText("");
    setIssuePhoto(null);
    setIssueSeverity("");
  };

  const loadRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/turnovers/cleaner?token=${encodeURIComponent(token)}&propertyId=${encodeURIComponent(propertyId)}&departureDate=${encodeURIComponent(departureDate)}`);
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Link is no longer valid"); return; }
      setRecord(data.data);

      // Fetch property for bedroom/bathroom counts — via a public-safe approach:
      // the cleaner API returned minimal info; fall back to a default if unavailable.
      // Since /api/properties is protected, we'll store enough property info inside the turnover record in the future,
      // but for now we hardcode a minimal shape from what's in the record.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  }, [token, propertyId, departureDate]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  // Build property shape from the record (snapshot taken when cleaner was assigned)
  useEffect(() => {
    if (!record) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = record as any;
    setProperty({
      name: record.propertyName || "Property",
      bedrooms: r.propertyBedrooms || 1,
      bathrooms: r.propertyBathrooms || 1,
      location: r.propertyLocation || "",
      coverUrl: r.propertyCoverUrl || "",
    });
  }, [record]);

  // Tick timer every second
  useEffect(() => {
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const checklist = useMemo<ChecklistCategory[]>(() => {
    if (!property) return [];
    return buildChecklist({ bedrooms: property.bedrooms, bathrooms: property.bathrooms });
  }, [property]);

  const totalItems = useMemo(() => countChecklistItems(checklist), [checklist]);
  const completedItems = useMemo(() => {
    if (!record) return 0;
    let c = 0;
    for (const cat of checklist) for (const sub of cat.subcategories) for (const it of sub.items) {
      if ((record.items[itemKey(cat.id, sub.id, it.id)] || []).length > 0) c++;
    }
    return c;
  }, [record, checklist]);
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Timer display
  const timerSeconds = useMemo(() => {
    if (!record?.timerStartedAt) return 0;
    const end = record.timerStoppedAt ? new Date(record.timerStoppedAt).getTime() : now;
    return Math.floor((end - new Date(record.timerStartedAt).getTime()) / 1000);
  }, [record?.timerStartedAt, record?.timerStoppedAt, now]);
  const timerDisplay = useMemo(() => {
    const h = Math.floor(timerSeconds / 3600), m = Math.floor((timerSeconds % 3600) / 60), s = timerSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [timerSeconds]);

  const startTimer = async () => {
    const res = await fetch("/api/turnovers/cleaner/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, propertyId, departureDate, startTimer: true }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    fd.append("propertyId", propertyId);
    fd.append("departureDate", departureDate);
    const res = await fetch("/api/turnovers/cleaner/upload", { method: "POST", body: fd });
    const data = await res.json();
    return data.ok ? data.url : null;
  };

  const handleUploadItem = async (catId: string, subId: string, itId: string, file: File) => {
    const [exif, geo] = await Promise.all([extractExif(file), getGeolocation()]);
    const url = await uploadPhoto(file);
    if (!url) return;
    const res = await fetch("/api/turnovers/cleaner/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, propertyId, departureDate,
        addPhoto: {
          itemKey: itemKey(catId, subId, itId),
          url,
          exifDateTime: exif.exifDateTime,
          deviceModel: exif.deviceModel,
          latitude: geo.latitude,
          longitude: geo.longitude,
          name: file.name,
          size: file.size,
        },
      }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const handleRemove = async (catId: string, subId: string, itId: string, url: string) => {
    const res = await fetch("/api/turnovers/cleaner/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, propertyId, departureDate, removePhoto: { itemKey: itemKey(catId, subId, itId), url } }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const submitReview = async () => {
    if (!confirm("Submit this turnover for admin review? You won't be able to make changes after.")) return;
    const res = await fetch("/api/turnovers/cleaner/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, propertyId, departureDate, submit: true }),
    });
    const data = await res.json();
    if (data.ok) setRecord(data.data);
  };

  const reportIssue = async () => {
    if (!issueCategory || !issuePhoto || !issueText.trim()) return;
    setIssueSubmitting(true);
    try {
      const res = await fetch("/api/turnovers/cleaner/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, propertyId, departureDate,
          addIssue: {
            category: issueCategory,
            title: issueTitle || undefined,
            description: issueText.trim(),
            photoUrl: issuePhoto.url,
            severity: issueSeverity || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRecord(data.data);
        resetIssueForm();
        setIssueOpen(false);
      }
    } finally { setIssueSubmitting(false); }
  };

  const uploadIssuePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIssuePhotoUploading(true);
    try {
      const url = await uploadPhoto(f);
      if (url) setIssuePhoto({ url });
    } finally {
      setIssuePhotoUploading(false);
      e.target.value = "";
    }
  };

  /* ── Render ── */
  if (loading) {
    return <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center text-[#888] text-sm">Loading...</div>;
  }
  if (error || !record) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-[400px] w-full text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="w-14 h-14 rounded-full bg-[#F6EDED] flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B7484F" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="text-[16px] font-bold text-[#111] mb-1">Link unavailable</div>
          <div className="text-[13px] text-[#888]">{error || "This cleaning link is no longer valid. Please contact the admin for a new link."}</div>
        </div>
      </div>
    );
  }

  const isLocked = record.status === "Submitted" || record.status === "Completed" || record.cleanerLinkExpired;

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#eaeaea] px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[#111] truncate">{record.propertyName || "Turnover"}</div>
            <div className="text-[11px] text-[#888]">Checkout {fmtDate(record.departureDate)} · {record.cleanerName || "Cleaner"}</div>
          </div>
          <button
            onClick={() => setIssueOpen(true)}
            disabled={isLocked}
            className="flex items-center gap-1 h-[32px] px-2.5 rounded-lg border border-[#E8D8D8] text-[#B7484F] text-[11px] font-semibold bg-[#F6EDED] active:bg-[#EFD8D8] transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report issue
          </button>
        </div>

        {/* Timer */}
        {!record.timerStartedAt ? (
          <button
            onClick={startTimer}
            disabled={isLocked}
            className="w-full h-[42px] rounded-lg bg-[#80020E] text-white text-[13px] font-semibold active:bg-[#6b010c] transition-colors mb-2 disabled:opacity-50"
          >
            Start timer — I&apos;ve arrived
          </button>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[#888]">Timer:</span>
            <span className={`text-[14px] font-bold tabular-nums ${record.timerStoppedAt ? "text-[#888]" : "text-[#2F6B57]"}`}>{timerDisplay}</span>
            {!record.timerStoppedAt && <span className="w-2 h-2 rounded-full bg-[#2F6B57] animate-pulse" />}
            {record.timerStoppedAt && <span className="text-[10px] text-[#999] ml-auto">Ended by admin</span>}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#80020E] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-[#111] tabular-nums">{progressPct}%</span>
          <span className="text-[11px] text-[#999]">{completedItems}/{totalItems}</span>
        </div>
      </div>

      {/* Status banners */}
      {record.status === "Submitted" && (
        <div className="mx-4 mt-4 p-3 bg-[#EEF0F5] border border-[#d6dce5] rounded-xl text-[12px] text-[#3B5BA5]">
          <strong>Submitted for review.</strong> Waiting for admin approval. You&apos;ll be notified when it&apos;s completed.
        </div>
      )}
      {record.status === "Completed" && (
        <div className="mx-4 mt-4 p-3 bg-[#EAF3EF] border border-[#c3dcd0] rounded-xl text-[12px] text-[#2F6B57]">
          <strong>✓ Completed.</strong> Great work! This turnover has been approved.
        </div>
      )}

      {/* Category accordions */}
      <div className="px-4 pt-4 space-y-3">
        {checklist.map((cat) => {
          const isOpen = expanded[cat.id];
          let catTotal = 0, catDone = 0;
          for (const sub of cat.subcategories) for (const it of sub.items) {
            catTotal++;
            if ((record.items[itemKey(cat.id, sub.id, it.id)] || []).length > 0) catDone++;
          }
          const remaining = catTotal - catDone;
          return (
            <div key={cat.id} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-[#fafafa] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2"/></svg>
                  <span className="text-[14px] font-semibold text-[#111]">{cat.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] ${remaining === 0 ? "text-[#2F6B57] font-semibold" : "text-[#888]"}`}>
                    {remaining === 0 ? "Complete" : `${remaining} remaining`}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[#f0f0f0] p-4 space-y-5">
                  {cat.subcategories.map((sub) => {
                    let subTotal = 0, subDone = 0;
                    for (const it of sub.items) {
                      subTotal++;
                      if ((record.items[itemKey(cat.id, sub.id, it.id)] || []).length > 0) subDone++;
                    }
                    return (
                      <div key={sub.id}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-[#111]">{sub.label}</span>
                          <span className={`text-[10px] ${subDone === subTotal ? "text-[#2F6B57] font-semibold" : "text-[#888]"}`}>{subDone}/{subTotal}</span>
                        </div>
                        <div className="space-y-2">
                          {sub.items.map((it) => {
                            const key = itemKey(cat.id, sub.id, it.id);
                            const photos = record.items[key] || [];
                            const hasPhoto = photos.length > 0;
                            return (
                              <CleanerItemRow
                                key={it.id}
                                label={it.label}
                                photos={photos}
                                locked={isLocked}
                                onAdd={(file) => handleUploadItem(cat.id, sub.id, it.id, file)}
                                onRemove={(url) => handleRemove(cat.id, sub.id, it.id, url)}
                                fmtTime={fmtTime}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button (sticky bottom) */}
      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#eaeaea] px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
          <button
            onClick={submitReview}
            disabled={completedItems === 0}
            className="w-full h-[46px] rounded-xl text-white text-[14px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(180deg, #A41826 0%, #80020E 55%, #5A0108 100%)" }}
          >
            {completedItems < totalItems
              ? `Submit for review (${completedItems}/${totalItems} complete)`
              : "Submit for review"}
          </button>
          <div className="text-[10px] text-[#999] text-center mt-1">Your progress is saved automatically. You can come back anytime.</div>
        </div>
      )}

      {/* Report issue — full-screen on mobile */}
      {issueOpen && (() => {
        const canSubmit = !!issueCategory && !!issuePhoto && issueText.trim().length > 0 && !issueSubmitting;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = record as any;
        const nextArrivalForm = r?.propertyName ? r : null;
        // Build category options from the checklist (main category labels only)
        const categoryOptions = checklist.map((c) => c.label);
        return (
          <div className="fixed inset-0 z-[100] bg-[#f5f5f5] overflow-y-auto pb-28">
            {/* Header */}
            <div className="bg-white border-b border-[#eaeaea] px-4 py-3.5 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <button onClick={() => setIssueOpen(false)} className="flex items-center gap-1.5 text-[#80020E] text-[14px] font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Back to Turnover
                </button>
              </div>
            </div>

            {/* Title row */}
            <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-[20px] font-bold text-[#111]">Report Issue</div>
                <div className="text-[12px] text-[#888] mt-0.5">Let us know about any problems that need attention.</div>
              </div>
              <button
                onClick={() => setIssueOpen(false)}
                className="flex items-center gap-1 h-[30px] px-2.5 rounded-lg border border-[#E8D8D8] text-[#B7484F] text-[11px] font-semibold bg-white flex-shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Cancel
              </button>
            </div>

            {/* Property card */}
            {nextArrivalForm && (
              <div className="mx-4 bg-white rounded-xl border border-[#eaeaea] p-3 flex items-center gap-3">
                {r.propertyCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.propertyCoverUrl} alt="" className="w-[52px] h-[52px] rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-[52px] h-[52px] rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[#111] truncate">{record.propertyName}</div>
                  {r.propertyLocation && <div className="text-[11px] text-[#666] flex items-center gap-1 mt-0.5 truncate">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {r.propertyLocation}
                  </div>}
                  <div className="text-[11px] text-[#666] flex items-center gap-1 mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                    Checkout: {fmtDate(record.departureDate)}
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="mx-4 mt-4 space-y-4">
              {/* Category */}
              <div>
                <label className="text-[13px] font-semibold text-[#111] mb-1.5 block">
                  Category <span className="text-[#B7484F]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="w-full h-[46px] pl-3.5 pr-10 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors appearance-none"
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              {/* Issue title (optional) */}
              <div>
                <label className="text-[13px] font-semibold text-[#111] mb-1.5 block">
                  Issue title <span className="text-[#B7484F]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    className="w-full h-[46px] pl-3.5 pr-10 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors appearance-none"
                  >
                    <option value="">Select issue type (optional)</option>
                    <option value="Broken / damaged">Broken / damaged</option>
                    <option value="Missing item">Missing item</option>
                    <option value="Cleaning — beyond normal">Cleaning beyond normal</option>
                    <option value="Stain / mark">Stain / mark</option>
                    <option value="Appliance not working">Appliance not working</option>
                    <option value="Guest left behind">Guest left behind</option>
                    <option value="Maintenance needed">Maintenance needed</option>
                    <option value="Safety concern">Safety concern</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              {/* Photo */}
              <div>
                <label className="text-[13px] font-semibold text-[#111] mb-1 block">
                  Photo <span className="text-[#B7484F]">*</span>
                </label>
                <div className="text-[11px] text-[#888] mb-2">Add a clear photo to help us understand the issue</div>
                {issuePhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#eaeaea]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={issuePhoto.url} alt="issue" className="w-full max-h-[240px] object-cover" />
                    <button
                      onClick={() => setIssuePhoto(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => !issuePhotoUploading && issueFileRef.current?.click()}
                    disabled={issuePhotoUploading}
                    className="w-full py-7 border border-dashed border-[#E8D8D8] rounded-xl bg-[#F6EDED]/30 flex flex-col items-center gap-2 active:bg-[#F6EDED]/60 transition-colors disabled:opacity-60"
                  >
                    {issuePhotoUploading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] font-semibold text-[#80020E]">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#80020E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-[14px] font-semibold text-[#80020E]">Take photo</span>
                        <span className="text-[11px] text-[#888]">or choose from gallery</span>
                        <span className="text-[10px] text-[#bbb]">Photo will be time stamped automatically</span>
                      </>
                    )}
                  </button>
                )}
                <input ref={issueFileRef} type="file" accept="image/*" capture="environment" onChange={uploadIssuePhoto} className="hidden" />
              </div>

              {/* Description */}
              <div>
                <label className="text-[13px] font-semibold text-[#111] mb-1.5 block">
                  Description <span className="text-[#B7484F]">*</span>
                </label>
                <textarea
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value.slice(0, 500))}
                  placeholder="Describe the issue in detail. Include any relevant information that might help us resolve it quickly."
                  rows={5}
                  className="w-full p-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none"
                />
                <div className="text-right text-[11px] text-[#999] mt-1">{issueText.length} / 500</div>
              </div>

              {/* Severity */}
              <div>
                <label className="text-[13px] font-semibold text-[#111] mb-1.5 block">
                  Severity <span className="text-[#888] font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-3 border border-[#e2e2e2] rounded-lg overflow-hidden">
                  {(["Low", "Medium", "High"] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setIssueSeverity(issueSeverity === sev ? "" : sev)}
                      className={`h-[42px] text-[13px] font-medium transition-colors border-r border-[#e2e2e2] last:border-r-0 ${
                        issueSeverity === sev
                          ? sev === "Low" ? "bg-[#EAF3EF] text-[#2F6B57]"
                          : sev === "Medium" ? "bg-[#F6EDED] text-[#B7484F]"
                          : "bg-[#F6EDED] text-[#B7484F]"
                          : "bg-white text-[#555] active:bg-[#fafafa]"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-[#999] mt-1.5">High = urgent or affects guest stay</div>
              </div>
            </div>

            {/* Sticky submit footer */}
            <div className="fixed bottom-0 left-0 right-0 z-[101] bg-white border-t border-[#eaeaea] px-4 pt-3 pb-4">
              <button
                onClick={reportIssue}
                disabled={!canSubmit}
                className="w-full h-[48px] rounded-xl text-white text-[14px] font-semibold transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(180deg, #A41826 0%, #80020E 55%, #5A0108 100%)" }}
              >
                {issueSubmitting ? "Submitting..." : "Submit Issue"}
              </button>
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-[#999]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Your report is saved and linked to this turnover
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cleaner item row                                                   */
/* ------------------------------------------------------------------ */
function CleanerItemRow({ label, photos, locked, onAdd, onRemove, fmtTime }: {
  label: string;
  photos: { url: string; uploadedAt: string }[];
  locked: boolean;
  onAdd: (file: File) => Promise<void> | void;
  onRemove: (url: string) => Promise<void> | void;
  fmtTime: (iso: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasPhoto = photos.length > 0;

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        // Warn on very small images (<100KB) — likely low quality
        if (f.size < 100 * 1024) {
          const proceed = confirm(`${f.name} is quite small (${Math.round(f.size / 1024)}KB). Upload anyway?`);
          if (!proceed) continue;
        }
        await onAdd(f);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className={`rounded-lg border ${hasPhoto ? "border-[#2F6B57]/30 bg-[#F0F7F3]/30" : "border-[#eaeaea] bg-white"}`}>
      <div className="flex items-center gap-2 p-2.5">
        <span className={`inline-flex items-center justify-center w-4 h-4 border-2 rounded flex-shrink-0 ${hasPhoto ? "bg-[#2F6B57] border-[#2F6B57]" : "border-[#ccc] bg-white"}`}>
          {hasPhoto && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
        </span>
        <span className="flex-1 text-[13px] text-[#222]">{label}</span>
        {!locked && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`flex-shrink-0 h-[32px] px-3 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${hasPhoto ? "border border-[#e2e2e2] text-[#555] bg-white active:bg-[#f5f5f5]" : "bg-[#80020E] text-white active:bg-[#6b010c]"}`}
          >
            {uploading ? "..." : hasPhoto ? "Add more" : "Take photo"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} className="hidden" />
      </div>

      {hasPhoto && (
        <div className="px-2.5 pb-2.5 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={label} className="w-[80px] h-[60px] rounded object-cover" />
              {!locked && (
                <button onClick={() => onRemove(p.url)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#111]/80 text-white flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
              <div className="text-[9px] text-[#999] mt-0.5 text-center">{fmtTime(p.uploadedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
