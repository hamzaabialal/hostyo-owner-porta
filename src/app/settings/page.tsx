"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";

/* ------------------------------------------------------------------ */
/*  Eye icon SVGs                                                      */
/* ------------------------------------------------------------------ */
function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-8 left-1/2 z-[9999] -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111] px-6 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 pointer-events-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle                                                             */
/* ------------------------------------------------------------------ */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-[#80020E]" : "bg-[#ddd]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[16px] w-[16px] translate-y-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ${
          checked ? "translate-x-[21px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Password Change Panel                                              */
/* ------------------------------------------------------------------ */
function PasswordPanel({ onClose, showToast, email }: { onClose: () => void; showToast: (msg: string) => void; email: string }) {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-[#111] outline-none transition-colors placeholder:text-[#999] focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] pr-11";
  const eyeBtnCls =
    "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 text-[#999] hover:text-[#555] bg-transparent border-none cursor-pointer";

  const handleSubmit = async () => {
    if (!currentPass) { showToast("Please enter your current password."); return; }
    if (newPass.length < 6) { showToast("New password must be at least 6 characters."); return; }
    if (newPass !== confirmPass) { showToast("Passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Password updated successfully.");
        onClose();
      } else {
        showToast(data.error || "Failed to update password.");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[440px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[201] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div className="text-[15px] font-semibold text-[#111]">Change Password</div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="text-[13px] text-[#888] mb-6">
            Enter your current password and choose a new one.
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">Current password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  className={inputCls}
                />
                <button type="button" className={eyeBtnCls} onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <EyeClosed /> : <EyeOpen />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">New password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new password"
                  className={inputCls}
                />
                <button type="button" className={eyeBtnCls} onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeClosed /> : <EyeOpen />}
                </button>
              </div>
              <div className="mt-1.5 text-[11px] text-[#aaa]">Minimum 6 characters</div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                  className={inputCls}
                />
                <button type="button" className={eyeBtnCls} onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeClosed /> : <EyeOpen />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#eaeaea] flex-shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-lg bg-[#80020E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6b010c] disabled:opacity-60"
          >
            {saving ? "Updating..." : "Update password"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const { data: session } = useSession();

  /* ---- toast ---- */
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2800);
  }, []);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  /* ---- Profile ---- */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Payout fields
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer");
  const [legalName, setLegalName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  // Fetch profile from Notion once session is available
  const [profileFetched, setProfileFetched] = useState(false);
  useEffect(() => {
    if (profileFetched) return;
    const sessionEmail = session?.user?.email;
    if (!sessionEmail) return; // Wait for session to load
    setProfileFetched(true);

    fetch(`/api/profile?email=${encodeURIComponent(sessionEmail)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.profile) {
          const p = data.profile;
          setFullName(p.fullName || "");
          setEmail(p.email || "");
          setPhone(p.phone || "");
          setIban(p.iban || "");
          setBic(p.bic || "");
          setBeneficiary(p.beneficiary || "");
          setPayoutMethod(p.payoutMethod || "Bank Transfer");
          setLegalName(p.legalName || "");
          setBillingAddress(p.billingAddress || "");
        } else {
          setFullName(session.user?.name || "");
          setEmail(sessionEmail);
        }
      })
      .catch(() => {
        setFullName(session.user?.name || "");
        setEmail(sessionEmail);
      })
      .finally(() => setProfileLoading(false));
  }, [session, profileFetched]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, phone }),
      });
      const data = await res.json();
      showToast(data.ok ? "Profile saved." : (data.error || "Failed to save."));
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePayout = async () => {
    setSavingPayout(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, iban, bic, beneficiary, payoutMethod, legalName, billingAddress }),
      });
      const data = await res.json();
      showToast(data.ok ? "Payout details saved." : (data.error || "Failed to save."));
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setSavingPayout(false);
    }
  };

  /* ---- Notifications ---- */
  const [notifs, setNotifs] = useState([
    { label: "New reservation notifications", on: true },
    { label: "Payout processed notifications", on: true },
    { label: "Expense submitted notifications", on: true },
    { label: "Monthly report ready", on: true },
    { label: "Marketing updates", on: false },
  ]);

  const toggleNotif = (idx: number) => {
    setNotifs((prev) => prev.map((n, i) => (i === idx ? { ...n, on: !n.on } : n)));
  };

  /* ---- Security ---- */
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);

  /* ---- Sessions ---- */
  const sessions = [
    { device: "Chrome on macOS", platform: "Desktop", lastActive: "Today", current: true },
    { device: "Safari on iPhone", platform: "iOS", lastActive: "Yesterday", current: false },
  ];

  /* ---- Shared styles ---- */
  const cardCls = "rounded-xl border border-[#eaeaea] bg-white p-7";
  const labelCls = "mb-1.5 block text-[13px] font-medium text-[#555]";
  const inputCls =
    "w-full rounded-lg border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-[#111] outline-none transition-colors placeholder:text-[#999] focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08]";
  const inputDisabledCls =
    "w-full rounded-lg border border-[#eaeaea] bg-[#f8f8f8] px-3.5 py-2.5 text-sm text-[#999] outline-none cursor-not-allowed";

  return (
    <AppShell title="Settings">
      <div className="text-[13px] text-[#888] mb-6 -mt-1">
        Manage your account, notifications, and security preferences.
      </div>

      <div className="max-w-[640px] flex flex-col gap-6">
        {profileLoading && (
          <div className="flex items-center justify-center py-10 text-sm text-[#999]">Loading profile...</div>
        )}
        {/* ── 1. Profile ── */}
        <div className={cardCls}>
          <h2 className="mb-6 text-[15px] font-bold text-[#111]">Profile</h2>

          {/* Profile picture */}
          <div className="flex items-center gap-4 mb-6">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-[20px] font-bold">
                {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
              </div>
            )}
            <div>
              <div className="text-[14px] font-semibold text-[#111]">{fullName || "User"}</div>
              <div className="text-[12px] text-[#888]">{email}</div>
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="mb-5">
            <label className={labelCls}>Email</label>
            <input type="email" value={email} disabled className={inputDisabledCls} />
          </div>

          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          <button
            type="button"
            disabled={savingProfile}
            className="mt-6 rounded-lg bg-[#80020E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6b010c] disabled:opacity-60"
            onClick={saveProfile}
          >
            {savingProfile ? "Saving..." : "Save changes"}
          </button>
        </div>

        {/* ── 2. Email Notifications ── */}
        <div className={cardCls}>
          <h2 className="mb-5 text-[15px] font-bold text-[#111]">Email Notifications</h2>

          {notifs.map((n, idx) => (
            <div
              key={n.label}
              className={`flex items-center justify-between py-3.5 ${
                idx < notifs.length - 1 ? "border-b border-[#f0f0f0]" : ""
              }`}
            >
              <span className="text-[14px] font-medium text-[#111]">{n.label}</span>
              <Toggle checked={n.on} onChange={() => toggleNotif(idx)} />
            </div>
          ))}
        </div>

        {/* ── 3. Security ── */}
        <div className={cardCls}>
          <h2 className="mb-5 text-[15px] font-bold text-[#111]">Security</h2>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-medium text-[#111]">Password</div>
              <div className="text-[13px] text-[#888] mt-0.5">Change your password to keep your account secure.</div>
            </div>
            <button
              type="button"
              onClick={() => setPasswordPanelOpen(true)}
              className="rounded-lg border border-[#80020E] bg-white px-4 py-2 text-[13px] font-semibold text-[#80020E] transition-colors hover:bg-[#fdf0f1] flex-shrink-0"
            >
              Change password
            </button>
          </div>
        </div>

        {/* ── 4. Finance & Payout ── */}
        <div className={cardCls}>
          <h2 className="mb-2 text-[15px] font-bold text-[#111]">Finance & Payout</h2>
          <p className="text-[12px] text-[#999] mb-5">Manage your payout details and billing preferences.</p>

          <div className="mb-5">
            <label className={labelCls}>IBAN</label>
            <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="e.g. CY17 0020 0128 0000 0012 0052 7600" className={inputCls} />
          </div>
          <div className="mb-5">
            <label className={labelCls}>BIC / SWIFT</label>
            <input type="text" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="e.g. BCYPCY2N" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className={labelCls}>Beneficiary Name</label>
              <input type="text" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Account holder name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payout Method</label>
              <input type="text" value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} placeholder="Bank Transfer" className={inputCls} />
            </div>
          </div>
          <div className="mb-5">
            <label className={labelCls}>Invoice / Legal Display Name</label>
            <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Business or legal name for invoices" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Billing Address</label>
            <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Full billing address" className={inputCls} />
          </div>

          <button
            type="button"
            disabled={savingPayout}
            className="mt-6 rounded-lg bg-[#80020E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6b010c] disabled:opacity-60"
            onClick={savePayout}
          >
            {savingPayout ? "Saving..." : "Save payout details"}
          </button>
        </div>

        {/* ── 5. Active Sessions ── */}
        <div className={cardCls}>
          <h2 className="mb-5 text-[15px] font-bold text-[#111]">Active Sessions</h2>

          {sessions.map((s, idx) => (
            <div
              key={s.device}
              className={`flex items-center justify-between py-3.5 ${
                idx < sessions.length - 1 ? "border-b border-[#f0f0f0]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Device icon */}
                <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                  {s.platform === "Desktop" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8">
                      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-[14px] font-medium text-[#111] flex items-center gap-2">
                    {s.device}
                    {s.current && (
                      <span className="pill pill-live text-[10px]">Current</span>
                    )}
                  </div>
                  <div className="text-[12px] text-[#999] mt-0.5">Last active: {s.lastActive}</div>
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  onClick={() => showToast(`Signed out of ${s.device}.`)}
                  className="text-[12px] font-medium text-[#999] hover:text-[#80020E] transition-colors"
                >
                  Sign out
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="mt-5 text-[13px] font-medium text-[#999] hover:text-[#80020E] transition-colors"
            onClick={() => showToast("All other sessions signed out.")}
          >
            Sign out all other sessions
          </button>
        </div>
      </div>

      {/* Password change panel */}
      {passwordPanelOpen && (
        <PasswordPanel
          onClose={() => setPasswordPanelOpen(false)}
          showToast={showToast}
          email={email}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} />
    </AppShell>
  );
}
