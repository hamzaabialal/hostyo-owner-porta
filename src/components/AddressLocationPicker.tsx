"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

/**
 * Address & location picker.
 *
 * Flow:
 *   1. User types in the address field. We hit Nominatim (free, no API key)
 *      with debounced autocomplete and render the suggestions on top of
 *      everything (z-[300]) so they're never hidden behind other widgets.
 *   2. Picking a suggestion fills in city/postcode/country and lat/lng.
 *   3. The map is *not* rendered inline. Once we have a location, a "Refine
 *      pin on map" button appears; clicking it opens a modal with a
 *      center-pin map ("Is the pin in the right spot?"). Closing the modal
 *      commits whatever location is under the pin.
 *   4. If the user types an address that returns no Nominatim matches at all
 *      we show an inline "We don't recognize that address — are you sure?"
 *      banner with two actions: edit the address, or confirm it manually.
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
  // Tracks the last query we actually got a server response for. Used to
  // tell the difference between "still typing" and "search came back empty".
  const [lastSearched, setLastSearched] = useState("");
  // The user clicked "Yes, my address is correct" on the unrecognized banner.
  // Lets them keep an unverified address without nagging.
  const [confirmedManual, setConfirmedManual] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true right before a programmatic setView so the moveend handler
  // can ignore that synthetic move (otherwise we'd reverse-geocode and
  // overwrite an address the user just picked from the suggestions list).
  const programmaticMoveRef = useRef(false);

  // Keep input in sync if parent updates value.address externally (e.g. from
  // a reverse-geocode after the pin moves).
  useEffect(() => { setQuery(value.address || ""); }, [value.address]);

  // Editing the address invalidates a previous "I confirmed manually" choice.
  useEffect(() => {
    if (confirmedManual) setConfirmedManual(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Debounced autocomplete
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); setLastSearched(""); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
          { headers: { Accept: "application/json" } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLastSearched(q);
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const hasLocation = value.lat != null && value.lng != null;

  // Show "we don't recognize" banner when:
  //   - we have a finished search response for the current query,
  //   - that response was empty,
  //   - the user hasn't selected a suggestion (no lat/lng),
  //   - and they haven't already overridden the warning.
  const showUnrecognized =
    !showDropdown &&
    !searching &&
    !hasLocation &&
    !confirmedManual &&
    lastSearched.length >= 3 &&
    suggestions.length === 0 &&
    lastSearched === query.trim();

  const handleSelect = (r: NominatimResult) => {
    onChange(buildAddressFromNominatim(r));
    setShowDropdown(false);
    setSuggestions([]);
    setConfirmedManual(false);
  };

  // Initialise the map when the modal opens. We use a "center pin" pattern
  // (fixed crosshair pin in the viewport, drag the map underneath it) which
  // matches the mobile-style example in the design.
  useEffect(() => {
    if (!mapOpen) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapDivRef.current) return;

      const startLat = value.lat ?? 35.1856;
      const startLng = value.lng ?? 33.3823;
      const startZoom = value.lat != null ? 17 : 13;

      if (!mapRef.current) {
        const map = L.map(mapDivRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([startLat, startLng], startZoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        map.on("moveend", () => {
          if (programmaticMoveRef.current) {
            programmaticMoveRef.current = false;
            return;
          }
          const c = map.getCenter();
          // Live-update the coordinates so the wizard keeps the latest pin.
          onChange({ lat: c.lat, lng: c.lng });

          // Debounce the reverse-geocode (Nominatim usage policy + UX).
          if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
          moveDebounceRef.current = setTimeout(async () => {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.lat}&lon=${c.lng}&addressdetails=1`,
                { headers: { Accept: "application/json" } }
              );
              const data: NominatimResult = await res.json();
              if (data) {
                onChange(buildAddressFromNominatim({ ...data, lat: String(c.lat), lon: String(c.lng) }));
              }
            } catch { /* ignore */ }
          }, 600);
        });

        mapRef.current = map;
      } else {
        // Re-opening an already-built map. Suppress the synthetic moveend so
        // we don't reverse-geocode the freshly-picked address.
        programmaticMoveRef.current = true;
        mapRef.current.setView([startLat, startLng], startZoom);
      }

      // The map div was just inserted into the DOM — Leaflet needs a nudge
      // to recompute tile sizes.
      setTimeout(() => mapRef.current?.invalidateSize(), 80);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen]);

  const closeMap = () => {
    if (moveDebounceRef.current) {
      clearTimeout(moveDebounceRef.current);
      moveDebounceRef.current = null;
    }
    setMapOpen(false);
  };

  return (
    <>
      <div className="relative">
        <label className="block text-[13px] font-medium text-[#333] mb-1.5">Street address</label>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange({ address: e.target.value }); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Start typing to search address..."
          autoComplete="off"
          className={`w-full h-[44px] px-4 border rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none transition-colors ${
            showUnrecognized ? "border-[#80020E] focus:border-[#80020E]" : "border-[#e2e2e2] focus:border-[#80020E]"
          }`}
        />
        {showDropdown && (searching || suggestions.length > 0) && (
          <div className="absolute z-[300] top-[72px] left-0 right-0 bg-white border border-[#e2e2e2] rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
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

      {showUnrecognized && (
        <div className="flex items-start gap-3 px-4 py-3 bg-white border border-[#eaeaea] rounded-xl shadow-sm">
          <div className="w-7 h-7 rounded-full bg-[#80020E] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#111] leading-tight">We don&apos;t recognize that address</div>
            <p className="text-[12px] text-[#777] mt-0.5 mb-2.5">Are you sure that it&apos;s correct?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="h-[32px] px-3 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#333] hover:border-[#999] transition-colors"
              >
                No, edit the address
              </button>
              <button
                type="button"
                onClick={() => setConfirmedManual(true)}
                className="h-[32px] px-3 rounded-lg border border-[#80020E] text-[12px] font-medium text-[#80020E] hover:bg-[#80020E]/5 transition-colors"
              >
                Yes, my address is correct
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmedManual(true)}
            aria-label="Dismiss"
            className="text-[#999] hover:text-[#555] transition-colors flex-shrink-0 mt-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

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

      {(hasLocation || confirmedManual) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[13px] font-medium text-[#333]">Map pin</label>
            {hasLocation && (
              <span className="text-[10px] text-[#888] font-mono">
                {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl flex items-center justify-center gap-2 text-[13px] font-medium text-[#333] hover:border-[#80020E] hover:text-[#80020E] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {hasLocation ? "Refine pin on map" : "Drop pin on map"}
          </button>
        </div>
      )}

      {mapOpen && (
        <div
          className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4"
          onClick={closeMap}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-[420px] flex flex-col overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 h-[52px] border-b border-[#eaeaea] flex-shrink-0">
              <button type="button" onClick={closeMap} aria-label="Back"
                className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-[#111]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-[14px] font-semibold text-[#111]">Is the pin in the right spot?</span>
              <button type="button" onClick={closeMap} aria-label="Close"
                className="w-8 h-8 flex items-center justify-center text-[#999] hover:text-[#555]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="relative">
              <div ref={mapDivRef} style={{ height: "360px" }} />
              {/* Centre-pin overlay: the pin stays put while you drag the map. */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center -translate-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <div className="w-0.5 h-3 bg-[#111]" />
                </div>
              </div>
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/85 text-white text-[11px] rounded-full whitespace-nowrap">
                Drag the map to reposition the pin
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[#eaeaea] flex-shrink-0">
              <button
                type="button"
                onClick={closeMap}
                className="w-full h-[44px] rounded-xl bg-[#111] text-white text-[14px] font-semibold hover:bg-black transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
