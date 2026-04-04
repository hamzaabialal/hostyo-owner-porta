"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ChannelBadge from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";
import { getDocuments, addDocument, removeDocument, formatFileSize, type PropertyDocument } from "@/lib/documents";

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
  const [tab, setTab] = useState<"overview" | "reservations" | "earnings" | "expenses" | "documents">("overview");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(() => {
    if (id) setDocs(getDocuments(id));
  }, [id]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

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

  const propReservations = useMemo(() =>
    reservations.sort((a, b) => (b.checkin || "").localeCompare(a.checkin || "")),
  [reservations]);

  const totalEarnings = useMemo(() => reservations.reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);
  const pendingBalance = useMemo(() => reservations.filter((r) => r.payoutStatus === "Pending").reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);

  // In-house guest (checked in, not checked out)
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inHouseRes = useMemo(() => reservations.find((r: any) =>
    r.checkin <= today && r.checkout > today && r.status !== "Cancelled"
  ), [reservations, today]);

  // Next arrival
  const nextArrival = useMemo(() => reservations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.checkin > today && r.status !== "Cancelled")
    .sort((a, b) => a.checkin.localeCompare(b.checkin))[0] || null,
  [reservations, today]);

  if (loading) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading...</div></AppShell>;
  if (!property) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Property not found.</div></AppShell>;

  const location = [property.city, property.country].filter(Boolean).join(", ") || property.address || "";
  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "reservations" as const, label: "Reservations" },
    { key: "earnings" as const, label: "Earnings" },
    { key: "expenses" as const, label: "Expenses" },
    { key: "documents" as const, label: "Documents" },
  ];

  return (
    <AppShell title="Properties">
      {/* Back */}
      <button onClick={() => router.push("/properties")} className="flex items-center gap-1 text-[13px] text-[#999] hover:text-[#555] mb-4 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Properties
      </button>

      {/* Property header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#111] mb-1">{property.name}</h1>
        {location && <div className="text-[13px] text-[#888]">{location}</div>}
      </div>

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
          {/* In-house + Next arrival cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In-house */}
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2F6B57]" />
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">In House</span>
                </div>
                {inHouseRes && (
                  <div className="text-right">
                    <div className="text-[22px] font-bold text-[#111]">{daysBetween(today, inHouseRes.checkout)}</div>
                    <div className="text-[10px] text-[#999]">days left</div>
                  </div>
                )}
              </div>
              {inHouseRes ? (
                <div>
                  <div className="text-[15px] font-semibold text-[#111] mb-1">{inHouseRes.guest}</div>
                  <div className="text-[11px] text-[#888] mb-2">
                    {fmtDate(inHouseRes.checkin)} → {fmtDate(inHouseRes.checkout)} · {inHouseRes.nights} nights · {(inHouseRes.adults || 0) + (inHouseRes.children || 0) || inHouseRes.guests || 1} guests
                  </div>
                  {(() => {
                    const daysLeft = daysBetween(today, inHouseRes.checkout);
                    if (daysLeft <= 1) return <span className="text-[11px] font-medium text-[#FF5A5F]">Departing tomorrow</span>;
                    return null;
                  })()}
                </div>
              ) : (
                <div className="text-[13px] text-[#999]">No guest currently in house</div>
              )}
            </div>

            {/* Next arrival */}
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2F6B57]" />
                  <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">Next Arrival</span>
                </div>
                {nextArrival && (
                  <div className="text-right">
                    <div className="text-[22px] font-bold text-[#111]">{daysBetween(today, nextArrival.checkin)}</div>
                    <div className="text-[10px] text-[#999]">days away</div>
                  </div>
                )}
              </div>
              {nextArrival ? (
                <div>
                  <div className="text-[15px] font-semibold text-[#111] mb-1">{nextArrival.guest}</div>
                  <div className="text-[11px] text-[#888] mb-2">
                    {fmtDate(nextArrival.checkin)} → {fmtDate(nextArrival.checkout)} · {nextArrival.nights} nights
                  </div>
                  <div className="text-[11px] text-[#888]">
                    {(nextArrival.adults || 0) + (nextArrival.children || 0) || nextArrival.guests || 1} guests
                    {daysBetween(today, nextArrival.checkin) === 0 && <span className="ml-3 text-[#2F6B57] font-semibold">Today</span>}
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
            <StatBox label="Current Balance" value={fmtCurrencyShort(pendingBalance)} sub="Payout pending" />
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
        <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
          {propReservations.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#999]">No reservations for this property.</div>
          ) : (
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
                  const deductions = (r.platformFee || 0) + (r.managementFee || 0) + (r.cleaning || 0);
                  const expectedBy = r.checkout ? (() => { const d = new Date(r.checkout + "T00:00:00"); d.setDate(d.getDate() + 7); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); })() : "—";
                  return (
                  <tr key={i} className="border-b border-[#f0f0f0] hover:bg-[#f9f9f9]">
                    <td className="px-4 py-3"><span className={statusPillClass(r.payoutStatus || r.status)}>{r.payoutStatus || r.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111]">{r.guest}</div>
                      {r.ref && <div className="text-[11px] text-[#999] mt-0.5">{r.ref}</div>}
                    </td>
                    <td className="px-4 py-3"><ChannelBadge channel={r.channel} compact /></td>
                    <td className="px-4 py-3 tabular-nums text-[#111]">{fmtCurrency(r.grossAmount || r.gross || 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-[#666]">{fmtCurrency(deductions)}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-[#111]">{fmtCurrency(r.ownerPayout || 0)}</td>
                    <td className="px-4 py-3 text-[#666]">{expectedBy}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ Earnings Tab ═══ */}
      {tab === "earnings" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatBox label="Total Earnings" value={fmtCurrency(totalEarnings)} sub="All time" />
            <StatBox label="Paid Out" value={fmtCurrency(reservations.filter((r) => r.payoutStatus === "Paid").reduce((s, r) => s + (r.ownerPayout || 0), 0))} sub="Completed payouts" />
            <StatBox label="Pending Balance" value={fmtCurrency(pendingBalance)} sub="Awaiting payout" />
          </div>

          <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[13px] font-semibold text-[#111]">Payout History</h3>
            </div>
            {propReservations.filter((r) => r.ownerPayout > 0).length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#999]">No earnings yet for this property.</div>
            ) : (
              <div className="divide-y divide-[#f3f3f3]">
                {propReservations.filter((r) => r.ownerPayout > 0).slice(0, 15).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                    <div>
                      <span className="font-medium text-[#111]">{r.guest}</span>
                      <span className="text-[#999] ml-2 text-[12px]">{fmtDateFull(r.checkout)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={statusPillClass(r.payoutStatus)}>{r.payoutStatus}</span>
                      <span className="font-semibold text-[#111] tabular-nums w-[80px] text-right">{fmtCurrency(r.ownerPayout || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Expenses Tab ═══ */}
      {tab === "expenses" && (() => {
        const totalExp = expenses.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inReview = expenses.filter((e: any) => e.status === "In Review");
        const inReviewTotal = inReview.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paid = expenses.filter((e: any) => e.status === "Paid" || e.status === "Approved");
        const paidTotal = paid.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
        const netBalance = totalEarnings - totalExp;

        return (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Total Expenses" value={fmtCurrency(totalExp)} sub="This month" />
              <StatBox label="In Review" value={fmtCurrency(inReviewTotal)} sub={`${inReview.length} expenses`} />
              <StatBox label="Paid" value={fmtCurrency(paidTotal)} sub={`${paid.length} expenses`} />
              <StatBox label="Net Balance" value={fmtCurrency(netBalance)} sub="After expenses" />
            </div>

            {/* Expense table */}
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
                        {["Status", "Created", "Vendor", "Category", "Amount"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#999] border-b border-[#eaeaea]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {expenses.map((exp: any, i: number) => (
                        <tr key={i} className="border-b border-[#f3f3f3] hover:bg-[#f9f9f9] cursor-pointer" onClick={() => { window.location.href = `/finances/expenses?open=${exp.id}`; }}>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-[12px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${exp.status === "Paid" || exp.status === "Approved" ? "bg-[#2F6B57]" : exp.status === "In Review" ? "bg-[#d4a843]" : "bg-[#999]"}`} />
                              {exp.status || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#666]">{exp.date || "—"}</td>
                          <td className="px-4 py-3 text-[#111] font-medium">{exp.vendor || "—"}</td>
                          <td className="px-4 py-3 text-[#666]">{exp.category || "—"}</td>
                          <td className="px-4 py-3 font-semibold text-[#7A5252] tabular-nums">-{fmtCurrency(exp.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#fafafa]">
                        <td colSpan={3} />
                        <td className="px-4 py-3 text-[11px] font-semibold text-[#999] uppercase">Total this month</td>
                        <td className="px-4 py-3 font-bold text-[#7A5252] tabular-nums">-{fmtCurrency(totalExp)}</td>
                      </tr>
                      <tr className="bg-[#fafafa]">
                        <td colSpan={3} />
                        <td className="px-4 py-3 text-[11px] font-semibold text-[#999] uppercase">Net Balance</td>
                        <td className="px-4 py-3 font-bold text-[#111] tabular-nums">{fmtCurrency(netBalance)}</td>
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

        const allReportMonths = Array.from(new Set([...Object.keys(expMonthMap), ...Object.keys(resMonthMap)])).sort().reverse();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openExpenseReport = (monthKey: string, monthExpenses: any[]) => {
          const [y, m] = monthKey.split("-");
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
          const total = monthExpenses.reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
          const fmt = (n: number) => `€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cards = monthExpenses.map((exp: any) => {
            const proofHtml = (exp.proof && exp.proof.length > 0)
              ? exp.proof.map((url: string, i: number) => {
                  const isPdf = url.match(/\.pdf/i);
                  if (isPdf) {
                    const fname = url.split("/").pop() || `File ${i + 1}`;
                    return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:8px;background:#fafafa;display:flex;align-items:center;gap:8px">
                      <span style="font-size:10px;font-weight:700;color:#80020E;background:#F6EDED;padding:2px 6px;border-radius:4px">PDF</span>
                      <span style="font-size:10px;color:#555;word-break:break-all">${fname}</span>
                    </div>`;
                  }
                  return `<img src="${url}" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e5e5;margin-bottom:8px" />`;
                }).join("")
              : '<div style="color:#bbb;font-size:10px;font-style:italic">No receipt attached</div>';

            const statusDot = exp.status === "Approved" || exp.status === "Paid" ? "#2F6B57" : exp.status === "In Review" ? "#8A6A2E" : "#999";

            return `<div style="display:flex;gap:28px;padding:24px 0;border-bottom:1px solid #eee">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:2px">${exp.category || "Expense"} ${exp.description ? "— " + exp.description : ""}</div>
                <div style="font-size:11px;color:#999;margin-bottom:12px">${exp.date || ""}</div>
                <div style="font-size:26px;font-weight:700;color:#111;margin-bottom:3px">${fmt(exp.amount || 0)}</div>
                <div style="font-size:10px;color:#aaa;margin-bottom:14px">incl. VAT</div>
                <table style="width:100%;font-size:11px;border-collapse:collapse">
                  <tr><td style="color:#999;padding:3px 0;width:80px">CATEGORY</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.category || "—"}</td></tr>
                  <tr><td style="color:#999;padding:3px 0">VENDOR</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.vendor || "—"}</td></tr>
                  <tr><td style="color:#999;padding:3px 0">STATUS</td><td style="padding:3px 0"><span style="color:${statusDot};font-weight:600">● ${exp.status || "—"}</span></td></tr>
                  <tr><td style="color:#999;padding:3px 0">PROPERTY</td><td style="color:#111;font-weight:500;padding:3px 0">${exp.property || property.name || "—"}</td></tr>
                </table>
                ${exp.description ? `<div style="margin-top:10px;font-size:11px;color:#666;font-style:italic;line-height:1.5">${exp.description}</div>` : ""}
              </div>
              <div style="width:220px;flex-shrink:0">
                <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Receipt / Invoice</div>
                ${proofHtml}
              </div>
            </div>`;
          }).join("");

          const html = `<!DOCTYPE html><html><head><title>Expense Report — ${monthName}</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 48px;color:#111;max-width:900px;margin:0 auto}@media print{body{padding:20px 30px}img{max-height:160px!important}}</style>
          </head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #eee">
              <div style="font-size:13px;font-weight:700;color:#80020E;letter-spacing:0.5px">HOSTYO</div>
              <div style="text-align:right">
                <div style="font-size:20px;font-weight:700;color:#111">Expense Report</div>
                <div style="font-size:11px;color:#999;margin-top:3px">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
              </div>
            </div>
            <div style="display:flex;gap:24px;padding:14px 0;margin-bottom:10px;border-bottom:1px solid #eee">
              <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Property</div><div style="font-size:13px;font-weight:600">${property.name}</div></div>
              <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Period</div><div style="font-size:13px;font-weight:600">${monthName}</div></div>
              <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Total</div><div style="font-size:13px;font-weight:600">${fmt(total)}</div></div>
              <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Expenses</div><div style="font-size:13px;font-weight:600">${monthExpenses.length}</div></div>
            </div>
            <div style="display:flex;gap:20px;font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.5px;padding:8px 0;border-bottom:1px solid #eee">
              <div style="flex:1">Details</div><div style="width:220px;flex-shrink:0">Receipt / Invoice</div>
            </div>
            ${cards}
          </body></html>`;
          const w = window.open("", "_blank");
          if (w) { w.document.write(html); w.document.close(); w.print(); }
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
          const totalDeductions = totalPlatformFee + totalMgmtFee + totalCleaning + totalExpenses;
          const totalNights = monthRes.reduce((s: number, r: any) => s + (r.nights || 0), 0);

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

          const html = `<!DOCTYPE html><html><head><title>Owner Statement — ${monthName}</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 48px;color:#111;max-width:1000px;margin:0 auto}table{width:100%;border-collapse:collapse}@media print{body{padding:20px 24px}}</style>
          </head><body>
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #eee">
              <div style="font-size:14px;font-weight:700;color:#80020E;letter-spacing:0.5px">HOSTYO</div>
              <div style="text-align:right">
                <div style="font-size:22px;font-weight:700;color:#111">Owner Statement</div>
                <div style="font-size:11px;color:#999;margin-top:4px">${property.name} · ${monthName}</div>
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
                ${totalExpenses > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#555">Expenses</td><td style="padding:6px 0;font-size:13px;color:#7A5252;text-align:right">-${fmt(totalExpenses)}</td></tr>` : ""}
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

            <!-- Footer -->
            <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#bbb;text-align:center">
              Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · HOSTYO LTD
            </div>
          </body></html>`;
          const w = window.open("", "_blank");
          if (w) { w.document.write(html); w.document.close(); w.print(); }
        };

        const handleUpload = async (files: FileList | null) => {
          if (!files || !id) return;
          setUploading(true);
          for (const file of Array.from(files)) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/submit/upload", { method: "POST", body: formData });
              const text = await res.text();
              let data;
              try { data = JSON.parse(text); } catch { continue; }
              if (data.ok) {
                addDocument({
                  propertyId: id,
                  name: file.name,
                  url: data.url,
                  size: formatFileSize(file.size),
                  type: "document",
                  source: "Admin",
                });
              }
            } catch { /* skip */ }
          }
          setUploading(false);
          refreshDocs();
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
                        <button onClick={() => { removeDocument(doc.id); refreshDocs(); }} className="w-7 h-7 rounded-md border border-[#e2e2e2] flex items-center justify-center text-[#ccc] hover:text-[#7A5252] hover:border-[#7A5252] transition-colors" title="Delete">
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
    </AppShell>
  );
}
