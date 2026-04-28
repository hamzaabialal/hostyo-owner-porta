"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

/**
 * Address & location picker.
 *
 * Flow:
 *   1. The user types in the address field. We hit Nominatim (free, no API
 *      key) with debounced autocomplete and render the suggestions on top of
 *      everything (z-[300]) so they're never hidden behind other widgets.
 *   2. Picking a suggestion fills in city/postcode/country and lat/lng AND
 *      reveals the inline interactive map preview below — a draggable pin
 *      already centred on the geocoded location, ready to be refined.
 *   3. If the user types an address that returns no Nominatim matches, an
 *      inline "We don't recognize that address — are you sure?" banner is
 *      shown with two actions: edit the address, or confirm it manually.
 *      The wizard uses the same `confirmedManual` flag (lifted out via
 *      `onConfirmedManualChange`) to gate Continue/Submit.
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

interface AddressLocationPickerProps {
  value: AddressValue;
  onChange: (v: Partial<AddressValue>) => void;
  /** Lifted state: the user dismissed the unrecognized-address warning. */
  confirmedManual: boolean;
  onConfirmedManualChange: (v: boolean) => void;
}

export default function AddressLocationPicker({ value, onChange, confirmedManual, onConfirmedManualChange }: AddressLocationPickerProps) {
  const [query, setQuery] = useState(value.address || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  // Tracks the last query we actually got a server response for. Used to
  // tell the difference between "still typing" and "search came back empty".
  const [lastSearched, setLastSearched] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true right before a programmatic setView/setLatLng so the dragend
  // / moveend handlers can ignore that synthetic event.
  const programmaticMoveRef = useRef(false);

  // The user explicitly chose to drop a pin manually (after a manual address
  // confirmation). Tracked separately from `confirmedManual` so we don't show
  // a misleading Cyprus-centre map until they ask for it.
  const [manualPinDropped, setManualPinDropped] = useState(false);

  const hasLocation = value.lat != null && value.lng != null;
  // The map renders only when there's a real geocoded location OR the user has
  // explicitly opted to drop a pin manually. Confirming an unrecognised
  // address alone is NOT enough — we'd otherwise show the user a default
  // Cyprus map when their property might be anywhere in the world.
  const showMap = hasLocation || manualPinDropped;

  // Keep the input mirror in sync if the parent updates value.address (e.g.
  // after a reverse-geocode following a pin drag).
  useEffect(() => { setQuery(value.address || ""); }, [value.address]);

  // Editing the address invalidates a previous "I confirmed manually" choice
  // and any manual-pin commitment — the user is starting over.
  useEffect(() => {
    if (confirmedManual) onConfirmedManualChange(false);
    if (manualPinDropped && !hasLocation) setManualPinDropped(false);
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

  // Show "we don't recognize" banner when:
  //   - a finished search response for the current query came back empty,
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
    onConfirmedManualChange(false);
  };

  // Initialise / refresh the inline map when it becomes visible.
  useEffect(() => {
    if (!showMap) return;
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

        const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
        marker.bindTooltip("Drag to refine location", { permanent: false, direction: "top" });

        marker.on("dragend", () => {
          if (programmaticMoveRef.current) {
            programmaticMoveRef.current = false;
            return;
          }
          const { lat, lng } = marker.getLatLng();
          // Live-update the coordinates so the wizard always has the latest pin.
          onChange({ lat, lng });

          // Debounce the reverse-geocode (Nominatim usage policy + UX).
          if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
          moveDebounceRef.current = setTimeout(async () => {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                { headers: { Accept: "application/json" } }
              );
              const data: NominatimResult = await res.json();
              if (data) {
                onChange(buildAddressFromNominatim({ ...data, lat: String(lat), lon: String(lng) }));
              }
            } catch { /* ignore */ }
          }, 600);
        });

        mapRef.current = map;
        markerRef.current = marker;
      }

      // The map div may have just been (re-)inserted into the DOM — Leaflet
      // needs a nudge to recompute tile sizes.
      setTimeout(() => mapRef.current?.invalidateSize(), 80);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Keep the marker in sync when the coordinates change for reasons other
  // than a user drag — e.g. the user picks a different suggestion from the
  // dropdown while the map is already open. The programmaticMoveRef flag
  // suppresses the synthetic dragend so we don't reverse-geocode the value
  // we just set.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (value.lat == null || value.lng == null) return;
    programmaticMoveRef.current = true;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], 17);
  }, [value.lat, value.lng]);

  // Re-centre the map and pin when the lat/lng change externally (e.g. after
  // the user picks a different suggestion from the dropdown).
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (value.lat == null || value.lng == null) return;
    programmaticMoveRef.current = true;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], 17);
  }, [value.lat, value.lng]);

  return (
    <>
      <div className="relative">
        <label className="block text-[13px] font-medium text-[#333] mb-1.5">Street address</label>
        {/* Pill-shaped search input with leading magnifying glass and a
            trailing × clear button when the field has content. */}
        <div className="relative">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); onChange({ address: e.target.value }); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Start typing to search address..."
            autoComplete="off"
            className={`w-full h-[44px] pl-11 pr-10 border rounded-full text-[14px] text-[#333] placeholder:text-[#bbb] outline-none transition-colors ${
              showUnrecognized ? "border-[#80020E] focus:border-[#80020E]" : "border-[#e2e2e2] focus:border-[#80020E]"
            }`}
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => {
                // mouseDown so the input doesn't lose focus and re-trigger blur logic
                // before our handler runs.
                e.preventDefault();
                setQuery("");
                onChange({ address: "" });
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              aria-label="Clear address"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#eee] flex items-center justify-center text-[#888] hover:bg-[#ddd] hover:text-[#555] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
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
        // Floating toast pinned to the top of the viewport so the warning
        // stays in view even when the suggestions list / Next button are
        // far away on a long form. z-[350] keeps it above the wizard's own
        // sticky/fixed elements but below modal overlays (z-[400]).
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[640px] z-[350]">
          <div className="flex items-start gap-3 px-4 py-3 bg-white border border-[#eaeaea] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
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
                  onClick={() => onConfirmedManualChange(true)}
                  className="h-[32px] px-3 rounded-lg border border-[#80020E] text-[12px] font-medium text-[#80020E] hover:bg-[#80020E]/5 transition-colors"
                >
                  Yes, my address is correct
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onConfirmedManualChange(true)}
              aria-label="Dismiss"
              className="text-[#999] hover:text-[#555] transition-colors flex-shrink-0 mt-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
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

      {/* Manual-confirmation case: no geocoded location AND user hasn't asked
          to drop a pin yet. Offer a clear CTA instead of dumping them onto a
          Cyprus-default map that has nothing to do with their property. */}
      {confirmedManual && !hasLocation && !manualPinDropped && (
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#333]">Location</label>
          <button
            type="button"
            onClick={() => setManualPinDropped(true)}
            className="w-full h-[64px] px-4 rounded-xl border border-dashed border-[#d0d0d0] flex items-center justify-center gap-2 text-[13px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] hover:bg-[#80020E]/[0.02] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Drop a pin on the map
          </button>
          <p className="text-[11px] text-[#888]">We couldn&apos;t find this address automatically. Click above to set the location yourself.</p>
        </div>
      )}

      {showMap && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[13px] font-medium text-[#333]">Location</label>
            {hasLocation && (
              <span className="text-[10px] text-[#888] font-mono">
                {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888]">
            {hasLocation
              ? "Drag the pin to refine the exact location. The address will update automatically."
              : "We couldn't pinpoint this address — drag the pin to your property's exact location."}
          </p>
          <div ref={mapDivRef} className="rounded-xl border border-[#e2e2e2] overflow-hidden" style={{ height: "260px" }} />
        </div>
      )}
    </>
  );
}
