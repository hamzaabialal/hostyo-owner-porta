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

// Categories managed by admin only — removed from vendor form

// Statuses managed by admin, not vendor

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
  const workStatus = "In Review"; // Auto-set on vendor submission
  const category = ""; // Category is set by admin, not vendor
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [receipts, setReceipts] = useState<UploadedFile[]>([]);
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
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
    if (photos.length === 0) errs.push("Please upload at least one photo");
    if (receipts.length === 0) errs.push("Please upload a receipt or invoice");
    if (!confirmed) errs.push("Please confirm the declaration above");
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

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        {/* 1. Reservation context card */}
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

        <div className="space-y-5">
          {/* 2. Photo Upload — priority, right after reservation card */}
          <UploadArea
            label="Photos"
            hint="Upload photos to document the completed work"
            files={photos}
            onFiles={(f) => setPhotos((prev) => [...prev, f])}
            accept="image/*"
            capture="environment"
          />

          {/* 3. Receipt Upload */}
          <UploadArea
            label="Receipt or Invoice"
            hint="Upload receipt or invoice to HOSTYO LTD"
            files={receipts}
            onFiles={(f) => setReceipts((prev) => [...prev, f])}
            accept="image/*,.pdf"
          />

          {/* Work Description — optional */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-1">Work Description <span className="text-[11px] font-normal text-[#999]">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work completed, any issue found, and anything important we should know"
              rows={3}
              className="w-full px-3.5 py-3 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white"
            />
          </div>

          {/* 5. Confirmation checkbox */}
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-2">Confirmation</label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#d0d0d0] text-[#80020E] focus:ring-[#80020E] accent-[#80020E] flex-shrink-0"
              />
              <span className="text-[12px] text-[#666] leading-relaxed">
                I confirm that the work has been completed to a proper standard and that the uploaded photos clearly show the result. I understand that blurry or insufficient photo documentation may result in longer review times and payment delays. All invoices must be made out to <strong>HOSTYO LTD</strong>.
              </span>
            </label>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-3.5 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl">
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

          {/* Submit button — ghost style */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !confirmed}
            className="w-full h-[48px] border-2 border-[#80020E] text-[#80020E] bg-transparent rounded-xl text-[14px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
