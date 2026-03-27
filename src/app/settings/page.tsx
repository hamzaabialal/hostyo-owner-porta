"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
/*  Toast component                                                    */
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
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-[#80020E]" : "bg-[#ddd]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[18px] w-[18px] translate-y-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ${
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-nav tabs                                                       */
/* ------------------------------------------------------------------ */
type TabKey = "finance" | "account";

const tabs: { key: TabKey; label: string }[] = [
  { key: "finance", label: "Finance" },
  { key: "account", label: "Account" },
];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  /* ---- tab ---- */
  const [activeTab, setActiveTab] = useState<TabKey>("finance");

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
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ---- Finance: Payout Method ---- */
  const [ibanRevealed, setIbanRevealed] = useState(false);
  const ibanMasked = "GB29 **** **** **** 1234";
  const ibanFull = "GB29 NWBK 6016 1331 9268 19";
  const [bicSwift, setBicSwift] = useState("NWBKGB2L");
  const [beneficiaryName, setBeneficiaryName] = useState("Alexandra Pemberton");

  /* ---- Finance: Legal / Invoice ---- */
  const [legalName, setLegalName] = useState("Alexandra Pemberton");
  const [businessName, setBusinessName] = useState("Pemberton Properties Ltd");
  const [vatNumber, setVatNumber] = useState("");

  /* ---- Account: Profile ---- */
  const [phone, setPhone] = useState("+44 7700 900123");

  /* ---- Account: Notifications ---- */
  const [notifs, setNotifs] = useState([
    { label: "New reservation notifications", on: true },
    { label: "Payout processed notifications", on: true },
    { label: "Expense submitted notifications", on: true },
    { label: "Monthly report ready", on: true },
    { label: "Marketing updates", on: false },
  ]);

  const toggleNotif = (idx: number) => {
    setNotifs((prev) =>
      prev.map((n, i) => (i === idx ? { ...n, on: !n.on } : n))
    );
  };

  /* ---- Account: Security ---- */
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const handleUpdatePassword = () => {
    if (!currentPass) {
      showToast("Please enter your current password.");
      return;
    }
    if (newPass.length < 6) {
      showToast("New password must be at least 6 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("Passwords do not match.");
      return;
    }
    setCurrentPass("");
    setNewPass("");
    setConfirmPass("");
    showToast("Password updated successfully.");
  };

  const sessions = [
    { device: "Chrome on macOS", lastActive: "Today" },
    { device: "Safari on iPhone", lastActive: "Yesterday" },
  ];

  /* ---- shared styles ---- */
  const cardCls = "rounded-xl border border-[#eaeaea] bg-white p-7";
  const labelCls = "mb-1.5 block text-[13px] font-medium text-[#555]";
  const inputCls =
    "w-full rounded-lg border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-[#111] outline-none transition-colors placeholder:text-[#999] focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08]";
  const inputDisabledCls =
    "w-full rounded-lg border border-[#eaeaea] bg-[#f8f8f8] px-3.5 py-2.5 text-sm text-[#999] outline-none cursor-not-allowed";
  const btnSaveCls =
    "mt-6 rounded-lg bg-[#80020E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6b010c]";
  const eyeBtnCls =
    "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 text-[#999] hover:text-[#555] bg-transparent border-none cursor-pointer";

  return (
    <AppShell title="Settings">
      <div className="flex gap-6 items-start">
        {/* ── Settings Sub-Nav ── */}
        <nav className="w-[200px] min-w-[200px] flex flex-col gap-0.5 rounded-xl border border-[#eaeaea] bg-white p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`w-full rounded-[7px] border-l-[3px] px-4 py-[11px] text-left text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "border-l-[#80020E] bg-[#fdf0f1] font-semibold text-[#80020E]"
                  : "border-l-transparent text-[#555] hover:bg-[#fdf0f1] hover:text-[#80020E]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Panels ── */}
        <div className="flex-1 min-w-0">
          {/* ════════════ FINANCE TAB ════════════ */}
          {activeTab === "finance" && (
            <div className="flex flex-col gap-6">
              {/* Payout Method */}
              <div className={cardCls}>
                <h2 className="mb-6 text-base font-bold text-[#111]">Payout Method</h2>

                <div className="mb-5">
                  <label className={labelCls}>IBAN</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={ibanRevealed ? ibanFull : ibanMasked}
                      className={`${inputCls} pr-11 cursor-default bg-white`}
                    />
                    <button
                      type="button"
                      className={eyeBtnCls}
                      onClick={() => setIbanRevealed((v) => !v)}
                      title="Show/hide IBAN"
                    >
                      {ibanRevealed ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                <div className="mb-5">
                  <label className={labelCls}>BIC / SWIFT</label>
                  <input
                    type="text"
                    value={bicSwift}
                    onChange={(e) => setBicSwift(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Beneficiary Name</label>
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <button
                  type="button"
                  className={btnSaveCls}
                  onClick={() => showToast("Payout method saved.")}
                >
                  Save
                </button>
              </div>

              {/* Legal / Invoice Details */}
              <div className={cardCls}>
                <h2 className="mb-6 text-base font-bold text-[#111]">Legal / Invoice Details</h2>

                <div className="mb-5">
                  <label className={labelCls}>Legal Display Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="mb-5">
                  <label className={labelCls}>Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>VAT Number</label>
                  <input
                    type="text"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="Enter if applicable"
                    className={inputCls}
                  />
                </div>

                <button
                  type="button"
                  className={btnSaveCls}
                  onClick={() => showToast("Invoice details saved.")}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* ════════════ ACCOUNT TAB ════════════ */}
          {activeTab === "account" && (
            <div className="flex flex-col gap-6">
              {/* Profile */}
              <div className={cardCls}>
                <h2 className="mb-6 text-base font-bold text-[#111]">Profile</h2>

                <div className="mb-5">
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value="alexandra@pemberton.co.uk"
                    disabled
                    className={inputDisabledCls}
                  />
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
                  className={btnSaveCls}
                  onClick={() => showToast("Profile saved.")}
                >
                  Save
                </button>
              </div>

              {/* Email Notifications */}
              <div className={cardCls}>
                <h2 className="mb-6 text-base font-bold text-[#111]">Email Notifications</h2>

                {notifs.map((n, idx) => (
                  <div
                    key={n.label}
                    className={`flex items-center justify-between py-3.5 ${
                      idx < notifs.length - 1 ? "border-b border-[#f0f0f0]" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-[#111]">{n.label}</span>
                    <Toggle checked={n.on} onChange={() => toggleNotif(idx)} />
                  </div>
                ))}
              </div>

              {/* Security */}
              <div className={cardCls}>
                <h2 className="mb-6 text-base font-bold text-[#111]">Security</h2>

                <h3 className="mb-5 text-[15px] font-semibold text-[#111]">Change Password</h3>

                <div className="mb-5">
                  <label className={labelCls}>Current password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Enter current password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      className={eyeBtnCls}
                      onClick={() => setShowCurrentPass((v) => !v)}
                    >
                      {showCurrentPass ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                <div className="mb-5">
                  <label className={labelCls}>New password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Enter new password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      className={eyeBtnCls}
                      onClick={() => setShowNewPass((v) => !v)}
                    >
                      {showNewPass ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Confirm new password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      className={eyeBtnCls}
                      onClick={() => setShowConfirmPass((v) => !v)}
                    >
                      {showConfirmPass ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className={btnSaveCls}
                  onClick={handleUpdatePassword}
                >
                  Update password
                </button>

                <hr className="my-6 border-t border-[#eaeaea]" />

                <h3 className="mb-5 text-[15px] font-semibold text-[#111]">Active Sessions</h3>

                {sessions.map((s, idx) => (
                  <div
                    key={s.device}
                    className={`flex items-center justify-between py-3.5 ${
                      idx < sessions.length - 1 ? "border-b border-[#f0f0f0]" : ""
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-[#111]">{s.device}</div>
                      <div className="mt-0.5 text-[13px] text-[#999]">Last active: {s.lastActive}</div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="mt-5 rounded-lg border border-[#80020E] bg-white px-5 py-2.5 text-sm font-semibold text-[#80020E] transition-colors hover:bg-[#fdf0f1]"
                  onClick={() => showToast("All other sessions signed out.")}
                >
                  Sign out all other sessions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} />
    </AppShell>
  );
}
