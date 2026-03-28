"use client";

import { useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface WizardData {
  type: string;
  beds: number;
  baths: number;
  maxGuests: number;
  bedTypes: string;
  photos: string[];
  notes: string;
  features: string;
  condition: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
}

const defaultData: WizardData = {
  type: "",
  beds: 1,
  baths: 1,
  maxGuests: 2,
  bedTypes: "",
  photos: [],
  notes: "",
  features: "",
  condition: "",
  address: "",
  city: "",
  postcode: "",
  country: "",
};

const STEPS = [
  { label: "Property Type", short: "Type" },
  { label: "Beds & Capacity", short: "Capacity" },
  { label: "Photos & Notes", short: "Photos" },
  { label: "Address", short: "Address" },
];

const PROPERTY_TYPES = [
  {
    value: "Apartment",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/>
        <line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/>
        <line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/>
        <path d="M10 22v-4h4v4"/>
      </svg>
    ),
  },
  {
    value: "Villa",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
        <line x1="9" y1="9" x2="9" y2="9.01"/><line x1="15" y1="9" x2="15" y2="9.01"/>
      </svg>
    ),
  },
  {
    value: "House",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    value: "Studio",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9 20v-8h6v8"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Number Stepper                                                     */
/* ------------------------------------------------------------------ */
function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#f0f0f0] last:border-b-0">
      <span className="text-[14px] text-[#333] font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full border border-[#ddd] flex items-center justify-center text-[#555] hover:border-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <span className="text-[16px] font-semibold text-[#111] w-6 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full border border-[#ddd] flex items-center justify-center text-[#555] hover:border-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step Components                                                    */
/* ------------------------------------------------------------------ */
function StepType({ data, setData }: { data: WizardData; setData: (d: WizardData) => void }) {
  return (
    <div>
      <div className="text-[15px] font-semibold text-[#111] mb-1">What type of property is this?</div>
      <div className="text-[13px] text-[#888] mb-6">Choose the option that best describes your property.</div>
      <div className="grid grid-cols-2 gap-3">
        {PROPERTY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setData({ ...data, type: t.value })}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
              data.type === t.value
                ? "border-accent bg-[#fdf5f5] text-accent"
                : "border-[#eaeaea] bg-white text-[#888] hover:border-[#ccc]"
            }`}
          >
            <span className={data.type === t.value ? "text-accent" : "text-[#aaa]"}>{t.icon}</span>
            <span className="text-[14px] font-medium">{t.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepCapacity({ data, setData }: { data: WizardData; setData: (d: WizardData) => void }) {
  return (
    <div>
      <div className="text-[15px] font-semibold text-[#111] mb-1">Beds, baths, and guest capacity</div>
      <div className="text-[13px] text-[#888] mb-6">Tell us about the space so we can set things up correctly.</div>

      <div className="bg-white border border-[#eaeaea] rounded-xl px-5">
        <Stepper label="Bedrooms" value={data.beds} onChange={(v) => setData({ ...data, beds: v })} min={1} max={15} />
        <Stepper label="Bathrooms" value={data.baths} onChange={(v) => setData({ ...data, baths: v })} min={1} max={10} />
        <Stepper label="Max guests" value={data.maxGuests} onChange={(v) => setData({ ...data, maxGuests: v })} min={1} max={30} />
      </div>

      <div className="mt-5">
        <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Bed types (optional)</label>
        <input
          type="text"
          placeholder="e.g. 2 kings, 1 queen, 2 singles"
          value={data.bedTypes}
          onChange={(e) => setData({ ...data, bedTypes: e.target.value })}
          className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
        />
      </div>
    </div>
  );
}

function StepPhotos({ data, setData }: { data: WizardData; setData: (d: WizardData) => void }) {
  return (
    <div>
      <div className="text-[15px] font-semibold text-[#111] mb-1">Photos and property notes</div>
      <div className="text-[13px] text-[#888] mb-6">Add photos and any internal notes to help with onboarding.</div>

      {/* Photo upload area */}
      <div className="border-2 border-dashed border-[#ddd] rounded-xl p-8 text-center mb-5 hover:border-[#bbb] transition-colors cursor-pointer">
        <div className="w-12 h-12 rounded-xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div className="text-[13px] font-medium text-[#555] mb-1">Drop photos here or click to browse</div>
        <div className="text-[11px] text-[#aaa]">JPG, PNG up to 10 MB each</div>
      </div>

      {/* Photo preview */}
      {data.photos.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {data.photos.map((url, i) => (
            <div key={i} className="w-20 h-20 rounded-lg bg-[#f5f5f5] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Overall condition</label>
          <textarea
            rows={2}
            placeholder="e.g. Recently renovated, excellent condition throughout"
            value={data.condition}
            onChange={(e) => setData({ ...data, condition: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Standout features / amenities</label>
          <textarea
            rows={2}
            placeholder="e.g. Rooftop terrace, private pool, EV charger"
            value={data.features}
            onChange={(e) => setData({ ...data, features: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Internal notes (optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. Owner prefers no pets, key lockbox code is 4821"
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  );
}

function StepAddress({ data, setData }: { data: WizardData; setData: (d: WizardData) => void }) {
  return (
    <div>
      <div className="text-[15px] font-semibold text-[#111] mb-1">Property address</div>
      <div className="text-[13px] text-[#888] mb-6">Enter the full address for this property.</div>

      <div className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Street address</label>
          <input
            type="text"
            placeholder="e.g. 42 Kensington Gardens Square"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] font-medium text-[#555] mb-1.5 block">City</label>
            <input
              type="text"
              placeholder="e.g. London"
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
              className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Postcode</label>
            <input
              type="text"
              placeholder="e.g. W2 4BB"
              value={data.postcode}
              onChange={(e) => setData({ ...data, postcode: e.target.value })}
              className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-[13px] font-medium text-[#555] mb-1.5 block">Country</label>
          <input
            type="text"
            placeholder="e.g. United Kingdom"
            value={data.country}
            onChange={(e) => setData({ ...data, country: e.target.value })}
            className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors"
          />
        </div>

        {/* Map placeholder */}
        <div className="mt-2 h-[180px] rounded-xl bg-[#f5f5f5] border border-[#eaeaea] flex items-center justify-center">
          <div className="text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" className="mx-auto mb-2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="text-[12px] text-[#aaa]">Map preview will appear here</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wizard Shell                                                       */
/* ------------------------------------------------------------------ */
export default function AddPropertyWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData);
  const [submitting, setSubmitting] = useState(false);

  const canNext = useCallback(() => {
    if (step === 0) return !!data.type;
    if (step === 1) return data.beds > 0 && data.baths > 0 && data.maxGuests > 0;
    return true; // steps 2 & 3 are optional-but-useful
  }, [step, data]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = () => {
    setSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 800);
  };

  const handleSaveDraft = () => {
    // Auto-save as draft and close
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={handleSaveDraft} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[560px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[201] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div>
            <div className="text-[15px] font-semibold text-[#111]">Add Property</div>
            <div className="text-[11px] text-[#aaa]">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</div>
          </div>
          <button
            onClick={handleSaveDraft}
            className="p-2 text-[#999] hover:text-[#555] transition-colors"
            title="Save as draft and close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-4 pb-2">
          {STEPS.map((s, i) => (
            <div
              key={s.short}
              className={`h-[3px] flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-[#eaeaea]"
              }`}
            />
          ))}
        </div>

        {/* Step labels */}
        <div className="flex gap-1.5 px-6 pb-4">
          {STEPS.map((s, i) => (
            <div
              key={s.short}
              className={`flex-1 text-[10px] font-medium transition-colors ${
                i <= step ? "text-accent" : "text-[#ccc]"
              }`}
            >
              {s.short}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && <StepType data={data} setData={setData} />}
          {step === 1 && <StepCapacity data={data} setData={setData} />}
          {step === 2 && <StepPhotos data={data} setData={setData} />}
          {step === 3 && <StepAddress data={data} setData={setData} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#eaeaea] flex-shrink-0">
          <div>
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-[13px] font-medium text-[#555] hover:text-[#111] transition-colors"
              >
                Back
              </button>
            ) : (
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 text-[13px] font-medium text-[#888] hover:text-[#555] transition-colors"
              >
                Save as draft
              </button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canNext()}
                className="px-5 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
