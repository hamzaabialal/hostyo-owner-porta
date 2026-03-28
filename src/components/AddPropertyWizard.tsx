"use client";
import { useState, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface WizardData {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  bedTypes: string;
  photoUrls: string[];
  condition: string;
  features: string;
  internalNotes: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
}

const INITIAL: WizardData = {
  propertyType: "", bedrooms: 1, bathrooms: 1, maxGuests: 2, bedTypes: "",
  photoUrls: [], condition: "", features: "", internalNotes: "",
  name: "", address: "", city: "", postcode: "", country: "",
};

const PROPERTY_TYPES = [
  { value: "Apartment", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="7" x2="9" y2="7.01"/><line x1="15" y1="7" x2="15" y2="7.01"/><line x1="9" y1="12" x2="9" y2="12.01"/><line x1="15" y1="12" x2="15" y2="12.01"/><path d="M9 17v5h6v-5"/></svg> },
  { value: "Villa", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg> },
  { value: "House", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { value: "Studio", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="10" x2="12" y2="20"/></svg> },
];

const STEPS = ["Type", "Capacity", "Photos", "Address"];

/* ------------------------------------------------------------------ */
/*  Stepper control                                                    */
/* ------------------------------------------------------------------ */
function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#f3f3f3] last:border-b-0">
      <span className="text-[13px] font-medium text-[#333]">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-lg border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-30" disabled={value <= min}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span className="text-[15px] font-semibold text-[#111] w-6 text-center tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 rounded-lg border border-[#e2e2e2] flex items-center justify-center text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-30" disabled={value >= max}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wizard                                                        */
/* ------------------------------------------------------------------ */
export default function AddPropertyWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

  const canNext = () => {
    if (step === 0) return !!data.propertyType;
    if (step === 1) return data.bedrooms > 0 && data.bathrooms > 0 && data.maxGuests > 0;
    return true;
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
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
    setSubmitting(true);
    try {
      await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || `Draft ${data.propertyType || "Property"}`,
          status: "Draft",
          propertyType: data.propertyType, bedrooms: data.bedrooms, bathrooms: data.bathrooms,
          maxGuests: data.maxGuests, bedTypes: data.bedTypes, internalNotes: data.internalNotes,
          features: data.features, condition: data.condition, address: data.address,
          city: data.city, postcode: data.postcode, country: data.country,
        }),
      });
      onSaved();
    } catch { /* ignore */ }
    onClose();
  };

  const handleSubmit = async () => {
    if (!data.name?.trim()) { setError("Property name is required"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name, status: "In Review",
          propertyType: data.propertyType, bedrooms: data.bedrooms, bathrooms: data.bathrooms,
          maxGuests: data.maxGuests, bedTypes: data.bedTypes, internalNotes: data.internalNotes,
          features: data.features, condition: data.condition, address: data.address,
          city: data.city, postcode: data.postcode, country: data.country,
        }),
      });
      const result = await res.json();
      if (result.success) { onSaved(); onClose(); }
      else setError(result.error || "Failed to submit");
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={handleSaveDraft} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#eaeaea] flex-shrink-0">
            <div>
              <div className="text-[15px] font-semibold text-[#111]">Add Property</div>
              <div className="text-[12px] text-[#999] mt-0.5">Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
            </div>
            <button onClick={handleSaveDraft} className="p-2 text-[#999] hover:text-[#555] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex gap-1.5 px-6 pt-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 h-[3px] rounded-full transition-colors ${i <= step ? "bg-[#80020E]" : "bg-[#eaeaea]"}`} />
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium">{error}</div>}

            {/* Step 0: Type */}
            {step === 0 && (
              <div>
                <div className="text-[14px] font-semibold text-[#111] mb-1">What type of property is this?</div>
                <div className="text-[12px] text-[#888] mb-5">Select the best match for your property.</div>
                <div className="grid grid-cols-2 gap-3">
                  {PROPERTY_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => update({ propertyType: t.value })}
                      className={`p-5 rounded-xl border text-center transition-all ${data.propertyType === t.value ? "border-[#80020E] bg-[#80020E]/5 shadow-sm" : "border-[#e2e2e2] bg-white hover:border-[#ccc]"}`}>
                      <div className={`mx-auto mb-2 ${data.propertyType === t.value ? "text-[#80020E]" : "text-[#bbb]"}`}>{t.icon}</div>
                      <div className={`text-[13px] font-semibold ${data.propertyType === t.value ? "text-[#80020E]" : "text-[#555]"}`}>{t.value}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Capacity */}
            {step === 1 && (
              <div>
                <div className="text-[14px] font-semibold text-[#111] mb-1">Beds, baths & guest capacity</div>
                <div className="text-[12px] text-[#888] mb-5">Tell us about the sleeping and hosting capacity.</div>
                <div className="bg-white border border-[#eaeaea] rounded-xl p-4 mb-4">
                  <Stepper label="Bedrooms" value={data.bedrooms} onChange={(v) => update({ bedrooms: v })} min={0} max={15} />
                  <Stepper label="Bathrooms" value={data.bathrooms} onChange={(v) => update({ bathrooms: v })} min={0} max={10} />
                  <Stepper label="Max Guests" value={data.maxGuests} onChange={(v) => update({ maxGuests: v })} min={1} max={30} />
                </div>
                <label className="block text-[12px] font-medium text-[#888] mb-1.5">Bed types (optional)</label>
                <input type="text" value={data.bedTypes} onChange={(e) => update({ bedTypes: e.target.value })} placeholder="e.g. 2 kings, 1 queen, 2 singles" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
              </div>
            )}

            {/* Step 2: Photos & Notes */}
            {step === 2 && (
              <div>
                <div className="text-[14px] font-semibold text-[#111] mb-1">Photos & property notes</div>
                <div className="text-[12px] text-[#888] mb-5">Add photos and any useful internal notes. This step is optional.</div>

                <div className="mb-5">
                  <label className="block text-[12px] font-medium text-[#888] mb-2">Property photos</label>
                  {data.photoUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {data.photoUrls.map((url, i) => (
                        <div key={i} className="w-[64px] h-[64px] rounded-lg bg-[#f0f0f0] border border-[#e2e2e2] overflow-hidden relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => update({ photoUrls: data.photoUrls.filter((_, j) => j !== i) })} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full h-[80px] border-2 border-dashed border-[#ddd] rounded-xl flex flex-col items-center justify-center gap-1 text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-50">
                    {uploading ? <div className="w-5 h-5 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" /> : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    )}
                    <span className="text-[11px] font-medium">{uploading ? "Uploading..." : "Take or upload photos"}</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoUpload(e.target.files)} />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Overall condition</label>
                    <textarea value={data.condition} onChange={(e) => update({ condition: e.target.value })} placeholder="Describe the general state of the property" rows={2} className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Standout features / amenities</label>
                    <textarea value={data.features} onChange={(e) => update({ features: e.target.value })} placeholder="Pool, sea view, parking, balcony, etc." rows={2} className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Internal notes</label>
                    <textarea value={data.internalNotes} onChange={(e) => update({ internalNotes: e.target.value })} placeholder="Anything important for onboarding context" rows={2} className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Address */}
            {step === 3 && (
              <div>
                <div className="text-[14px] font-semibold text-[#111] mb-1">Property address</div>
                <div className="text-[12px] text-[#888] mb-5">Where is this property located?</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Property name *</label>
                    <input type="text" value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Cosy Mountain Cabin" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Street address</label>
                    <input type="text" value={data.address} onChange={(e) => update({ address: e.target.value })} placeholder="Full street address" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#888] mb-1.5">City</label>
                      <input type="text" value={data.city} onChange={(e) => update({ city: e.target.value })} placeholder="City" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#888] mb-1.5">Postcode</label>
                      <input type="text" value={data.postcode} onChange={(e) => update({ postcode: e.target.value })} placeholder="Postcode" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#888] mb-1.5">Country</label>
                    <input type="text" value={data.country} onChange={(e) => update({ country: e.target.value })} placeholder="Country" className="w-full h-[40px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                  </div>
                </div>
                <div className="mt-4 h-[140px] rounded-xl bg-[#f5f5f5] border border-[#e2e2e2] flex items-center justify-center">
                  <div className="text-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" className="mx-auto mb-1"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div className="text-[11px] text-[#bbb]">Map preview coming soon</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#eaeaea] flex-shrink-0">
            {step === 0 ? (
              <button onClick={handleSaveDraft} className="text-[13px] font-medium text-[#999] hover:text-[#555] transition-colors">Save as draft</button>
            ) : (
              <button onClick={() => setStep(step - 1)} className="text-[13px] font-medium text-[#555] hover:text-[#111] transition-colors">← Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="px-5 py-2.5 bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-40">Continue</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">{submitting ? "Submitting..." : "Submit for Review"}</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
