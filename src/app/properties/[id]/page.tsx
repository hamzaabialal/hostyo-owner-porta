"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import ChannelBadge from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";
import { fetchDocuments, addDocument, removeDocument, formatFileSize, type PropertyDocument } from "@/lib/documents";
import { reconcileProperty } from "@/lib/reconcile";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateFull(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(n: number) {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrencyShort(n: number) {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusPillClass(s: string) {
  const map: Record<string, string> = {
    Draft: "pill pill-draft", "In Review": "pill pill-inreview", Onboarding: "pill pill-onboarding",
    Live: "pill pill-live", Suspended: "pill pill-suspended",
    Pending: "pill pill-pending", Completed: "pill pill-completed", Cancelled: "pill pill-cancelled",
    "In-House": "pill pill-live", Paid: "pill pill-paid",
  };
  return map[s] || "pill";
}

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/*  Stat Box                                                           */
/* ------------------------------------------------------------------ */
function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
      <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-[22px] font-bold text-[#111]">{value}</div>
      {sub && <div className="text-[11px] text-[#aaa] mt-0.5">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Item (small label + value)                                  */
/* ------------------------------------------------------------------ */
function DetailCell({ label, value }: { label: string; value: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold text-[#bbb] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13px] font-semibold text-[#222]">{String(value) || "—"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Expense Modal                                                  */
/* ------------------------------------------------------------------ */
function AddExpenseModal({ propertyName, onClose, onSaved }: { propertyName: string; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: propertyName,
          category: category || undefined,
          status,
          amount: price || "0",
          vendor: vendor || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved();
      } else {
        setError(data.error || "Failed to save expense");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectCls = "w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors appearance-none cursor-pointer";
  const inputCls = "w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors placeholder:text-[#bbb]";
  const dropdownBg = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat" as const, backgroundPosition: "right 12px center" };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-0">
            <div>
              <h2 className="text-[16px] font-bold text-[#111]">Log an expense</h2>
              <p className="text-[12px] text-[#888] mt-0.5">{propertyName}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:text-[#555] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Category + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} style={dropdownBg}>
                  <option value="">Select</option>
                  {["Maintenance", "Plumbing", "Electrical", "Cleaning", "Laundry", "Supplies", "Repair", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} style={dropdownBg}>
                  {["Scheduled", "In Review", "Approved", "Paid"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price + Vendor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Price</label>
                <input type="number" inputMode="decimal" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Vendor</label>
                <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Nicosia Electric Co." className={inputCls} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief description of the work or purchase..."
                rows={3} className="w-full px-3 py-2.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors resize-none placeholder:text-[#bbb]" />
            </div>

            {error && <div className="text-[12px] text-[#7A5252] font-medium">{error}</div>}

            <div className="text-[11px] text-[#999]">Tied to <span className="text-[#80020E] font-medium">property</span>, not a reservation</div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#e2e2e2] text-[13px] font-medium text-[#555] hover:bg-[#f5f5f5] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg border border-[#111] bg-[#111] text-white text-[13px] font-medium hover:bg-[#222] transition-colors disabled:opacity-60">
              {saving ? "Saving..." : "Save expense"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { fetchData, invalidate } = useData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [property, setProperty] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reservations, setReservations] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "reservations" | "earnings" | "expenses" | "documents" | "turnovers">("overview");
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.role === "admin";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turnovers, setTurnovers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [issuesForProperty, setIssuesForProperty] = useState<any[]>([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [ownerProfile, setOwnerProfile] = useState({ fullName: "", legalName: "", billingAddress: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(() => {
    if (id) {
      // Fetch from server API (shared across users), with property name for scope check
      const propName = property?.name || "";
      fetchDocuments(id, propName).then(setDocs).catch(() => {});
    }
  }, [id, property?.name]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  // Fetch owner profile for billing info on reports
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.profile) {
          setOwnerProfile({
            fullName: data.profile.fullName || "",
            legalName: data.profile.legalName || "",
            billingAddress: data.profile.billingAddress || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetchData("properties", "/api/properties"),
      fetchData("reservations", "/api/reservations"),
      fetchData("expenses", "/api/expenses"),
    ]).then(([propRes, resRes, expRes]: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (propRes as any)?.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allRes = (resRes as any)?.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allExp = (expRes as any)?.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = props.find((p: any) => p.id === id);
      setProperty(found || null);
      if (found) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const propName = found.name?.trim().toLowerCase() || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setReservations(allRes.filter((r: any) => {
          const rp = (r.property || "").trim().toLowerCase();
          return rp === propName || rp.startsWith(propName) || propName.startsWith(rp);
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExpenses(allExp.filter((e: any) => {
          const ep = (e.property || "").trim().toLowerCase();
          return ep === propName || ep.startsWith(propName) || propName.startsWith(ep);
        }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Admin-only: fetch turnovers + issues for this property
  useEffect(() => {
    if (!isAdmin || !id) return;
    Promise.all([
      fetch("/api/turnovers").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/turnovers?issues=1").then((r) => r.json()).catch(() => ({ data: [] })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]).then(([tData, iData]: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTurnovers((tData?.data || []).filter((t: any) => t.propertyId === id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setIssuesForProperty((iData?.data || []).filter((i: any) => i.propertyId === id));
    }).catch(() => {});
  }, [id, isAdmin]);

  const propReservations = useMemo(() =>
    reservations.sort((a, b) => (b.checkin || "").localeCompare(a.checkin || "")),
  [reservations]);

  const totalEarnings = useMemo(() => reservations.reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);
  // Owner balance = Σ(Owner Payout where Completed + Pending)
  // No expense subtraction — expenses are handled at payout time via the carry-forward walker.
  // This balance is a pure reflection of what Notion says the owner is owed.
  const pendingBalance = useMemo(
    () => reservations
      .filter((r) => {
        if (r.status !== "Completed") return false;
        const ps = (r.payoutStatus || "").toLowerCase();
        return ps === "pending" || ps === "on hold";
      })
      .reduce((s, r) => s + (r.ownerPayout || 0), 0),
    [reservations]
  );

  // Carry-forward deficit reconciliation for THIS property.
  // Walks reservations in checkout order, applying expenses + carry-forward.
  const reconciledRows = useMemo(() => {
    if (!property) return [];
    return reconcileProperty(property.name || "", reservations, expenses);
  }, [property, reservations, expenses]);

  // currentDeficit removed — no longer displayed in stat cards

  // totalReleasedToOwner removed — balance is now computed from pendingBalance

  // In-house guest (checked in, not checked out — includes checkout day)
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inHouseRes = useMemo(() => reservations.find((r: any) =>
    r.checkin <= today && r.checkout >= today && r.status !== "Cancelled"
  ), [reservations, today]);
  const inHouseDaysLeft = inHouseRes ? daysBetween(today, inHouseRes.checkout) : -1;

  // Next arrival (first reservation with checkin >= today that isn't the in-house one)
  const nextArrival = useMemo(() => reservations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.checkin >= today && r.status !== "Cancelled" && (!inHouseRes || r.ref !== inHouseRes.ref))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))[0] || null,
  [reservations, today, inHouseRes]);
  const arrivalDaysAway = nextArrival ? daysBetween(today, nextArrival.checkin) : -1;

  if (loading) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading...</div></AppShell>;
  if (!property) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Property not found.</div></AppShell>;

  const location = [property.city, property.country].filter(Boolean).join(", ") || property.address || "";
  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "reservations" as const, label: "Reservations" },
    { key: "earnings" as const, label: "Earnings" },
    { key: "expenses" as const, label: "Expenses" },
    { key: "documents" as const, label: "Documents" },
    ...(isAdmin && property?.cleaning ? [{ key: "turnovers" as const, label: "Turnovers" }] : []),
  ];

  return (
    <AppShell title="Properties">
      {/* Back */}
      <button onClick={() => router.push("/properties")} className="flex items-center gap-1 text-[13px] text-[#999] hover:text-[#555] mb-4 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Properties
      </button>

      {/* Property header */}
      <div className="mb-4">
        <h1 className="text-[20px] font-bold text-[#111] mb-1">{property.name}</h1>
        {location && <div className="text-[13px] text-[#888]">{location}</div>}
      </div>

      {/* Deficit warning removed — balance is shown inline on the stat card */}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#eaeaea] mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Overview Tab ═══ */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* In-house / Check-out + Next arrival / Check-in cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In-house card — label changes dynamically */}
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inHouseDaysLeft === 0 ? "bg-[#FF5A5F]" : "bg-[#2F6B57]"}`} />
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">
                    {inHouseDaysLeft === 0 ? "Check Out" : "In House"}
                  </span>
                </div>
                {inHouseRes && (
                  <div className="text-right">
                    <div className={`text-[22px] font-bold ${inHouseDaysLeft === 0 ? "text-[#FF5A5F]" : "text-[#111]"}`}>{inHouseDaysLeft}</div>
                    <div className="text-[10px] text-[#999]">{inHouseDaysLeft === 0 ? "today" : "days left"}</div>
                  </div>
                )}
              </div>
              {inHouseRes ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ChannelBadge channel={inHouseRes.channel || "Direct"} compact />
                    <span className="text-[15px] font-semibold text-[#111]">{inHouseRes.guest}</span>
                  </div>
                  <div className="text-[11px] text-[#888]">
                    {fmtDate(inHouseRes.checkin)} → {fmtDate(inHouseRes.checkout)} · {inHouseRes.nights} nights · {(inHouseRes.adults || 0) + (inHouseRes.children || 0) || inHouseRes.guests || 1} guests
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-[#999]">No guest currently in house</div>
              )}
            </div>

            {/* Next arrival card — label changes on day of check-in */}
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${arrivalDaysAway === 0 ? "bg-[#2F6B57]" : "bg-[#D4A843]"}`} />
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">
                    {arrivalDaysAway === 0 ? "Check In" : "Next Arrival"}
                  </span>
                </div>
                {nextArrival && (
                  <div className="text-right">
                    <div className={`text-[22px] font-bold ${arrivalDaysAway === 0 ? "text-[#2F6B57]" : "text-[#111]"}`}>{arrivalDaysAway}</div>
                    <div className="text-[10px] text-[#999]">{arrivalDaysAway === 0 ? "today" : "days away"}</div>
                  </div>
                )}
              </div>
              {nextArrival ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ChannelBadge channel={nextArrival.channel || "Direct"} compact />
                    <span className="text-[15px] font-semibold text-[#111]">{nextArrival.guest}</span>
                  </div>
                  <div className="text-[11px] text-[#888]">
                    {fmtDate(nextArrival.checkin)} → {fmtDate(nextArrival.checkout)} · {nextArrival.nights} nights · {(nextArrival.adults || 0) + (nextArrival.children || 0) || nextArrival.guests || 1} guests
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-[#999]">No upcoming arrivals</div>
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatBox label="Total Reservations" value={reservations.length} sub="All time" />
            <StatBox label="Total Earnings" value={fmtCurrencyShort(totalEarnings)} sub="All time" />
            <StatBox
              label="Current Balance"
              value={`${pendingBalance < 0 ? "−" : ""}€${Math.abs(pendingBalance).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={pendingBalance < 0 ? "On hold" : pendingBalance === 0 ? "No pending payouts" : "Payout pending"}
            />
          </div>

          {/* Property Details */}
          <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
            <h3 className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-4">Property Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              <DetailCell label="Bedrooms" value={property.bedrooms || "—"} />
              <DetailCell label="Bathrooms" value={property.bathrooms || "—"} />
              <DetailCell label="Max Guests" value={property.maxGuests || "—"} />
              <DetailCell label="Cleaning Fee" value={property.cleaningFee ? `€${property.cleaningFee}` : "—"} />
              <DetailCell label="Access Code" value={property.accessCode || "—"} />
              <DetailCell label="Listing ID" value={property.listingId || "—"} />
            </div>
          </div>

          {/* Connected Channels */}
          {property.connectedChannels?.length > 0 && (
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <h3 className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-3">Connected Channels</h3>
              <div className="flex items-center gap-3 flex-wrap">
                {property.connectedChannels.map((ch: string) => (
                  <ChannelBadge key={ch} channel={ch} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Reservations Tab ═══ */}
      {tab === "reservations" && (
        <>
          {propReservations.length === 0 ? (
            <div className="bg-white border border-[#eaeaea] rounded-xl p-8 text-center text-[13px] text-[#999]">No reservations for this property.</div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {propReservations.map((r, i) => {
                  const gross = r.grossAmount || r.gross || 0;
                  const payout = r.ownerPayout || 0;
                  const expectedBy = r.checkout ? (() => { const d = new Date(r.checkout + "T00:00:00"); d.setDate(d.getDate() + 3); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); })() : "";
                  const checkinFmt = r.checkin ? new Date(r.checkin + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
                  const checkoutFmt = r.checkout ? new Date(r.checkout + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
                  const nights = r.checkin && r.checkout ? Math.ceil((new Date(r.checkout + "T00:00:00").getTime() - new Date(r.checkin + "T00:00:00").getTime()) / 86400000) : 0;
                  return (
                    <div key={i} className="bg-white border border-[#eaeaea] rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className={statusPillClass(r.status)}>{r.status}</span>
                        {expectedBy && <span className="text-[10px] text-[#999]">Expected {expectedBy}</span>}
                      </div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <ChannelBadge channel={r.channel} compact />
                        <span className="text-[15px] font-semibold text-[#111]">{r.guest}</span>
                      </div>
                      {r.ref && <div className="text-[11px] text-[#999] mb-1">{r.ref}</div>}
                      <div className="text-[12px] text-[#666] mb-2">
                        {checkinFmt} → {checkoutFmt}{nights > 0 ? ` · ${nights} night${nights !== 1 ? "s" : ""}` : ""}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-[10px] text-[#999]">Gross </span>
                            <span className="text-[13px] font-medium text-[#111]">{fmtCurrency(gross)}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#999]">Payout </span>
                          <span className={`text-[14px] font-semibold ${payout < 0 ? "text-[#B7484F]" : "text-[#111]"}`}>
                            {payout < 0 ? `−${fmtCurrency(Math.abs(payout))}` : fmtCurrency(payout)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#fafafa]">
                      {["Status", "Guest / Ref", "Channel", "Gross", "Deductions", "Payout", "Expected by"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {propReservations.map((r, i) => {
                      const gross = r.grossAmount || r.gross || 0;
                      const payout = r.ownerPayout || 0;
                      const deductions = gross - payout;
                      const expectedBy = r.checkout ? (() => { const d = new Date(r.checkout + "T00:00:00"); d.setDate(d.getDate() + 3); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); })() : "—";
                      return (
                        <tr key={i} className="border-b border-[#f0f0f0] hover:bg-[#f9f9f9]">
                          <td className="px-4 py-3"><span className={statusPillClass(r.status)}>{r.status}</span></td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[#111]">{r.guest}</div>
                            {r.ref && <div className="text-[11px] text-[#999] mt-0.5">{r.ref}</div>}
                          </td>
                          <td className="px-4 py-3"><ChannelBadge channel={r.channel} compact /></td>
                          <td className="px-4 py-3 tabular-nums text-[#111]">{fmtCurrency(gross)}</td>
                          <td className="px-4 py-3 tabular-nums text-[#7A5252]">−{fmtCurrency(deductions)}</td>
                          <td className={`px-4 py-3 font-semibold tabular-nums ${payout < 0 ? "text-[#B7484F]" : "text-[#111]"}`}>
                            {payout < 0 ? `−${fmtCurrency(Math.abs(payout))}` : fmtCurrency(payout)}
                          </td>
                          <td className="px-4 py-3 text-[#666]">{expectedBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ Earnings Tab ═══ */}
      {tab === "earnings" && (() => {
        // Build a lookup from reconciled data so we can show adjusted amounts
        const reconMap = new Map<string, { paidToOwner: number; appliedToDeficit: number; deficitAfter: number; isOnHold: boolean; totalExpenses: number }>();
        for (const row of reconciledRows) {
          if (row.ref) reconMap.set(row.ref, row);
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        // All completed/paid reservations sorted by payout date (pending closest first)
        const completedRes = [...reservations]
          .filter((r: any) => r.status === "Completed" || r.payoutStatus === "Paid")
          .map((r: any) => {
            const recon = r.ref ? reconMap.get(r.ref) : undefined;
            const ownerPayout = r.ownerPayout || 0;
            const paidToOwner = recon ? recon.paidToOwner : (r.payoutStatus === "Paid" ? ownerPayout : 0);
            const isHeld = recon ? recon.isOnHold : (ownerPayout < 0 && (r.payoutStatus === "Pending" || r.payoutStatus === "On Hold"));
            // Fix issue 3: use reconciliation status, fallback to checking negative payout
            const effectiveStatus = r.payoutStatus === "Paid" ? "Paid" : isHeld ? "On Hold" : (ownerPayout < 0 ? "On Hold" : r.payoutStatus);
            const expectedBy = r.checkout ? (() => { const d = new Date(r.checkout + "T00:00:00"); d.setDate(d.getDate() + 3); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); })() : "";
            const deductions = (r.grossAmount || r.gross || 0) - ownerPayout;
            return { ...r, effectiveStatus, paidToOwner, deductions, expectedBy, appliedToDeficit: recon?.appliedToDeficit || 0, expApplied: recon?.totalExpenses || 0 };
          })
        /* eslint-enable @typescript-eslint/no-explicit-any */
          .sort((a, b) => {
            // Pending/On Hold first by closest checkout, then Paid by most recent
            const aP = a.effectiveStatus === "Pending" || a.effectiveStatus === "On Hold";
            const bP = b.effectiveStatus === "Pending" || b.effectiveStatus === "On Hold";
            if (aP && !bP) return -1;
            if (!aP && bP) return 1;
            if (aP && bP) return (a.checkout || "").localeCompare(b.checkout || "");
            return (b.checkout || "").localeCompare(a.checkout || "");
          });

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Total Earnings" value={fmtCurrency(totalEarnings)} sub="All time" />
              <StatBox
                label="Current Balance"
                value={`${pendingBalance < 0 ? "−" : ""}${fmtCurrency(Math.abs(pendingBalance))}`}
                sub={pendingBalance < 0 ? "On hold" : pendingBalance === 0 ? "No pending payouts" : "Awaiting payout"}
              />
            </div>

            {completedRes.length === 0 ? (
              <div className="bg-white border border-[#eaeaea] rounded-xl p-6 text-center text-[13px] text-[#999]">No earnings yet for this property.</div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {completedRes.map((r, i) => (
                    <div key={i} className="bg-white border border-[#eaeaea] rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className={statusPillClass(r.effectiveStatus)}>{r.effectiveStatus}</span>
                        {r.expectedBy && <span className="text-[10px] text-[#999]">{r.expectedBy}</span>}
                      </div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <ChannelBadge channel={r.channel} compact />
                        <span className="text-[15px] font-semibold text-[#111]">{r.guest}</span>
                      </div>
                      {r.ref && <div className="text-[11px] text-[#999] mb-1">{r.ref}</div>}
                      <div className="text-[12px] text-[#666] mb-2">{fmtDate(r.checkin)} → {fmtDate(r.checkout)}</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[#999]">Gross </span>
                          <span className="text-[13px] font-medium text-[#111]">{fmtCurrency(r.grossAmount || r.gross || 0)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#999]">Payout </span>
                          <span className={`text-[14px] font-semibold ${r.paidToOwner > 0 ? "text-[#2F6B57]" : r.ownerPayout < 0 ? "text-[#B7484F]" : "text-[#111]"}`}>
                            {r.paidToOwner > 0 ? fmtCurrency(r.paidToOwner) : fmtCurrency(r.ownerPayout || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="bg-[#fafafa]">
                          {["Status", "Guest", "Channel", "Checkout", "Gross", "Deductions", "Payout"].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#999] border-b border-[#eaeaea] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {completedRes.map((r, i) => (
                          <tr key={i} className="border-b border-[#f3f3f3] hover:bg-[#f9f9f9]">
                            <td className="px-4 py-3"><span className={statusPillClass(r.effectiveStatus)}>{r.effectiveStatus}</span></td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#111]">{r.guest}</div>
                              {r.ref && <div className="text-[11px] text-[#999] mt-0.5">{r.ref}</div>}
                            </td>
                            <td className="px-4 py-3"><ChannelBadge channel={r.channel} compact /></td>
                            <td className="px-4 py-3 text-[#666] text-[12px]">{fmtDateFull(r.checkout)}</td>
                            <td className="px-4 py-3 tabular-nums text-[#111]">{fmtCurrency(r.grossAmount || r.gross || 0)}</td>
                            <td className="px-4 py-3 tabular-nums text-[#7A5252]">−{fmtCurrency(r.deductions)}</td>
                            <td className="px-4 py-3 tabular-nums font-semibold">
                              {r.paidToOwner > 0 ? <span className="text-[#2F6B57]">{fmtCurrency(r.paidToOwner)}</span> :
                                r.ownerPayout < 0 ? <span className="text-[#B7484F]">−{fmtCurrency(Math.abs(r.ownerPayout))}</span> :
                                fmtCurrency(r.ownerPayout || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ═══ Expenses Tab ═══ */}
      {tab === "expenses" && (() => {
        return (
          <div className="space-y-5">
            {/* Expense table — no stat cards, just the list */}
            <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-[#fafafa] border-b border-[#f0f0f0]">
                <span className="text-[12px] font-semibold text-[#999] uppercase tracking-wide">Expenses ({expenses.length})</span>
                <button onClick={() => setAddExpenseOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-all">
                  Add Expense
                </button>
              </div>
              {expenses.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#999]">No expenses for this property yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-white">
                        {["Status", "Type", "Created", "Vendor", "Category", "Amount"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#999] border-b border-[#eaeaea]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* eslint-disable @typescript-eslint/no-explicit-any */}
                      {expenses.map((exp: any, i: number) => {
                        const isPropertyLevel = !(exp.reservation || "").trim();
                        return (
                        <tr key={i} className="border-b border-[#f3f3f3] hover:bg-[#f9f9f9] cursor-pointer" onClick={() => { window.location.href = `/finances/expenses?open=${exp.id}`; }}>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-[12px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${exp.status === "Paid" || exp.status === "Approved" ? "bg-[#2F6B57]" : exp.status === "In Review" ? "bg-[#d4a843]" : "bg-[#999]"}`} />
                              {exp.status || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isPropertyLevel ? (
                              <span className="text-[10px] font-semibold text-[#8A6A2E] bg-[#FBF1E2] px-1.5 py-0.5 rounded uppercase tracking-wider">Property</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-[#4A4360] bg-[#EEEAF5] px-1.5 py-0.5 rounded uppercase tracking-wider">Reservation</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#666]">{exp.date || "—"}</td>
                          <td className="px-4 py-3 text-[#111] font-medium">{exp.vendor || "—"}</td>
                          <td className="px-4 py-3 text-[#666]">{exp.category || "—"}</td>
                          <td className="px-4 py-3 font-semibold text-[#7A5252] tabular-nums">-{fmtCurrency(exp.amount || 0)}</td>
                        </tr>
                        );
                      })}
                      {/* eslint-enable @typescript-eslint/no-explicit-any */}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#fafafa]">
                        <td colSpan={3} />
                        <td className="px-4 py-3 text-[11px] font-semibold text-[#999] uppercase">Total this month</td>
                        <td className="px-4 py-3 font-bold text-[#7A5252] tabular-nums">-{fmtCurrency(expenses.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0))}</td>
                      </tr>
                      <tr className="bg-[#fafafa]">
                        <td colSpan={4} />
                        <td className="px-4 py-3 text-[11px] font-semibold text-[#999] uppercase">Owner Balance</td>
                        <td className={`px-4 py-3 font-bold tabular-nums ${pendingBalance < 0 ? "text-[#B7484F]" : "text-[#111]"}`}>
                          {pendingBalance < 0 ? `−${fmtCurrency(Math.abs(pendingBalance))}` : fmtCurrency(pendingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add Expense Modal */}
      {addExpenseOpen && <AddExpenseModal propertyName={property.name} onClose={() => setAddExpenseOpen(false)} onSaved={() => {
        setAddExpenseOpen(false);
        // Invalidate cache and refetch expenses
        invalidate("expenses");
        fetchData("expenses", "/api/expenses").then((res: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allExp = (res as any)?.data || [];
          const pn = (property.name || "").trim().toLowerCase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setExpenses(allExp.filter((e: any) => {
            const ep = (e.property || "").trim().toLowerCase();
            return ep === pn || ep.startsWith(pn) || pn.startsWith(ep);
          }));
        }).catch(() => {});
      }} />}

      {/* ═══ Documents Tab ═══ */}
      {tab === "documents" && (() => {
        // Group expenses by month for auto-generated expense reports
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expMonthMap: Record<string, any[]> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const exp of expenses as any[]) {
          const key = (exp.date || "").slice(0, 7);
          if (!key) continue;
          if (!expMonthMap[key]) expMonthMap[key] = [];
          expMonthMap[key].push(exp);
        }

        // Group reservations by month for earnings statements
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resMonthMap: Record<string, any[]> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of reservations as any[]) {
          const key = (r.checkout || r.checkin || "").slice(0, 7);
          if (!key || r.status === "Cancelled") continue;
          if (!resMonthMap[key]) resMonthMap[key] = [];
          resMonthMap[key].push(r);
        }

        // Only show reports for past months (not current or future)
        const currentMonth = new Date().toISOString().slice(0, 7);
        const allReportMonths = Array.from(new Set([...Object.keys(expMonthMap), ...Object.keys(resMonthMap)]))
          .filter((k) => k < currentMonth)
          .sort().reverse();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openExpenseReport = (monthKey: string, monthExpenses: any[]) => {
          const [y, m] = monthKey.split("-");
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
          const fmt = (n: number) => `€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          const renderMedia = (url: string, i: number, label: string): string => {
            const isPdf = /\.pdf/i.test(url);
            if (isPdf) {
              const fname = url.split("/").pop() || `${label} ${i + 1}`;
              return `<div style="display:flex;align-items:center;gap:8px;border:1px solid #e5e5e5;border-radius:8px;padding:14px;background:#fafafa;min-height:80px">
                <span style="font-size:10px;font-weight:700;color:#80020E;background:#F6EDED;padding:3px 7px;border-radius:4px">PDF</span>
                <span style="font-size:10px;color:#555;word-break:break-all">${fname}</span>
              </div>`;
            }
            return `<img src="${url}" style="width:100%;height:100%;max-height:240px;object-fit:cover;border-radius:8px;border:1px solid #e5e5e5;display:block" />`;
          };

          const renderMediaSection = (title: string, urls: string[], emptyText: string): string => {
            if (!urls || urls.length === 0) {
              return `<div style="font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">${title}</div>
                <div style="color:#bbb;font-size:10px;font-style:italic;margin-bottom:14px">${emptyText}</div>`;
            }
            const items = urls.map((u, i) => `<div style="height:240px">${renderMedia(u, i, title)}</div>`).join("");
            return `<div style="font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">${title}</div>
              <div style="display:grid;grid-template-columns:repeat(${Math.min(urls.length, 3)}, 1fr);gap:10px;margin-bottom:14px">${items}</div>`;
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cards = monthExpenses.map((exp: any) => {
            // Prefer the split arrays from the API; fall back to `proof` (legacy) as receipts.
            const receipts: string[] = (exp.receipts && exp.receipts.length > 0)
              ? exp.receipts
              : (exp.photos && exp.photos.length > 0 ? [] : (exp.proof || []));
            const photos: string[] = exp.photos || [];

            const statusDot = exp.status === "Approved" || exp.status === "Paid" ? "#2F6B57" : exp.status === "In Review" ? "#8A6A2E" : "#999";

            return `<div style="page-break-inside:avoid;page-break-after:always;padding:24px 0">
              <div style="font-size:15px;font-weight:700;color:#111;margin-bottom:2px">${exp.category || "Expense"} ${exp.description ? "— " + exp.description : ""}</div>
              <div style="font-size:11px;color:#999;margin-bottom:12px">${exp.date || ""}</div>
              <div style="font-size:26px;font-weight:700;color:#111;margin-bottom:2px">${fmt(exp.amount || 0)}</div>
              <div style="font-size:10px;color:#aaa;margin-bottom:14px">incl. VAT</div>
              <table style="width:auto;font-size:12px;border-collapse:collapse;margin-bottom:12px">
                <tr><td style="color:#999;padding:3px 16px 3px 0;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.3px">Category</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.category || "—"}</td></tr>
                <tr><td style="color:#999;padding:3px 16px 3px 0;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.3px">Vendor</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.vendor || "—"}</td></tr>
                <tr><td style="color:#999;padding:3px 16px 3px 0;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.3px">Status</td><td style="padding:3px 0"><span style="color:${statusDot};font-weight:600">● ${exp.status || "—"}</span></td></tr>
                <tr><td style="color:#999;padding:3px 16px 3px 0;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.3px">Property</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.property || property.name || "—"}</td></tr>
              </table>
              ${exp.description ? `<div style="font-size:12px;color:#666;font-style:italic;line-height:1.5;margin-bottom:14px">${exp.description}</div>` : ""}
              ${renderMediaSection("Receipt / Invoice", receipts, "No receipt attached")}
              ${renderMediaSection("Photo Evidence", photos, "No photo evidence attached")}
            </div>`;
          }).join("");

          const html = `<!DOCTYPE html><html><head><title>Expense Report — ${monthName}</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 48px;color:#111;max-width:900px;margin:0 auto}@media print{body{padding:20px 30px}@page{size:A4;margin:14mm}}</style>
          </head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #eee">
              <div>
                <img src="/property-icons/ios_1024.png" alt="HOSTYO" style="height:32px;margin-bottom:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
                <div style="display:none;font-size:13px;font-weight:700;color:#80020E;letter-spacing:0.5px">HOSTYO</div>
                <div style="font-size:10px;color:#555;line-height:1.6;margin-top:6px">
                  HOSTYO LTD<br>+35777788280<br>billing@hostyo.com<br>VAT No: 60253322Q<br>20 Dimotikis Agoras, Larnaca, Cyprus, 6021
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:20px;font-weight:700;color:#111">Expense Report</div>
                <div style="font-size:11px;color:#999;margin-top:3px">${property.name} · ${monthName} · ${monthExpenses.length} expenses</div>
              </div>
            </div>
            ${cards}
          </body></html>`;
          const w = window.open("", "_blank");
          if (w) {
            w.document.write(html); w.document.close();
            const imgs = w.document.querySelectorAll("img");
            if (imgs.length > 0) {
              let loaded = 0;
              const checkPrint = () => { loaded++; if (loaded >= imgs.length) setTimeout(() => w.print(), 300); };
              imgs.forEach((img: HTMLImageElement) => { if (img.complete) checkPrint(); else { img.onload = checkPrint; img.onerror = checkPrint; } });
              setTimeout(() => w.print(), 5000);
            } else { w.print(); }
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openEarningsStatement = (monthKey: string, monthRes: any[]) => {
          const [y, m] = monthKey.split("-");
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
          const fmt = (n: number) => `€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const fmtD = (d: string) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

          /* eslint-disable @typescript-eslint/no-explicit-any */
          const totalGross = monthRes.reduce((s: number, r: any) => s + (r.grossAmount || 0), 0);
          const totalPlatformFee = monthRes.reduce((s: number, r: any) => s + (r.platformFee || 0), 0);
          const totalMgmtFee = monthRes.reduce((s: number, r: any) => s + (r.managementFee || 0), 0);
          const totalCleaning = monthRes.reduce((s: number, r: any) => s + (r.cleaning || 0), 0);
          const totalExpenses = monthRes.reduce((s: number, r: any) => s + (r.expenses || 0), 0);
          const totalPayout = monthRes.reduce((s: number, r: any) => s + (r.ownerPayout || 0), 0);
          const totalNights = monthRes.reduce((s: number, r: any) => s + (r.nights || 0), 0);
          // Also include linked expenses from expenses DB for this month
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const monthLinkedExpenses = (expenses as any[]).filter((e: any) => (e.date || "").startsWith(monthKey));
          const monthLinkedExpensesTotal = monthLinkedExpenses.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
          const allExpensesTotal = Math.max(totalExpenses, monthLinkedExpensesTotal);
          const totalDeductions = totalPlatformFee + totalMgmtFee + totalCleaning + allExpensesTotal;

          const resRows = monthRes.map((r: any) => {
            const ded = (r.platformFee || 0) + (r.managementFee || 0) + (r.cleaning || 0);
            const statusColor = r.payoutStatus === "Paid" ? "#2F6B57" : r.payoutStatus === "Pending" ? "#8A6A2E" : "#999";
            return `<tr>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">
                <div style="font-weight:600;color:#111">${r.guest || "—"}</div>
                <div style="font-size:10px;color:#999;margin-top:2px">${r.ref || ""}</div>
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${r.channel || "—"}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${fmtD(r.checkin)} – ${fmtD(r.checkout)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${r.nights || 0}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">${fmt(r.grossAmount || 0)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#7A5252">-${fmt(ded)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:700">${fmt(r.ownerPayout || 0)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:11px"><span style="color:${statusColor};font-weight:600">● ${r.payoutStatus || "—"}</span></td>
            </tr>`;
          }).join("");

          const billingName = ownerProfile.legalName || ownerProfile.fullName || "";
          const billingAddr = ownerProfile.billingAddress || "";

          const html = `<!DOCTYPE html><html><head><title>Owner Statement — ${monthName}</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 48px;color:#111;max-width:1000px;margin:0 auto}table{width:100%;border-collapse:collapse}@media print{body{padding:20px 24px}}</style>
          </head><body>
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #eee">
              <div>
                <img src="/property-icons/ios_1024.png" alt="HOSTYO" style="height:32px;margin-bottom:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
                <div style="display:none;font-size:14px;font-weight:700;color:#80020E;letter-spacing:0.5px">HOSTYO</div>
                <div style="font-size:11px;color:#555;line-height:1.6;margin-top:6px">
                  HOSTYO LTD<br>
                  +35777788280<br>
                  billing@hostyo.com<br>
                  VAT No: 60253322Q<br>
                  20 Dimotikis Agoras, Larnaca, Cyprus, 6021
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:22px;font-weight:700;color:#111">Owner Statement</div>
                <div style="font-size:11px;color:#999;margin-top:4px">${property.name} · ${monthName}</div>
                ${billingName ? `<div style="margin-top:12px;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px">Billing To</div>
                <div style="font-size:12px;color:#333;margin-top:3px;line-height:1.5">${billingName}${billingAddr ? "<br>" + billingAddr : ""}</div>` : ""}
              </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:flex;gap:16px;margin-bottom:28px">
              <div style="flex:1;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px">
                <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Reservations</div>
                <div style="font-size:24px;font-weight:700">${monthRes.length}</div>
                <div style="font-size:10px;color:#999;margin-top:2px">${totalNights} nights</div>
              </div>
              <div style="flex:1;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px">
                <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Gross Revenue</div>
                <div style="font-size:24px;font-weight:700">${fmt(totalGross)}</div>
              </div>
              <div style="flex:1;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px">
                <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Deductions</div>
                <div style="font-size:24px;font-weight:700;color:#7A5252">-${fmt(totalDeductions)}</div>
              </div>
              <div style="flex:1;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px">
                <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Net Owner Payout</div>
                <div style="font-size:24px;font-weight:700;color:#2F6B57">${fmt(totalPayout)}</div>
              </div>
            </div>

            <!-- Breakdown -->
            <div style="margin-bottom:28px;padding:20px;background:#fafafa;border:1px solid #eee;border-radius:10px">
              <div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Monthly Breakdown</div>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:6px 0;font-size:13px;color:#555">Gross booking revenue</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right">${fmt(totalGross)}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#555">Platform commissions</td><td style="padding:6px 0;font-size:13px;color:#7A5252;text-align:right">-${fmt(totalPlatformFee)}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#555">Cleaning fees</td><td style="padding:6px 0;font-size:13px;color:#7A5252;text-align:right">-${fmt(totalCleaning)}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#555">Management fees</td><td style="padding:6px 0;font-size:13px;color:#7A5252;text-align:right">-${fmt(totalMgmtFee)}</td></tr>
                ${allExpensesTotal > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#555">Expenses</td><td style="padding:6px 0;font-size:13px;color:#7A5252;text-align:right">-${fmt(allExpensesTotal)}</td></tr>` : ""}
                <tr style="border-top:2px solid #ddd"><td style="padding:10px 0;font-size:14px;font-weight:700;color:#111">Net Owner Payout</td><td style="padding:10px 0;font-size:16px;font-weight:700;color:#2F6B57;text-align:right">${fmt(totalPayout)}</td></tr>
              </table>
            </div>

            <!-- Reservations Table -->
            <div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Reservation Details</div>
            <table>
              <thead>
                <tr>
                  ${["Guest / Ref", "Channel", "Stay Dates", "Nights", "Gross", "Deductions", "Payout", "Status"].map(h => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.3px">${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>${resRows}</tbody>
              <tfoot>
                <tr style="background:#fafafa">
                  <td colspan="4" style="padding:10px 12px;font-size:12px;font-weight:700">Total</td>
                  <td style="padding:10px 12px;font-size:12px;font-weight:700">${fmt(totalGross)}</td>
                  <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#7A5252">-${fmt(totalDeductions)}</td>
                  <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#2F6B57">${fmt(totalPayout)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            ${monthLinkedExpenses.length > 0 ? `
            <!-- Expenses Section -->
            <div style="margin-top:8px;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Expenses</div>
            <table>
              <thead>
                <tr>
                  ${["Date", "Category", "Vendor", "Description", "Amount", "Status"].map(h => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.3px">${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${monthLinkedExpenses.map((e: any) => {
                  const sc = e.status === "Paid" || e.status === "Approved" ? "#2F6B57" : e.status === "In Review" ? "#8A6A2E" : "#999";
                  return `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${e.date || "—"}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">${e.category || "—"}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">${e.vendor || "—"}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${e.description || "—"}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:600;color:#7A5252">-${fmt(e.amount || 0)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px"><span style="color:${sc};font-weight:600">● ${e.status || "—"}</span></td>
                  </tr>`;
                }).join("")}
              </tbody>
              <tfoot>
                <tr style="background:#fafafa">
                  <td colspan="4" style="padding:10px 12px;font-size:12px;font-weight:700">Total Expenses</td>
                  <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#7A5252">-${fmt(monthLinkedExpensesTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            ` : ""}

            <!-- Footer -->
            <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#bbb;text-align:center">
              Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · HOSTYO LTD
            </div>
          </body></html>`;
          const w = window.open("", "_blank");
          if (w) {
            w.document.write(html); w.document.close();
            const imgs = w.document.querySelectorAll("img");
            if (imgs.length > 0) {
              let loaded = 0;
              const checkPrint = () => { loaded++; if (loaded >= imgs.length) setTimeout(() => w.print(), 300); };
              imgs.forEach((img: HTMLImageElement) => { if (img.complete) checkPrint(); else { img.onload = checkPrint; img.onerror = checkPrint; } });
              setTimeout(() => w.print(), 5000);
            } else { w.print(); }
          }
        };

        const handleUpload = async (files: FileList | null) => {
          if (!files || !id) return;
          setUploading(true);
          setUploadError("");
          for (const file of Array.from(files)) {
            try {
              // 1. Upload the file to Vercel Blob
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await fetch("/api/tickets/upload", { method: "POST", body: formData });
              const uploadData = await uploadRes.json().catch(() => ({ ok: false, error: "Invalid response" }));
              if (!uploadData.ok) {
                setUploadError(uploadData.error || `Failed to upload ${file.name}`);
                continue;
              }

              // 2. Save metadata via /api/documents
              const saved = await addDocument({
                propertyId: id,
                propertyName: property?.name || "",
                name: file.name,
                url: uploadData.url,
                size: formatFileSize(file.size),
                type: "document",
                source: "Admin",
              });
              if (!saved) {
                setUploadError("File uploaded but metadata save failed. Check admin permissions.");
                continue;
              }
              // 3. Optimistically add the new doc to the local state so it shows
              //    immediately without waiting for the Blob list() to propagate
              setDocs((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Upload failed";
              setUploadError(msg);
            }
          }
          setUploading(false);
          // Delayed refresh from the server so we eventually sync with any concurrent changes
          setTimeout(() => refreshDocs(), 1500);
        };

        const propDocs = docs.filter((d) => d.type === "document");

        return (
          <div className="space-y-5">
            {/* Upload Zone */}
            <div className="bg-white border-2 border-dashed border-[#e2e2e2] rounded-xl p-8 text-center hover:border-[#80020E]/30 transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#80020E]", "bg-[#80020E]/[0.02]"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#80020E]", "bg-[#80020E]/[0.02]"); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-[#80020E]", "bg-[#80020E]/[0.02]"); handleUpload(e.dataTransfer.files); }}>
              <div className="w-12 h-12 rounded-xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-3">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                )}
              </div>
              <div className="text-[14px] font-medium text-[#111] mb-1">{uploading ? "Uploading..." : "Drop files here to upload"}</div>
              <div className="text-[12px] text-[#999]">or <button onClick={() => fileInputRef.current?.click()} className="text-[#80020E] font-medium hover:underline">browse files</button> from your device</div>
              <div className="text-[10px] text-[#bbb] mt-2">PDF · DOC · JPG · PNG · XLS · UP TO 25MB</div>
              {uploadError && (
                <div className="mt-3 text-[12px] text-[#B7484F] bg-[#F6EDED] border border-[#E8D8D8] rounded-lg px-3 py-2 inline-block">
                  {uploadError}
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            </div>

            {/* Reports + Property Documents side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Reports (auto-generated) */}
              <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[#fafafa] border-b border-[#f0f0f0]">
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Reports</span>
                  <span className="text-[11px] text-[#bbb]">{allReportMonths.length} files</span>
                </div>
                <div className="divide-y divide-[#f3f3f3] max-h-[400px] overflow-y-auto">
                  {allReportMonths.length === 0 ? (
                    <div className="p-6 text-center text-[12px] text-[#999]">No reports generated yet.</div>
                  ) : allReportMonths.map((key) => {
                    const [y, m] = key.split("-");
                    const monthLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
                    const hasExpenses = !!expMonthMap[key];
                    const hasEarnings = !!resMonthMap[key];
                    return (
                      <div key={key} className="px-5 py-3">
                        {hasEarnings && (
                          <div className="flex items-center justify-between py-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-[#111] truncate">Earnings — {monthLabel}</div>
                              <div className="text-[10px] text-[#999]">Generated · System</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => openEarningsStatement(key, resMonthMap[key])} className="w-7 h-7 rounded-md border border-[#e2e2e2] flex items-center justify-center text-[#888] hover:text-[#80020E] hover:border-[#80020E] transition-colors" title="Download">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </button>
                            </div>
                          </div>
                        )}
                        {hasExpenses && (
                          <div className="flex items-center justify-between py-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-[#111] truncate">Expense Report — {monthLabel}</div>
                              <div className="text-[10px] text-[#999]">Generated · System</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => openExpenseReport(key, expMonthMap[key])} className="w-7 h-7 rounded-md border border-[#e2e2e2] flex items-center justify-center text-[#888] hover:text-[#80020E] hover:border-[#80020E] transition-colors" title="Download">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Property Documents (uploaded) */}
              <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[#fafafa] border-b border-[#f0f0f0]">
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Property Documents</span>
                  <span className="text-[11px] text-[#bbb]">{propDocs.length} files</span>
                </div>
                <div className="divide-y divide-[#f3f3f3] max-h-[400px] overflow-y-auto">
                  {propDocs.length === 0 ? (
                    <div className="p-6 text-center text-[12px] text-[#999]">No documents uploaded yet.</div>
                  ) : propDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#111] truncate">{doc.name}</div>
                        <div className="text-[10px] text-[#999]">Uploaded {new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {doc.source}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[#bbb]">{doc.size}</span>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md border border-[#e2e2e2] flex items-center justify-center text-[#888] hover:text-[#80020E] hover:border-[#80020E] transition-colors" title="Download">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </a>
                        <button onClick={async () => {
                          // Optimistic remove — instant UI update
                          setDocs((prev) => prev.filter((d) => d.id !== doc.id));
                          await removeDocument(doc.id);
                          setTimeout(() => refreshDocs(), 1500);
                        }} className="w-7 h-7 rounded-md border border-[#e2e2e2] flex items-center justify-center text-[#ccc] hover:text-[#7A5252] hover:border-[#7A5252] transition-colors" title="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ Turnovers Tab (admin-only) ═══ */}
      {tab === "turnovers" && isAdmin && (() => {
        const today = new Date().toISOString().split("T")[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const propReservations = (reservations as any[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => r.status !== "Cancelled");

        // Build cleaning cards for this property across all past + upcoming checkouts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const checkoutDates = Array.from(new Set(propReservations.map((r: any) => r.checkout).filter(Boolean))) as string[];

        type Card = {
          departure: string;
          nextArrival: string;
          guests: number;
          status: "Pending" | "In progress" | "Submitted" | "Completed";
          completed: number;
          total: number;
        };
        const cards: Card[] = checkoutDates.map((departure) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nextArrivalRes = propReservations
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((r: any) => (r.checkin || "") >= departure)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => (a.checkin || "").localeCompare(b.checkin || ""))[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = (turnovers as any[]).find((t: any) => t.propertyId === id && t.departureDate === departure);
          const completed = existing ? Object.keys(existing.items || {}).length : 0;
          const status: Card["status"] = existing
            ? (existing.status === "Submitted" || existing.status === "Completed" ? existing.status
              : existing.status === "In progress" ? "In progress" : "Pending")
            : "Pending";
          return {
            departure,
            nextArrival: nextArrivalRes?.checkin || "",
            guests: nextArrivalRes ? ((nextArrivalRes.adults || 0) + (nextArrivalRes.children || 0) || 2) : 2,
            status,
            completed,
            total: Math.max(5, completed),
          };
        });

        // Sort: upcoming first (soonest), then past (most recent first)
        cards.sort((a, b) => {
          const aPast = a.departure < today;
          const bPast = b.departure < today;
          if (aPast !== bPast) return aPast ? 1 : -1;
          if (aPast && bPast) return b.departure.localeCompare(a.departure);
          return a.departure.localeCompare(b.departure);
        });

        const statusStyle = (s: Card["status"]) =>
          s === "Completed" ? { dot: "#2F6B57", text: "text-[#2F6B57]" } :
          s === "Submitted" ? { dot: "#3B5BA5", text: "text-[#3B5BA5]" } :
          { dot: "#D4A843", text: "text-[#8A6A2E]" };

        return (
          <div className="space-y-5">
            {/* Open issues summary */}
            {issuesForProperty.length > 0 && (
              <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[14px] font-bold text-[#111]">Recent issues</div>
                  <span className="text-[11px] text-[#999]">{issuesForProperty.filter((i) => !i.resolved).length} open</span>
                </div>
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {issuesForProperty.slice(0, 5).map((iss: any) => (
                    <div key={iss.id} className="flex items-start gap-2.5 py-1.5">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${iss.resolved ? "bg-[#2F6B57]" : iss.severity === "High" ? "bg-[#B7484F]" : "bg-[#D4A843]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#111] truncate">{iss.title || iss.description}</div>
                        <div className="text-[10px] text-[#999]">
                          {iss.category && <span className="mr-1.5">{iss.category}</span>}
                          {iss.resolved ? "Resolved" : iss.severity || "Pending"} · {fmtDateFull(iss.departureDate)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cleaning cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[14px] font-bold text-[#111]">Cleaning turnovers</div>
                <button onClick={() => router.push("/turnovers")}
                  className="text-[12px] font-medium text-[#80020E] hover:underline">View all →</button>
              </div>
              {cards.length === 0 ? (
                <div className="bg-white border border-[#eaeaea] rounded-xl p-10 text-center">
                  <div className="text-[13px] text-[#888]">No reservations yet — turnovers will appear here once guests book.</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cards.map((c) => {
                    const sc = statusStyle(c.status);
                    const pct = (c.completed / c.total) * 100;
                    return (
                      <div key={c.departure}
                        onClick={() => router.push(`/turnovers/${id}?departure=${encodeURIComponent(c.departure)}`)}
                        className="bg-white border border-[#eaeaea] rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] transition-all cursor-pointer">
                        <div className="flex items-start gap-3 md:flex-1 min-w-0">
                          <div className="w-[44px] h-[44px] md:w-[56px] md:h-[56px] rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8">
                              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] md:text-[14px] font-semibold text-[#111]">Checkout {fmtDateFull(c.departure)}</div>
                            <div className="text-[11px] text-[#999] mt-0.5 flex items-center gap-3 flex-wrap">
                              <span>Next arrival: {c.nextArrival ? fmtDateFull(c.nextArrival) : "—"}</span>
                              <span className="inline-flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                {c.guests} guests
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch md:items-end gap-1.5 md:min-w-[240px]">
                          <div className="flex items-center justify-between md:justify-end gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.dot }} />
                              <span className={`text-[12px] font-medium ${sc.text}`}>{c.status}</span>
                            </div>
                            <div className="text-[10px] md:text-[11px] text-[#999] whitespace-nowrap">{c.completed} / {c.total} completed</div>
                          </div>
                          <div className="w-full h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#80020E]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
