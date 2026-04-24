"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

/**
 * Address & location picker with:
 *   - Autocomplete suggestions from OpenStreetMap Nominatim
 *   - Interactive Leaflet map with a draggable pin for fine-tuning
 *   - Reverse-geocoding on drag-end to update the address fields
 *
 * Everything is free (no API keys). Nominatim has a usage policy — we debounce
 * typing and set a User-Agent-friendly Referer by default via the browser.
 */

export interface AddressValue {
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (w.__leafletLoading) return w.__leafletLoading;

  w.__leafletLoading = new Promise<any>((resolve) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(w.L);
    document.head.appendChild(script);
  });
  return w.__leafletLoading;
}

function buildAddressFromNominatim(r: NominatimResult): AddressValue {
  const a = r.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  return {
    address: street || r.display_name.split(",")[0] || "",
    city: a.city || a.town || a.village || a.county || "",
    postcode: a.postcode || "",
    country: a.country || "",
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };
}

export default function AddressLocationPicker({ value, onChange }: {
  value: AddressValue;
  onChange: (v: Partial<AddressValue>) => void;
}) {
  const [query, setQuery] = useState(value.address || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  // Keep input in sync if parent updates value.address externally (e.g. from drag)
  useEffect(() => { setQuery(value.address || ""); }, [value.address]);

  // Debounced autocomplete
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    // Skip if the query matches the currently-selected address (avoid looping)
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
          { headers: { Accept: "application/json" } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapDivRef.current || mapRef.current) return;
      const startLat = value.lat ?? 35.1856;
      const startLng = value.lng ?? 33.3823;
      const map = L.map(mapDivRef.current, { zoomControl: true }).setView([startLat, startLng], value.lat ? 17 : 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      marker.bindTooltip("Drag to refine location", { permanent: false, direction: "top" });

      marker.on("dragend", async () => {
        const { lat, lng } = marker.getLatLng();
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          );
          const data: NominatimResult = await res.json();
          if (data) {
            const next = buildAddressFromNominatim({ ...data, lat: String(lat), lon: String(lng) });
            onChange(next);
          } else {
            onChange({ lat, lng });
          }
        } catch {
          onChange({ lat, lng });
        }
      });

      mapRef.current = map;
      markerRef.current = marker;
      mapReadyRef.current = true;
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the marker when value.lat/lng changes (from autocomplete)
  useEffect(() => {
    if (!mapReadyRef.current || value.lat == null || value.lng == null) return;
    const L = (window as any).L;
    if (!L || !markerRef.current || !mapRef.current) return;
    const latlng = L.latLng(value.lat, value.lng);
    markerRef.current.setLatLng(latlng);
    mapRef.current.setView(latlng, 17);
  }, [value.lat, value.lng]);

  const handleSelect = (r: NominatimResult) => {
    const next = buildAddressFromNominatim(r);
    onChange(next);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <>
      <div className="relative">
        <label className="block text-[13px] font-medium text-[#333] mb-1.5">Street address</label>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange({ address: e.target.value }); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Start typing to search address..."
          autoComplete="off"
          className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
        />
        {showDropdown && (searching || suggestions.length > 0) && (
          <div className="absolute z-20 top-[72px] left-0 right-0 bg-white border border-[#e2e2e2] rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
            {searching && suggestions.length === 0 && (
              <div className="px-4 py-3 text-[12px] text-[#888]">Searching...</div>
            )}
            {suggestions.map((s) => (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className="w-full text-left px-4 py-2.5 text-[13px] text-[#333] hover:bg-[#f5f5f5] border-b border-[#f0f0f0] last:border-b-0 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#80020E" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span className="flex-1">{s.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-[#333] mb-1.5">City</label>
          <input type="text" value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="City"
            className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors" />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#333] mb-1.5">Postcode</label>
          <input type="text" value={value.postcode} onChange={(e) => onChange({ postcode: e.target.value })} placeholder="Postcode"
            className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors" />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#333] mb-1.5">Country</label>
          <input type="text" value={value.country} onChange={(e) => onChange({ country: e.target.value })} placeholder="Country"
            className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[13px] font-medium text-[#333]">Map pin</label>
          {value.lat != null && value.lng != null && (
            <span className="text-[10px] text-[#888] font-mono">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#888]">Drag the pin to refine the exact location. The address will update automatically.</p>
        <div ref={mapDivRef} className="rounded-xl border border-[#e2e2e2] overflow-hidden" style={{ height: "260px" }} />
      </div>
    </>
  );
}
