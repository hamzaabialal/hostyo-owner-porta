"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { useEffectiveSession } from "@/lib/useEffectiveSession";

/* ------------------------------------------------------------------ */
/*  Country codes                                                      */
/* ------------------------------------------------------------------ */
const COUNTRY_CODES = [
  { code: "+357", flag: "\ud83c\udde8\ud83c\uddfe", country: "Cyprus" },
  { code: "+30", flag: "\ud83c\uddec\ud83c\uddf7", country: "Greece" },
  { code: "+44", flag: "\ud83c\uddec\ud83c\udde7", country: "UK" },
  { code: "+1", flag: "\ud83c\uddfa\ud83c\uddf8", country: "US" },
  { code: "+49", flag: "\ud83c\udde9\ud83c\uddea", country: "Germany" },
  { code: "+33", flag: "\ud83c\uddeb\ud83c\uddf7", country: "France" },
  { code: "+34", flag: "\ud83c\uddea\ud83c\uddf8", country: "Spain" },
  { code: "+39", flag: "\ud83c\uddee\ud83c\uddf9", country: "Italy" },
  { code: "+31", flag: "\ud83c\uddf3\ud83c\uddf1", country: "Netherlands" },
  { code: "+351", flag: "\ud83c\uddf5\ud83c\uddf9", country: "Portugal" },
  { code: "+41", flag: "\ud83c\udde8\ud83c\udded", country: "Switzerland" },
  { code: "+43", flag: "\ud83c\udde6\ud83c\uddf9", country: "Austria" },
  { code: "+46", flag: "\ud83c\uddf8\ud83c\uddea", country: "Sweden" },
  { code: "+47", flag: "\ud83c\uddf3\ud83c\uddf4", country: "Norway" },
  { code: "+48", flag: "\ud83c\uddf5\ud83c\uddf1", country: "Poland" },
  { code: "+90", flag: "\ud83c\uddf9\ud83c\uddf7", country: "Turkey" },
  { code: "+971", flag: "\ud83c\udde6\ud83c\uddea", country: "UAE" },
  { code: "+61", flag: "\ud83c\udde6\ud83c\uddfa", country: "Australia" },
  { code: "+91", flag: "\ud83c\uddee\ud83c\uddf3", country: "India" },
  { code: "+86", flag: "\ud83c\udde8\ud83c\uddf3", country: "China" },
  { code: "+81", flag: "\ud83c\uddef\ud83c\uddf5", country: "Japan" },
  { code: "+55", flag: "\ud83c\udde7\ud83c\uddf7", country: "Brazil" },
  { code: "+7", flag: "\ud83c\uddf7\ud83c\uddfa", country: "Russia" },
  { code: "+27", flag: "\ud83c\uddff\ud83c\udde6", country: "South Africa" },
  { code: "+52", flag: "\ud83c\uddf2\ud83c\uddfd", country: "Mexico" },
  { code: "+65", flag: "\ud83c\uddf8\ud83c\uddec", country: "Singapore" },
  { code: "+852", flag: "\ud83c\udded\ud83c\uddf0", country: "Hong Kong" },
];

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
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eaeaea] flex-shrink-0">
          <div className="text-[15px] font-semibold text-[#111]">Change Password</div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="text-[13px] text-[#888] mb-6">Enter your current password and choose a new one.</div>
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">Current password</label>
              <div className="relative">
                <input type={showCurrent ? "text" : "password"} value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} placeholder="Enter current password" className={inputCls} />
                <button type="button" className={eyeBtnCls} onClick={() => setShowCurrent(!showCurrent)}>{showCurrent ? <EyeClosed /> : <EyeOpen />}</button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">New password</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Enter new password" className={inputCls} />
                <button type="button" className={eyeBtnCls} onClick={() => setShowNew(!showNew)}>{showNew ? <EyeClosed /> : <EyeOpen />}</button>
              </div>
              <div className="mt-1.5 text-[11px] text-[#aaa]">Minimum 6 characters</div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#555]">Confirm new password</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Re-enter new password" className={inputCls} />
                <button type="button" className={eyeBtnCls} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeClosed /> : <EyeOpen />}</button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#eaeaea] flex-shrink-0">
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="w-full rounded-lg bg-[#80020E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6b010c] disabled:opacity-60">
            {saving ? "Updating..." : "Update password"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: "profile", label: "Profile" },
  { key: "finance", label: "Finance" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const { data: session } = useSession();
  // Effective session — drives profile fetches so an admin impersonating an
  // owner sees the OWNER's profile here, not their own admin profile.
  const { effectiveEmail } = useEffectiveSession();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

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
  const [countryCode, setCountryCode] = useState("+357");
  const [profilePicture, setProfilePicture] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payout fields
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer");
  const [legalName, setLegalName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  // Parse phone into country code + number
  const parsePhone = (raw: string) => {
    if (!raw) return;
    for (const cc of COUNTRY_CODES.sort((a, b) => b.code.length - a.code.length)) {
      if (raw.startsWith(cc.code)) {
        setCountryCode(cc.code);
        setPhone(raw.slice(cc.code.length).trim());
        return;
      }
    }
    setPhone(raw);
  };

  // Fetch profile whenever the effective user changes (sign-in, impersonation
  // start/stop). The /api/profile endpoint reads the effective scope from the
  // session cookie, so we don't have to pass an email — it always returns the
  // *currently viewed* user's profile.
  useEffect(() => {
    if (!effectiveEmail) return;
    let cancelled = false;
    setProfileLoading(true);

    fetch(`/api/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.profile) {
          const p = data.profile;
          setFullName(p.fullName || "");
          setEmail(p.email || "");
          parsePhone(p.phone || "");
          setIban(p.iban || "");
          setBic(p.bic || "");
          setBeneficiary(p.beneficiary || "");
          setPayoutMethod(p.payoutMethod || "Bank Transfer");
          setLegalName(p.legalName || "");
          setBillingAddress(p.billingAddress || "");
          setProfilePicture(p.profilePicture || "");
        } else {
          // Fall back to the JWT session display only when /api/profile fails;
          // during impersonation that's still the admin's name, but it's the
          // safest non-empty value we have.
          setFullName(session?.user?.name || "");
          setEmail(effectiveEmail);
          setProfilePicture("");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFullName(session?.user?.name || "");
        setEmail(effectiveEmail);
        setProfilePicture("");
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmail]);

  const [uploadingPicture, setUploadingPicture] = useState(false);

  const handleProfilePicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB."); return; }
    if (!file.type.startsWith("image/")) { showToast("Only image files are allowed."); return; }

    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok && data.url) {
        setProfilePicture(data.url);
        // Notify other components (Sidebar, etc.) to update immediately
        window.dispatchEvent(new CustomEvent("hostyo:profile-picture", { detail: data.url }));
        // Persist immediately so it survives a reload
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, profilePicture: data.url }),
        });
        showToast("Profile picture updated.");
      } else {
        showToast(data.error || "Upload failed.");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setUploadingPicture(false);
      // Clear the file input so the same file can be re-selected
      if (e.target) e.target.value = "";
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const fullPhone = phone ? `${countryCode}${phone}` : "";
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, phone: fullPhone, profilePicture: profilePicture || undefined }),
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
    { label: "New reservations", on: true },
    { label: "Payouts processed", on: true },
    { label: "Expenses submitted", on: true },
    { label: "Monthly reports", on: true },
    { label: "Marketing updates", on: false },
  ]);

  const toggleNotif = (idx: number) => {
    setNotifs((prev) => prev.map((n, i) => (i === idx ? { ...n, on: !n.on } : n)));
  };

  /* ---- Security ---- */
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);

  /* ---- 2FA ---- */
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  /* ---- Active Sessions ---- */
  const sessions = useMemo(() => {
    // Build from the current browser as a best-effort approximation.
    // Real session tracking would require a server-side store.
    if (typeof window === "undefined") return [];
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|Android/i.test(ua);
    const browser = /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : /Edg/i.test(ua) ? "Edge" : "Browser";
    const os = /Mac/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Linux/i.test(ua) ? "Linux" : "Unknown";
    return [
      { device: `${browser} on ${os}`, platform: isMobile ? "Mobile" : "Desktop", lastActive: "Now", current: true },
    ];
  }, []);

  /* ---- Shared styles ---- */
  const cardCls = "rounded-xl border border-[#eaeaea] bg-white p-7";
  const labelCls = "mb-1.5 block text-[13px] font-medium text-[#555]";
  const inputCls =
    "w-full rounded-lg border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-[#111] outline-none transition-colors placeholder:text-[#999] focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08]";
  const inputDisabledCls =
    "w-full rounded-lg border border-[#eaeaea] bg-[#f8f8f8] px-3.5 py-2.5 text-sm text-[#999] outline-none cursor-not-allowed";

  const avatarSrc = profilePicture || session?.user?.image || "";
  const initials = fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <AppShell title="Settings">
      <div className="text-[13px] text-[#888] mb-6 -mt-1">
        Manage your account, notifications, and security preferences.
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#eaeaea] mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "text-[#80020E] border-[#80020E]"
                : "text-[#999] border-transparent hover:text-[#555]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-[640px]">
        {profileLoading && activeTab === "profile" && (
          <div className="flex items-center justify-center py-10 text-sm text-[#999]">Loading profile...</div>
        )}

        {/* ── Profile Tab ── */}
        {activeTab === "profile" && !profileLoading && (
          <div className={cardCls}>
            <h2 className="mb-6 text-[15px] font-bold text-[#111]">Profile</h2>

            {/* Profile picture with upload */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative group">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-[20px] font-bold">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => !uploadingPicture && fileInputRef.current?.click()}
                  disabled={uploadingPicture}
                  className={`absolute inset-0 rounded-full flex items-center justify-center transition-colors cursor-pointer ${uploadingPicture ? "bg-black/50" : "bg-black/0 group-hover:bg-black/40"}`}
                >
                  {uploadingPicture ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfilePicture} className="hidden" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#111]">{fullName || "User"}</div>
                <div className="text-[12px] text-[#888]">{email}</div>
              </div>
            </div>

            <div className="mb-5">
              <label className={labelCls}>Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </div>

            <div className="mb-5">
              <label className={labelCls}>Email</label>
              <input type="email" value={email} disabled className={inputDisabledCls} />
            </div>

            <div className="mb-0">
              <label className={labelCls}>Phone</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-[110px] rounded-lg border border-[#eaeaea] bg-white px-2.5 py-2.5 text-sm text-[#111] outline-none focus:border-[#80020E] transition-colors"
                >
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                  placeholder="Phone"
                  className={inputCls}
                />
              </div>
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
        )}

        {/* ── Finance Tab ── */}
        {activeTab === "finance" && (
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
        )}

        {/* ── Notifications Tab ── */}
        {activeTab === "notifications" && (
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
        )}

        {/* ── Security Tab ── */}
        {activeTab === "security" && (
          <div className="space-y-4">
            {/* Password */}
            <div className={cardCls}>
              <h2 className="mb-5 text-[15px] font-bold text-[#111]">Password</h2>
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

            {/* Two-Factor Authentication */}
            <div className={cardCls}>
              <h2 className="mb-5 text-[15px] font-bold text-[#111]">Two-Factor Authentication</h2>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-[14px] font-medium text-[#111]">Email verification code</div>
                    {twoFactorEnabled && (
                      <span className="text-[10px] font-semibold text-[#2F6B57] bg-[#EAF3EF] px-2 py-0.5 rounded-full">Enabled</span>
                    )}
                  </div>
                  <div className="text-[13px] text-[#888]">When you sign in, we&apos;ll send a 6-digit code to your email for added security.</div>
                </div>
                <Toggle checked={twoFactorEnabled} onChange={() => {
                  setTwoFactorEnabled(!twoFactorEnabled);
                  showToast(twoFactorEnabled ? "Two-factor authentication disabled." : "Two-factor authentication enabled.");
                }} />
              </div>
            </div>

            {/* Active Sessions */}
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
                          <span className="text-[10px] font-semibold text-[#2F6B57] bg-[#EAF3EF] px-2 py-0.5 rounded-full">Current</span>
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
                className="mt-4 text-[13px] font-medium text-[#999] hover:text-[#80020E] transition-colors"
                onClick={() => showToast("All other sessions signed out.")}
              >
                Sign out all other sessions
              </button>
            </div>
          </div>
        )}

        {/* Sign out — visible on every tab. The desktop sidebar already has its
            own log-out control, so this is shown only on mobile. */}
        <div className="md:hidden mt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Log out of Hostyo?")) signOut({ callbackUrl: "/login" });
            }}
            className="w-full flex items-center justify-center gap-2 h-[44px] rounded-xl border border-[#e2e2e2] text-[14px] font-semibold text-[#80020E] hover:bg-[#80020E]/[0.04] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log out
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
