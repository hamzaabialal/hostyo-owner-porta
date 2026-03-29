"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "@/lib/DataContext";

export default function TopBar({ title, showAddProperty = true, minimal = false }: { title: string; showAddProperty?: boolean; minimal?: boolean }) {
  const { fetchData } = useData();
  const [propOpen, setPropOpen] = useState(false);
  const [selectedProp, setSelectedProp] = useState("All Properties");
  const [propertyNames, setPropertyNames] = useState<string[]>([]);

  useEffect(() => {
    fetchData("properties", "/api/properties")
      .then((d: unknown) => {
        const res = d as { data?: { name: string }[] };
        const names = (res.data || [])
          .map((p) => p.name)
          .filter((n) => n)
          .sort((a, b) => a.localeCompare(b));
        setPropertyNames(names);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [propSearch, setPropSearch] = useState("");
  const allProperties = ["All Properties", ...propertyNames];
  const filteredProperties = propSearch.trim()
    ? allProperties.filter((p) => p.toLowerCase().includes(propSearch.toLowerCase()))
    : allProperties;
  const [accountOpen, setAccountOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPropOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Fetch reservations
      const resRes = await fetch("/api/reservations");
      const resData = await resRes.json();
      const reservations = resData.data || [];

      // Fetch properties
      const propRes = await fetch("/api/properties");
      const propData = await propRes.json();
      const props = propData.data || [];

      // Build CSV for reservations
      const resHeaders = ["Guest", "Property", "Channel", "Check-In", "Check-Out", "Status", "Revenue", "Platform Commission", "Payout Status"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resRows = reservations.map((r: any) => [
        r.guest, r.property, r.channel, r.checkin, r.checkout, r.status,
        r.grossAmount || r.revenue || 0, r.platformFee || r.platformCommission || 0, r.payoutStatus,
      ]);

      // Build CSV for properties
      const propHeaders = ["Name", "Status", "Address", "City", "Country", "Price", "Channels", "Email", "Phone"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const propRows = props.map((p: any) => [
        p.name, p.status, p.address, p.city, p.country, p.price,
        (p.connectedChannels || []).join("; "), p.email, p.phone,
      ]);

      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        "=== RESERVATIONS ===",
        resHeaders.join(","),
        ...resRows.map((r: unknown[]) => r.map(escape).join(",")),
        "",
        "=== PROPERTIES ===",
        propHeaders.join(","),
        ...propRows.map((r: unknown[]) => r.map(escape).join(",")),
      ];

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hostyo-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleAddProperty = () => {
    if (pathname === "/properties") {
      // Dispatch custom event so Properties page can open wizard
      window.dispatchEvent(new CustomEvent("hostyo:open-add-property"));
    } else {
      router.push("/properties?add=1");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-8 h-[60px] flex items-center justify-between">
      <h1 className="text-[16px] font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {!minimal && <>
        {/* Property filter */}
        <div ref={ref} className="relative">
          <button onClick={() => setPropOpen(!propOpen)} className="dropdown-trigger min-w-[170px]">
            <span className="truncate">{selectedProp}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#999] flex-shrink-0"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {propOpen && (
            <div className="dropdown-panel right-0 min-w-[260px] max-h-[360px] flex flex-col">
              <div className="px-2 pt-2 pb-1 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={propSearch}
                  onChange={(e) => setPropSearch(e.target.value)}
                  autoFocus
                  className="w-full h-[34px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
                />
              </div>
              <div className="overflow-y-auto max-h-[280px]">
                {filteredProperties.map((p) => (
                  <button key={p} onClick={() => { setSelectedProp(p); setPropOpen(false); setPropSearch(""); window.dispatchEvent(new CustomEvent("hostyo:filter-property", { detail: p })); }} className={`dropdown-item ${selectedProp === p ? "selected" : ""}`}>{p}</button>
                ))}
                {filteredProperties.length === 0 && (
                  <div className="px-4 py-3 text-[12px] text-[#999]">No properties found</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date range */}
        <span className="dropdown-trigger text-text-tertiary cursor-default">Mar 1 – Mar 31, 2026</span>

        {/* Export */}
        <button onClick={handleExport} disabled={exporting} className="dropdown-trigger text-text-secondary hover:text-text-primary disabled:opacity-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>{exporting ? "Exporting..." : "Export"}</span>
        </button>

        {/* Add Property */}
        {showAddProperty && (
          <button
            onClick={handleAddProperty}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add property
          </button>
        )}

        </>}
        {/* Bell */}
        <button className="relative p-2 text-text-secondary hover:text-text-primary transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </button>

        {/* Avatar / Account dropdown */}
        <div ref={accountRef} className="relative">
          <button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white text-[11px] font-bold">AP</div>
            <span className="text-[13px] font-medium text-text-primary hidden xl:block">Alexandra Pemberton</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#999] hidden xl:block"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {accountOpen && (
            <div className="dropdown-panel right-0 min-w-[260px] py-2">
              <div className="px-4 py-3 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">AP</div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#111] truncate">Alexandra Pemberton</div>
                    <div className="text-[12px] text-[#888] truncate">alexandra@pemberton.co.uk</div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-[#aaa]">Owner &middot; Pemberton Properties Ltd</div>
              </div>
              <div className="py-1">
                <Link href="/settings" onClick={() => setAccountOpen(false)} className="dropdown-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  Account Settings
                </Link>
              </div>
              <div className="border-t border-[#f0f0f0] pt-1">
                <Link href="/login?signed_out=1" onClick={() => setAccountOpen(false)} className="dropdown-item text-[#999] hover:text-[#80020E]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
