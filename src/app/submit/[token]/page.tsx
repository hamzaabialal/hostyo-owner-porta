"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ReservationContext {
  id: string;
  ref: string;
  property: string;
  guest: string;
  checkin: string;
  checkout: string;
  channel: string;
}

interface UploadedFile {
  url: string;
  name: string;
  preview?: string;
}

const CATEGORIES = [
  "Maintenance",
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Laundry",
  "Supplies",
  "Repair",
  "Other",
];

const STATUSES = [
  { value: "Scheduled", label: "Scheduled", desc: "Work is planned or assigned" },
  { value: "In Review", label: "In Review", desc: "Work completed, awaiting review" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  File Upload Hook                                                   */
/* ------------------------------------------------------------------ */
function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File): Promise<UploadedFile | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/submit/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      return { url: data.url, name: file.name, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined };
    } catch (e) {
      console.error("Upload failed:", e);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading };
}

/* ------------------------------------------------------------------ */
/*  Page States                                                        */
/* ------------------------------------------------------------------ */
function LoadingState() {
  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[14px] text-[#888]">Loading reservation...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-6">
      <div className="text-center max-w-[320px]">
        <div className="w-14 h-14 rounded-2xl bg-[#F6EDED] flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7A5252" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-[16px] font-semibold text-[#111] mb-2">Invalid Link</h1>
        <p className="text-[13px] text-[#888] leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function SuccessState({ expenseId }: { expenseId: string }) {
  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-6">
      <div className="text-center max-w-[340px]">
        <div className="w-16 h-16 rounded-full bg-[#EAF3EF] flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 className="text-[18px] font-semibold text-[#111] mb-2">Expense Submitted</h1>
        <p className="text-[13px] text-[#888] leading-relaxed mb-4">
          Your work details, photos, and receipt have been uploaded successfully.
        </p>
        <p className="text-[12px] text-[#aaa]">
          Reference: <span className="font-mono font-medium text-[#555]">{expenseId}</span>
        </p>
        <p className="text-[12px] text-[#aaa] mt-3">
          We&apos;ve logged this submission against the reservation for review.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload Area Component                                              */
/* ------------------------------------------------------------------ */
function UploadArea({
  label,
  hint,
  files,
  onFiles,
  accept,
  capture,
}: {
  label: string;
  hint: string;
  files: UploadedFile[];
  onFiles: (f: UploadedFile) => void;
  accept: string;
  capture?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useFileUpload();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      const result = await upload(file);
      if (result) onFiles(result);
    }
  };

  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#333] mb-2">{label}</label>

      {/* Existing files */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {files.map((f, i) => (
            <div key={i} className="w-[72px] h-[72px] rounded-xl bg-[#f0f0f0] border border-[#e2e2e2] overflow-hidden flex items-center justify-center">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full h-[100px] border-2 border-dashed border-[#ddd] rounded-xl flex flex-col items-center justify-center gap-1.5 text-[#999] hover:border-[#80020E] hover:text-[#80020E] transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        )}
        <span className="text-[12px] font-medium">{uploading ? "Uploading..." : hint}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture as "environment" | undefined}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Form                                                          */
/* ------------------------------------------------------------------ */
export default function SubmitExpensePage() {
  const { token } = useParams<{ token: string }>();
  const [reservation, setReservation] = useState<ReservationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expenseId, setExpenseId] = useState("");

  // Form state
  const [workStatus, setWorkStatus] = useState("Scheduled");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [receipts, setReceipts] = useState<UploadedFile[]>([]);
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch reservation context
  useEffect(() => {
    if (!token) return;
    fetch(`/api/submit/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setReservation(data.reservation);
        else setError(data.error || "Invalid link");
      })
      .catch(() => setError("Could not load reservation"))
      .finally(() => setLoading(false));
  }, [token]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!description.trim()) errs.push("Please add a work description");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errs.push("Please enter a valid amount");
    // Photos/receipts are optional — don't block submission
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: workStatus,
          category,
          description,
          amount,
          vendorName,
          photoUrls: photos.map((p) => p.url),
          receiptUrls: receipts.map((r) => r.url),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setExpenseId(data.expenseId);
        setSubmitted(true);
      } else {
        setValidationErrors([data.error || "Submission failed"]);
      }
    } catch (err) {
      console.error("Submit error:", err);
      setValidationErrors(["Network error. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (submitted) return <SuccessState expenseId={expenseId} />;
  if (!reservation) return <ErrorState message="Reservation not found" />;

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#eaeaea] px-4 h-[52px] flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hostyo-logo.png" alt="Hostyo" className="w-7 h-7 rounded-md object-contain" />
        <span className="text-[14px] font-semibold text-[#111]">Submit Expense</span>
      </header>

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-32">
        {/* Reservation context card */}
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4 mb-5">
          <div className="text-[11px] font-medium text-[#999] uppercase tracking-wide mb-2">Reservation</div>
          <div className="text-[15px] font-semibold text-[#111] mb-1">{reservation.property}</div>
          <div className="text-[12px] text-[#888]">
            {reservation.ref && <span>{reservation.ref} &middot; </span>}
            {fmtDate(reservation.checkin)} – {fmtDate(reservation.checkout)}
          </div>
          {reservation.guest && (
            <div className="text-[12px] text-[#aaa] mt-1">Guest: {reservation.guest}</div>
          )}
          <div className="mt-3 px-3 py-2 bg-[#f8f8f8] rounded-lg text-[11px] text-[#888] leading-relaxed">
            You are submitting work completed for this reservation.
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Work Status */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Work Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setWorkStatus(s.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    workStatus === s.value
                      ? "border-[#80020E] bg-[#80020E]/5"
                      : "border-[#e2e2e2] bg-white hover:border-[#ccc]"
                  }`}
                >
                  <div className={`text-[13px] font-semibold ${workStatus === s.value ? "text-[#80020E]" : "text-[#333]"}`}>{s.label}</div>
                  <div className="text-[11px] text-[#999] mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Work Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3.5 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                    category === c
                      ? "border-[#80020E] bg-[#80020E] text-white"
                      : "border-[#e2e2e2] bg-white text-[#555] hover:border-[#ccc]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Work Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work completed, any issue found, and anything important we should know"
              rows={4}
              className="w-full px-3.5 py-3 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white"
            />
          </div>

          {/* Photo Upload */}
          <UploadArea
            label="Photos"
            hint="Take or upload photos"
            files={photos}
            onFiles={(f) => setPhotos((prev) => [...prev, f])}

            accept="image/*"
            capture="environment"
          />

          {/* Receipt Upload */}
          <UploadArea
            label="Receipt or Invoice"
            hint="Upload receipt or invoice"
            files={receipts}
            onFiles={(f) => setReceipts((prev) => [...prev, f])}

            accept="image/*,.pdf"
          />

          {/* Amount */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[#999]">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-[48px] pl-8 pr-4 border border-[#e2e2e2] rounded-xl text-[16px] font-semibold text-[#111] placeholder:text-[#ccc] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
          </div>

          {/* Vendor Name */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Vendor Name</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Your name or company"
              className="w-full h-[44px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
            />
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-5 p-3.5 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl">
            {validationErrors.map((err, i) => (
              <div key={i} className="text-[12px] text-[#7A5252] font-medium flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {err}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#eaeaea] p-4 safe-area-bottom">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full max-w-[480px] mx-auto block h-[48px] bg-[#80020E] text-white rounded-xl text-[14px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Expense"}
        </button>
      </div>
    </div>
  );
}
