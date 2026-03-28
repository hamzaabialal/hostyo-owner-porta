"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import AddPropertyWizardComponent from "@/components/AddPropertyWizard";
import FilterDropdown from "@/components/FilterDropdown";
import ChannelBadge from "@/components/ChannelBadge";
import { useData } from "@/lib/DataContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Property {
  id: string;
  name: string;
  coverUrl: string;
  status: string;
  address: string;
  postcode: string;
  location: string;
  city: string;
  country: string;
  client: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  iban: string;
  counterpartyId: string;
  license: string;
  price: number;
  cleaningFee: number;
  accessCode: string;
  connectedChannels: string[];
  checkInGuide: string;
  photos: string;
  property: string;
  ical: string;
  listingId: number;
  googleDrive: string;
  skipAutomation: boolean;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  bedTypes: string;
  internalNotes: string;
  features: string;
  condition: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    Draft: "pill pill-draft",
    "In Review": "pill pill-inreview",
    Onboarding: "pill pill-onboarding",
    Live: "pill pill-live",
    Suspended: "pill pill-suspended",
  };
  return map[status] || "pill";
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Property Detail Drawer                                             */
/* ------------------------------------------------------------------ */
function PropertyDrawer({ property: p, onClose }: { property: Property; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [onClose]);

  function InfoRow({ label, value }: { label: string; value: string | number | boolean }) {
    if (value === "" || value === 0 || value === false || value === null || value === undefined) return null;
    const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
    return (
      <div className="flex items-start justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0 gap-4">
        <span className="text-[12px] text-[#999] flex-shrink-0">{label}</span>
        <span className="text-[13px] font-medium text-[#111] text-right break-all">{display}</span>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full md:max-w-[500px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[101] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div>
            <div className="text-[15px] font-semibold text-[#111]">{p.name || "Untitled"}</div>
            <span className={statusPillClass(p.status)}>{p.status}</span>
          </div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Property Photo */}
          <div className="mb-6 w-full h-[180px] rounded-xl bg-[#f5f5f5] overflow-hidden flex items-center justify-center">
            {p.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
            ) : null}
            <svg className={p.coverUrl ? "hidden" : ""} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          {/* Location */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Location</div>
            <InfoRow label="Address" value={p.address} />
            <InfoRow label="Postcode" value={p.postcode} />
            <InfoRow label="City" value={p.city} />
            <InfoRow label="Country" value={p.country} />
            <InfoRow label="Location" value={p.location} />
          </div>

          {/* Owner / Client */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Owner / Client</div>
            <InfoRow label="Client" value={p.client} />
            <InfoRow label="First Name" value={p.firstName} />
            <InfoRow label="Last Name" value={p.lastName} />
            <InfoRow label="Email" value={p.email} />
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="IBAN" value={p.iban} />
            <InfoRow label="Counterparty ID" value={p.counterpartyId} />
          </div>

          {/* Property Details */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Property Details</div>
            <InfoRow label="Type" value={p.propertyType} />
            <InfoRow label="Bedrooms" value={p.bedrooms || ""} />
            <InfoRow label="Bathrooms" value={p.bathrooms || ""} />
            <InfoRow label="Max Guests" value={p.maxGuests || ""} />
            <InfoRow label="Bed Types" value={p.bedTypes} />
            <InfoRow label="Property ID" value={p.property} />
            <InfoRow label="Listing ID" value={p.listingId} />
            <InfoRow label="Price" value={p.price ? `€${p.price}` : ""} />
            <InfoRow label="Cleaning Fee" value={p.cleaningFee ? `€${p.cleaningFee}` : ""} />
            <InfoRow label="Access Code" value={p.accessCode} />
            <InfoRow label="License" value={p.license} />
            <InfoRow label="Skip Automation" value={p.skipAutomation} />
          </div>

          {/* Notes */}
          {(p.condition || p.features || p.internalNotes) && (
            <div className="mb-6">
              <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Notes</div>
              <InfoRow label="Condition" value={p.condition} />
              <InfoRow label="Features" value={p.features} />
              <InfoRow label="Internal Notes" value={p.internalNotes} />
            </div>
          )}

          {/* Channels */}
          {p.connectedChannels.length > 0 && (
            <div className="mb-6">
              <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Connected Channels</div>
              <div className="flex flex-wrap gap-2">
                {p.connectedChannels.map((ch) => (
                  <ChannelBadge key={ch} channel={ch} />
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div>
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Links</div>
            {p.checkInGuide && (
              <a href={p.checkInGuide} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline block mb-1">Check-In Guide</a>
            )}
            {p.ical && <InfoRow label="iCal" value={p.ical} />}
            {p.googleDrive && <InfoRow label="Google Drive" value={p.googleDrive} />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Property Wizard (uses imported component)                      */
/* ------------------------------------------------------------------ */
const AddPropertyWizard = AddPropertyWizardComponent;

/*  Grid Card                                                          */
/* ------------------------------------------------------------------ */
function PropertyCard({ property: p, onClick }: { property: Property; onClick: () => void }) {
  const displayLocation = [p.city, p.country].filter(Boolean).join(", ") || p.address || "No address";
  return (
    <button onClick={onClick} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden text-left transition-all hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] group">
      <div className="relative h-[170px] overflow-hidden bg-[#f5f5f5] flex items-center justify-center">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
        ) : null}
        <svg className={p.coverUrl ? "hidden" : ""} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <div className="absolute top-3 left-3"><span className={statusPillClass(p.status)}>{p.status}</span></div>
      </div>
      <div className="p-4">
        <div className="text-[15px] font-semibold text-[#111] mb-0.5 truncate">{p.name || "Untitled"}</div>
        <div className="text-[12px] text-[#888] mb-2 truncate">{displayLocation}</div>
        {/* Type + Capacity row */}
        <div className="flex items-center gap-2 text-[11px] text-[#999] mb-2.5">
          {p.propertyType && <span className="bg-[#f5f5f5] px-2 py-0.5 rounded font-medium text-[#666]">{p.propertyType}</span>}
          {p.bedrooms > 0 && <span>{p.bedrooms} bed{p.bedrooms !== 1 ? "s" : ""}</span>}
          {p.bathrooms > 0 && <><span className="text-[#ddd]">&middot;</span><span>{p.bathrooms} bath{p.bathrooms !== 1 ? "s" : ""}</span></>}
          {p.maxGuests > 0 && <><span className="text-[#ddd]">&middot;</span><span>{p.maxGuests} guest{p.maxGuests !== 1 ? "s" : ""}</span></>}
        </div>
        {/* Channels + price */}
        <div className="flex items-center gap-2 flex-wrap">
          {p.connectedChannels.slice(0, 3).map((ch) => (
            <ChannelBadge key={ch} channel={ch} compact />
          ))}
          {p.price > 0 && <span className="ml-auto text-[12px] font-semibold text-[#111]">€{p.price}/night</span>}
        </div>
        {/* Draft resume action */}
        {p.status === "Draft" && (
          <div className="mt-2.5 text-[11px] font-medium text-accent">Continue setup →</div>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  List Row                                                           */
/* ------------------------------------------------------------------ */
function PropertyRow({ property: p, onClick }: { property: Property; onClick: () => void }) {
  const displayLocation = [p.city, p.country].filter(Boolean).join(", ") || p.address || "—";
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 bg-white border border-[#eaeaea] rounded-xl p-3.5 text-left transition-all hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] group">
      <div className="w-[80px] h-[56px] rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
        ) : null}
        <svg className={p.coverUrl ? "hidden" : ""} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[#111] truncate">{p.name || "Untitled"}</div>
        <div className="text-[12px] text-[#888] mt-0.5 flex items-center gap-1.5">
          <span>{displayLocation}</span>
          {p.propertyType && <><span className="text-[#ddd]">&middot;</span><span>{p.propertyType}</span></>}
        </div>
      </div>
      <div className="hidden lg:flex items-center gap-3 text-[12px] text-[#777] flex-shrink-0">
        {p.bedrooms > 0 && <span>{p.bedrooms} bed{p.bedrooms !== 1 ? "s" : ""}</span>}
        {p.bathrooms > 0 && <span>{p.bathrooms} bath{p.bathrooms !== 1 ? "s" : ""}</span>}
        {p.maxGuests > 0 && <span>{p.maxGuests} guest{p.maxGuests !== 1 ? "s" : ""}</span>}
      </div>
      <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
        {p.connectedChannels.slice(0, 2).map((ch) => (<ChannelBadge key={ch} channel={ch} compact />))}
      </div>
      {p.price > 0 && <div className="hidden lg:block text-[13px] font-semibold text-[#111] flex-shrink-0 w-[90px] text-right">€{p.price}</div>}
      <div className="flex-shrink-0"><span className={statusPillClass(p.status)}>{p.status}</span></div>
      <div className="text-[#ccc] group-hover:text-[#999] transition-colors flex-shrink-0"><ChevronIcon /></div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */
function exportCSV(properties: Property[]) {
  const headers = ["Name", "Status", "Address", "City", "Country", "Postcode", "Client", "Email", "Phone", "Price", "Cleaning Fee", "Channels", "Access Code", "License"];
  const rows = properties.map((p) => [
    p.name, p.status, p.address, p.city, p.country, p.postcode, p.client, p.email, p.phone,
    p.price, p.cleaningFee, p.connectedChannels.join("; "), p.accessCode, p.license,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hostyo-properties-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
function PropertiesPageInner() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [topBarFilter, setTopBarFilter] = useState("All Properties");

  const searchParams = useSearchParams();

  // Listen for TopBar "Add property" button
  useEffect(() => {
    const handler = () => setWizardOpen(true);
    window.addEventListener("hostyo:open-add-property", handler);
    return () => window.removeEventListener("hostyo:open-add-property", handler);
  }, []);

  // Listen for TopBar property filter
  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent).detail as string;
      setTopBarFilter(name);
    };
    window.addEventListener("hostyo:filter-property", handler);
    return () => window.removeEventListener("hostyo:filter-property", handler);
  }, []);

  // Open wizard if ?add=1 in URL
  useEffect(() => {
    if (searchParams.get("add") === "1") setWizardOpen(true);
  }, [searchParams]);

  const { fetchData } = useData();

  const fetchProperties = useCallback(() => {
    setLoading(true);
    fetchData("properties", "/api/properties")
      .then((res: unknown) => {
        const d = res as { data?: Property[] };
        if (d.data) setProperties(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const statusOptions = useMemo(() =>
    Array.from(new Set(properties.map((p) => p.status))).filter(Boolean).sort().map((s) => ({ value: s, label: s })),
  [properties]);

  const cityOptions = useMemo(() =>
    Array.from(new Set(properties.map((p) => p.city))).filter(Boolean).sort().map((c) => ({ value: c, label: c })),
  [properties]);

  const typeOptions = useMemo(() =>
    Array.from(new Set(properties.map((p) => p.propertyType))).filter(Boolean).sort().map((t) => ({ value: t, label: t })),
  [properties]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return properties.filter((p) => {
      if (topBarFilter && topBarFilter !== "All Properties" && p.name !== topBarFilter) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterCity && p.city !== filterCity) return false;
      if (filterType && p.propertyType !== filterType) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, topBarFilter, filterStatus, filterCity, filterType, search]);

  if (loading) {
    return (
      <AppShell title="Properties">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading properties from Notion...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Properties">
      <div className="text-[13px] text-[#888] mb-6 -mt-1">View and manage your properties across the portfolio.</div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[160px] md:min-w-[200px] max-w-[320px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
        </div>
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} placeholder="All Statuses" options={statusOptions} />
        <FilterDropdown value={filterType} onChange={setFilterType} placeholder="All Types" options={typeOptions} />
        <FilterDropdown value={filterCity} onChange={setFilterCity} placeholder="All Cities" options={cityOptions} />
        <div className="flex-1 hidden md:block" />

        {/* Export - hidden on mobile */}
        <button onClick={() => exportCSV(filtered)} className="dropdown-trigger text-text-secondary hover:text-text-primary hidden md:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Export</span>
        </button>

        {/* View toggle - hidden on mobile */}
        <div className="hidden md:flex items-center border border-[#e2e2e2] rounded-lg overflow-hidden">
          <button onClick={() => setView("grid")} className={`p-2 transition-colors ${view === "grid" ? "bg-accent text-white" : "bg-white text-[#999] hover:text-[#555]"}`}><GridIcon /></button>
          <button onClick={() => setView("list")} className={`p-2 transition-colors ${view === "list" ? "bg-accent text-white" : "bg-white text-[#999] hover:text-[#555]"}`}><ListIcon /></button>
        </div>

        <button onClick={() => setWizardOpen(true)} className="flex items-center gap-1.5 px-3 md:px-3.5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="hidden sm:inline">Add property</span>
        </button>
      </div>

      {/* Content */}
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div className="text-[16px] font-semibold text-[#111] mb-2">No properties yet</div>
          <div className="text-[13px] text-[#888] max-w-[380px] mb-6 leading-relaxed">Add your first property to start onboarding it into Hostyo. You can save your progress as a draft and return at any time.</div>
          <button onClick={() => setWizardOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add property
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div className="text-[16px] font-semibold text-[#111] mb-2">No properties found</div>
          <div className="text-[13px] text-[#888] max-w-[340px] leading-relaxed">No properties match your current filters. Try adjusting or clearing them.</div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (<PropertyCard key={p.id} property={p} onClick={() => setSelectedProperty(p)} />))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (<PropertyRow key={p.id} property={p} onClick={() => setSelectedProperty(p)} />))}
        </div>
      )}

      {/* Detail drawer */}
      {selectedProperty && <PropertyDrawer property={selectedProperty} onClose={() => setSelectedProperty(null)} />}

      {/* Add wizard */}
      {wizardOpen && <AddPropertyWizard onClose={() => setWizardOpen(false)} onSaved={fetchProperties} />}
    </AppShell>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-[#999]">Loading...</div>}>
      <PropertiesPageInner />
    </Suspense>
  );
}
