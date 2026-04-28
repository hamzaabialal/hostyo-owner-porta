"use client";
import { useState, useRef } from "react";
import AddressLocationPicker from "./AddressLocationPicker";

interface WizardData {
  propertyType: string;
  bedrooms: number; bathrooms: number; maxGuests: number; bedTypes: string;
  photoUrls: string[]; description: string;
  name: string; address: string; city: string; postcode: string; country: string;
  lat?: number; lng?: number;
}

const INITIAL: WizardData = {
  propertyType: "", bedrooms: 1, bathrooms: 1, maxGuests: 2, bedTypes: "",
  photoUrls: [], description: "",
  name: "", address: "", city: "", postcode: "", country: "",
};

const PROPERTY_TYPES = [
  { value: "Apartment", label: "Apartment", desc: "Multi-unit or city-style residence", img: "/property-icons/apartment.png" },
  { value: "Villa", label: "Villa", desc: "Standalone holiday home or luxury residence", img: "/property-icons/villa.png" },
  { value: "Studio", label: "Studio", desc: "Open, compact living space", img: "/property-icons/studio.png" },
];

const STEPS = [
  { num: 1, label: "Property type" },
  { num: 2, label: "Beds & capacity" },
  { num: 3, label: "Photos & description" },
  { num: 4, label: "Address & location" },
];

function Stepper({ label, value, onChange, min, max, icon }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#f0f0f0] last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-[#bbb]">{icon}</span>
        <span className="text-[14px] font-medium text-[#333]">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="w-8 h-8 rounded-lg border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-30">
          <span className="text-[16px]">−</span>
        </button>
        <span className="text-[16px] font-semibold text-[#111] w-6 text-center tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-8 h-8 rounded-lg border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-30">
          <span className="text-[16px]">+</span>
        </button>
      </div>
    </div>
  );
}

export default function AddPropertyWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  // The address picker raises this when the user dismisses the
  // "we don't recognize that address" warning. Lifted up so the wizard can
  // gate Continue/Submit on it without re-implementing the validation.
  const [addressManuallyConfirmed, setAddressManuallyConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

  const isAddressVerified = () => {
    if (!data.address.trim()) return true; // empty address → not blocking here
    return data.lat != null || addressManuallyConfirmed;
  };

  const canNext = () => {
    if (step === 0) return !!data.propertyType;
    if (step === 1) return data.bedrooms > 0 && data.bathrooms > 0 && data.maxGuests > 0;
    if (step === 3) return isAddressVerified();
    return true;
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/submit/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (d.ok) urls.push(d.url);
      } catch { /* skip */ }
    }
    update({ photoUrls: [...data.photoUrls, ...urls] });
    setUploading(false);
  };

  const handleSaveDraft = async () => {
    if (!data.name && !data.propertyType) { onClose(); return; }
    try {
      await fetch("/api/properties", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: "Draft", name: data.name || `Draft ${data.propertyType || "Property"}` }),
      });
      onSaved();
    } catch { /* ignore */ }
    onClose();
  };

  const handleSubmit = async () => {
    if (!data.name?.trim()) { setError("Property name is required"); return; }
    if (!isAddressVerified()) { setError("Please confirm the address — pick a suggestion from the dropdown or confirm it manually."); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: "In Review" }),
      });
      const result = await res.json();
      if (result.success) { onSaved(); onClose(); }
      else setError(result.error || "Failed to submit");
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#fdf5f5] overflow-y-auto">
      {/* Close button */}
      <button onClick={handleSaveDraft} className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:text-[#555] shadow-sm transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Bottom padding leaves room for the fixed footer (progress bar + Back/Next). */}
      <div className="max-w-[560px] mx-auto px-4 py-8 md:py-12 pb-[160px]">
        {error && <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium text-center">{error}</div>}

        {/* Step 1: Property Type */}
        {step === 0 && (
          <div className="text-center">
            <h2 className="text-[20px] md:text-[24px] font-semibold text-[#111] mb-2">What type of property is this?</h2>
            <p className="text-[13px] text-[#888] mb-8">Select the closest match for your property. You can update this later.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {PROPERTY_TYPES.map((t) => {
                const selected = data.propertyType === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => update({ propertyType: t.value })}
                    className={`relative bg-white rounded-2xl p-6 text-center transition-all ${
                      selected ? "border-2 border-[#80020E] shadow-md" : "border border-[#e8e8e8] hover:border-[#ccc] hover:shadow-sm"
                    }`}>
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#80020E] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} alt={t.label} className="w-24 h-24 mx-auto mb-3 object-contain" />
                    <div className="text-[14px] font-semibold text-[#111] mb-1">{t.label}</div>
                    <div className="text-[11px] text-[#999] leading-relaxed">{t.desc}</div>
                  </button>
                );
              })}
            </div>
            {data.propertyType && (
              <p className="text-[13px] text-[#888]">Selected: <span className="font-semibold text-[#80020E]">{data.propertyType}</span></p>
            )}
          </div>
        )}

        {/* Step 2: Beds & Capacity */}
        {step === 1 && (
          <div>
            <h2 className="text-[20px] md:text-[24px] font-semibold text-[#111] mb-2 text-center">Beds, baths & guest capacity</h2>
            <p className="text-[13px] text-[#888] mb-8 text-center">Tell us about the sleeping and hosting capacity.</p>
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 md:p-6">
              <Stepper label="Bedrooms" value={data.bedrooms} onChange={(v) => update({ bedrooms: v })} min={0} max={15}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7"/><path d="M3 12h18"/><rect x="7" y="7" width="4" height="5" rx="1"/><rect x="13" y="7" width="4" height="5" rx="1"/></svg>} />
              <Stepper label="Bathrooms" value={data.bathrooms} onChange={(v) => update({ bathrooms: v })} min={0} max={10}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12h16M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M6 12V5a2 2 0 012-2h1"/></svg>} />
              <Stepper label="Max Guests" value={data.maxGuests} onChange={(v) => update({ maxGuests: v })} min={1} max={30}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
            </div>
          </div>
        )}

        {/* Step 3: Photos & Description */}
        {step === 2 && (
          <div>
            <h2 className="text-[20px] md:text-[24px] font-semibold text-[#111] mb-2 text-center">Photos & description</h2>
            <p className="text-[13px] text-[#888] mb-8 text-center">Add photos and a short description. You can update this later.</p>
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 md:p-6">
              {/* Photo upload */}
              {data.photoUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {data.photoUrls.map((url, i) => (
                    <div key={i} className="w-16 h-16 rounded-xl bg-[#f0f0f0] border border-[#e2e2e2] overflow-hidden relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => update({ photoUrls: data.photoUrls.filter((_, j) => j !== i) })}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full h-[100px] border-2 border-dashed border-[#ddd] rounded-xl flex flex-col items-center justify-center gap-1.5 text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-50 mb-5">
                {uploading ? <div className="w-5 h-5 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" /> : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                )}
                <span className="text-[12px] font-medium">{uploading ? "Uploading..." : "Take or upload photos"}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoUpload(e.target.files)} />

              {/* Description */}
              <div>
                <label className="block text-[13px] font-medium text-[#333] mb-2">Describe the property</label>
                <textarea value={data.description} onChange={(e) => update({ description: e.target.value })}
                  placeholder="Describe the property" rows={4}
                  className="w-full px-4 py-3 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Address & Location */}
        {step === 3 && (
          <div>
            <h2 className="text-[20px] md:text-[24px] font-semibold text-[#111] mb-2 text-center">Where&apos;s your place located?</h2>
            <p className="text-[13px] text-[#888] mb-8 text-center">We only share your address after guests book. Until then, they&apos;ll see an approximate location.</p>
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 md:p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#333] mb-1.5">Property name <span className="text-[#80020E]">*</span></label>
                <input type="text" value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Cosy Mountain Cabin"
                  className="w-full h-[44px] px-4 border border-[#e2e2e2] rounded-xl text-[14px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors" />
              </div>
              <AddressLocationPicker
                value={{ address: data.address, city: data.city, postcode: data.postcode, country: data.country, lat: data.lat, lng: data.lng }}
                onChange={(v) => update(v)}
                confirmedManual={addressManuallyConfirmed}
                onConfirmedManualChange={setAddressManuallyConfirmed}
              />
            </div>
          </div>
        )}

      </div>

      {/* Fixed footer: four segmented progress bars + Back / Next, pinned
          to the bottom of the viewport on both desktop and mobile. */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-[#fdf5f5] border-t border-[#f0e6e6]">
        <div className="max-w-[560px] mx-auto px-4 pt-3 pb-3">
          {/* Step indicator: one filled bar per step completed */}
          <div className="flex gap-1.5 mb-3 max-w-[160px]">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-[3px] flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-[#80020E]" : "bg-[#e8d6d6]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {step === 0 ? (
              <button onClick={handleSaveDraft} className="text-[13px] font-medium text-[#999] hover:text-[#555] transition-colors">Save as draft</button>
            ) : (
              <button onClick={() => setStep(step - 1)} className="text-[13px] font-medium text-[#555] hover:text-[#111] transition-colors">Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()}
                className="px-6 py-2.5 border border-[#80020E] text-[#80020E] bg-transparent rounded-xl text-[13px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-40">
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2.5 border border-[#80020E] text-[#80020E] bg-transparent rounded-xl text-[13px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
