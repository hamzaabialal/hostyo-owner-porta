"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ChannelBadge from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(n: number) {
  return "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusPillClass(s: string) {
  const map: Record<string, string> = {
    Draft: "pill pill-draft", "In Review": "pill pill-inreview", Onboarding: "pill pill-onboarding",
    Live: "pill pill-live", Suspended: "pill pill-suspended",
    Pending: "pill pill-pending", Completed: "pill pill-completed", Cancelled: "pill pill-cancelled",
    Paid: "pill pill-paid",
  };
  return map[s] || "pill";
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean }) {
  if (!value && value !== 0) return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0 gap-4">
      <span className="text-[12px] text-[#999] flex-shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-[#111] text-right break-all">{display}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { fetchData } = useData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [property, setProperty] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "reservations" | "finances" | "documents">("overview");

  useEffect(() => {
    Promise.all([
      fetchData("properties", "/api/properties"),
      fetchData("reservations", "/api/reservations"),
    ]).then(([propRes, resRes]: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (propRes as any)?.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allRes = (resRes as any)?.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = props.find((p: any) => p.id === id);
      setProperty(found || null);
      if (found) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setReservations(allRes.filter((r: any) => r.property?.trim() === found.name?.trim()));
      }
    }).catch(console.error).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const propReservations = useMemo(() =>
    reservations.sort((a, b) => (b.checkin || "").localeCompare(a.checkin || "")),
  [reservations]);

  const totalEarnings = useMemo(() => reservations.reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);
  const paidOut = useMemo(() => reservations.filter((r) => r.payoutStatus === "Paid").reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);
  const pendingBalance = useMemo(() => reservations.filter((r) => r.payoutStatus === "Pending").reduce((s, r) => s + (r.ownerPayout || 0), 0), [reservations]);

  if (loading) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading...</div></AppShell>;
  if (!property) return <AppShell title="Property"><div className="flex items-center justify-center h-64 text-[#999] text-sm">Property not found.</div></AppShell>;

  const location = [property.city, property.country].filter(Boolean).join(", ") || property.address || "";
  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "reservations" as const, label: "Reservations" },
    { key: "finances" as const, label: "Finances" },
    { key: "documents" as const, label: "Documents" },
  ];

  return (
    <AppShell title="Properties">
      {/* Back + header */}
      <button onClick={() => router.push("/properties")} className="flex items-center gap-1 text-[13px] text-[#999] hover:text-[#555] mb-4 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Properties
      </button>

      {/* Property header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#111] mb-1">{property.name}</h1>
        {location && <div className="text-[13px] text-[#888] mb-2">{location}</div>}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={statusPillClass(property.status)}>{property.status}</span>
          {property.propertyType && <span className="text-[12px] text-[#666] bg-[#f5f5f5] px-2 py-0.5 rounded">{property.propertyType}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#eaeaea] mb-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === t.key ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Photo + Details */}
          <div className="lg:col-span-2 space-y-5">
            {property.coverUrl && (
              <div className="h-[220px] md:h-[280px] rounded-xl overflow-hidden bg-[#f5f5f5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={property.coverUrl} alt={property.name} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Details</h3>
              <InfoRow label="Address" value={[property.address, property.city, property.country, property.postcode].filter(Boolean).join(", ")} />
              <InfoRow label="Property Type" value={property.propertyType} />
              <InfoRow label="Bedrooms" value={property.bedrooms} />
              <InfoRow label="Bathrooms" value={property.bathrooms} />
              <InfoRow label="Max Guests" value={property.maxGuests} />
              <InfoRow label="Bed Types" value={property.bedTypes} />
              <InfoRow label="Price" value={property.price ? `€${property.price}/night` : ""} />
              <InfoRow label="Cleaning Fee" value={property.cleaningFee ? `€${property.cleaningFee}` : ""} />
              <InfoRow label="Access Code" value={property.accessCode} />
              <InfoRow label="License" value={property.license} />
              <InfoRow label="Property ID" value={property.property} />
              <InfoRow label="Listing ID" value={property.listingId} />
            </div>

            {(property.condition || property.features || property.internalNotes) && (
              <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
                <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Notes</h3>
                <InfoRow label="Condition" value={property.condition} />
                <InfoRow label="Features" value={property.features} />
                <InfoRow label="Internal Notes" value={property.internalNotes} />
              </div>
            )}
          </div>

          {/* Right — Channels + Quick stats */}
          <div className="space-y-5">
            {property.connectedChannels?.length > 0 && (
              <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
                <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Connected Channels</h3>
                <div className="space-y-2">
                  {property.connectedChannels.map((ch: string) => (
                    <div key={ch}><ChannelBadge channel={ch} /></div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Quick Summary</h3>
              <InfoRow label="Total Reservations" value={reservations.length} />
              <InfoRow label="Total Earnings" value={fmtCurrency(totalEarnings)} />
              <InfoRow label="Paid Out" value={fmtCurrency(paidOut)} />
              <InfoRow label="Pending Balance" value={fmtCurrency(pendingBalance)} />
            </div>

            {property.checkInGuide && (
              <a href={property.checkInGuide} target="_blank" rel="noopener noreferrer"
                className="block bg-white border border-[#eaeaea] rounded-xl p-4 text-[13px] text-accent font-medium hover:bg-[#fafafa] transition-colors">
                View Check-In Guide →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Reservations Tab */}
      {tab === "reservations" && (
        <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
          {propReservations.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#999]">No reservations for this property.</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafafa]">
                  {["Guest", "Channel", "Check-in", "Check-out", "Nights", "Status", "Payout"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propReservations.map((r, i) => (
                  <tr key={i} className="border-b border-[#f0f0f0] hover:bg-[#f9f9f9]">
                    <td className="px-4 py-3 font-medium text-[#111]">{r.guest}</td>
                    <td className="px-4 py-3"><ChannelBadge channel={r.channel} compact /></td>
                    <td className="px-4 py-3 text-[#666]">{fmtDate(r.checkin)}</td>
                    <td className="px-4 py-3 text-[#666]">{fmtDate(r.checkout)}</td>
                    <td className="px-4 py-3 text-[#666]">{r.nights}</td>
                    <td className="px-4 py-3"><span className={statusPillClass(r.status)}>{r.status}</span></td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{fmtCurrency(r.ownerPayout || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Finances Tab */}
      {tab === "finances" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="text-[12px] font-medium text-[#888] uppercase tracking-wide mb-2">Total Earnings</div>
              <div className="text-[22px] font-semibold text-[#111]">{fmtCurrency(totalEarnings)}</div>
            </div>
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="text-[12px] font-medium text-[#888] uppercase tracking-wide mb-2">Paid Out</div>
              <div className="text-[22px] font-semibold text-[#111]">{fmtCurrency(paidOut)}</div>
            </div>
            <div className="bg-white border border-[#eaeaea] rounded-xl p-5">
              <div className="text-[12px] font-medium text-[#888] uppercase tracking-wide mb-2">Pending Balance</div>
              <div className="text-[22px] font-semibold text-accent">{fmtCurrency(pendingBalance)}</div>
            </div>
          </div>

          <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[13px] font-semibold text-[#111]">Recent Payouts</h3>
            </div>
            {propReservations.filter((r) => r.payoutStatus === "Paid").length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#999]">No payouts yet for this property.</div>
            ) : (
              <div className="divide-y divide-[#f3f3f3]">
                {propReservations.filter((r) => r.payoutStatus === "Paid").slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                    <div>
                      <span className="font-medium text-[#111]">{r.guest}</span>
                      <span className="text-[#999] ml-2">{fmtDate(r.checkout)}</span>
                    </div>
                    <span className="font-semibold text-[#111] tabular-nums">{fmtCurrency(r.ownerPayout || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === "documents" && (
        <div className="bg-white border border-[#eaeaea] rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="text-[15px] font-semibold text-[#111] mb-1">No documents yet</div>
          <div className="text-[13px] text-[#888]">Property documents, financial reports, and onboarding files will appear here.</div>
        </div>
      )}
    </AppShell>
  );
}
