"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ─── SVG Icons ─── */
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const EyeOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* ─── Types ─── */
type View = "signin" | "magic" | "create" | "forgot";

interface Toast {
  title: string;
  message: string;
}

/* ─── Password Input ─── */
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full py-[11px] pl-[14px] pr-11 text-[15px] border border-gray-300 rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08]"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label="Toggle password visibility"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-500 p-0.5 flex items-center justify-center transition-colors"
      >
        {visible ? <EyeClosed /> : <EyeOpen />}
      </button>
    </div>
  );
}

/* ─── Toast Component ─── */
function ToastNotification({ toast, onDone }: { toast: Toast | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    // Small delay to trigger CSS transition
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 350);
    }, 4000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [toast, onDone]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-8 right-8 bg-[#1a1a1a] text-white py-4 px-[22px] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] z-[9999] max-w-[340px] pointer-events-none transition-all duration-[350ms] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div className="text-sm font-semibold mb-0.5 text-white">{toast.title}</div>
      <div className="text-[13px] text-[#a1a1aa]">{toast.message}</div>
    </div>
  );
}

/* ─── Inner Login Content (uses useSearchParams) ─── */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>("signin");
  const [toast, setToast] = useState<Toast | null>(null);

  // Sign In state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siErrors, setSiErrors] = useState<{ email?: boolean; password?: boolean }>({});

  // Magic Link state
  const [mlEmail, setMlEmail] = useState("");
  const [mlError, setMlError] = useState(false);

  // Create Account state
  const [caName, setCaName] = useState("");
  const [caEmail, setCaEmail] = useState("");
  const [caPassword, setCaPassword] = useState("");
  const [caErrors, setCaErrors] = useState<{ name?: boolean; email?: boolean; password?: boolean }>({});

  // Forgot Password state
  const [fpEmail, setFpEmail] = useState("");
  const [fpError, setFpError] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const clearToast = useCallback(() => setToast(null), []);

  const showToast = (title: string, message: string) => {
    setToast({ title, message });
  };

  // Signed-out detection
  useEffect(() => {
    if (searchParams.get("signed_out") === "1") {
      showToast("Signed out", "You have been signed out.");
    }
  }, [searchParams]);

  const switchView = (v: View) => {
    setView(v);
    setSiErrors({});
    setMlError(false);
    setCaErrors({});
    setFpError(false);
  };

  const handleSignIn = () => {
    const errors: { email?: boolean; password?: boolean } = {};
    if (!isValidEmail(siEmail)) errors.email = true;
    if (!siPassword) errors.password = true;
    setSiErrors(errors);
    if (Object.keys(errors).length === 0) {
      router.push("/dashboard");
    }
  };

  const handleMagicLink = () => {
    if (!isValidEmail(mlEmail)) {
      setMlError(true);
      return;
    }
    setMlError(false);
    showToast("Magic link sent", "Check your inbox");
  };

  const handleCreateAccount = () => {
    const errors: { name?: boolean; email?: boolean; password?: boolean } = {};
    if (!caName.trim()) errors.name = true;
    if (!isValidEmail(caEmail)) errors.email = true;
    if (caPassword.length < 6) errors.password = true;
    setCaErrors(errors);
    if (Object.keys(errors).length === 0) {
      router.push("/dashboard");
    }
  };

  const handleForgotPassword = () => {
    if (!isValidEmail(fpEmail)) {
      setFpError(true);
      return;
    }
    setFpError(false);
    showToast("Reset link sent", "Check your inbox");
  };

  // Enter key support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      switch (view) {
        case "signin": handleSignIn(); break;
        case "magic": handleMagicLink(); break;
        case "create": handleCreateAccount(); break;
        case "forgot": handleForgotPassword(); break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, siEmail, siPassword, mlEmail, caName, caEmail, caPassword, fpEmail]);

  /* ─── Back Link ─── */
  const BackLink = () => (
    <button
      onClick={() => switchView("signin")}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a1a1a] mb-6 cursor-pointer bg-transparent border-none p-0 font-[inherit] transition-colors"
    >
      <ChevronLeft />
      Back to sign in
    </button>
  );

  return (
    <div className="flex min-h-screen" style={{ colorScheme: "light only" }}>
      {/* Left Panel */}
      <div className="w-1/2 bg-[#f3ebe5] flex flex-col justify-center px-16 py-16 relative overflow-hidden max-lg:w-full max-lg:min-h-0 max-lg:px-8 max-lg:py-12">
        {/* Decorative circles */}
        <div className="absolute -top-[120px] -right-[120px] w-[480px] h-[480px] rounded-full bg-white/[0.35] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-white/25 pointer-events-none" />

        <div className="relative z-10 max-w-[440px]">
          {/* Logo */}
          <div className="w-[52px] h-[52px] bg-[#80020E] rounded-xl flex items-center justify-center mb-10">
            <span className="text-white text-2xl font-bold leading-none">P</span>
          </div>

          <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-[1.25] mb-4 tracking-[-0.5px]">
            Your properties, beautifully managed.
          </h1>
          <p className="text-base text-[#5c5550] leading-[1.65] max-w-[380px]">
            Track performance, manage reservations, and stay on top of your portfolio — all in one calm, clear space.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-1/2 bg-white flex items-center justify-center px-10 py-12 min-h-screen max-lg:w-full max-lg:min-h-0 max-lg:px-6 max-lg:py-10">
        <div className="w-full max-w-[380px]">

          {/* ── Sign In View ── */}
          {view === "signin" && (
            <>
              <h2 className="text-[26px] font-bold text-[#1a1a1a] mb-1.5 tracking-[-0.3px]">Welcome back</h2>
              <p className="text-[15px] text-gray-500 mb-8 leading-relaxed">Sign in to your owner portal.</p>

              <div className="mb-5">
                <label htmlFor="siEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="siEmail"
                  type="email"
                  value={siEmail}
                  onChange={(e) => { setSiEmail(e.target.value); setSiErrors((p) => ({ ...p, email: false })); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full py-[11px] px-[14px] text-[15px] border rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] ${siErrors.email ? "border-red-500" : "border-gray-300"}`}
                />
                {siErrors.email && <p className="text-[13px] text-red-500 mt-1.5">Please enter a valid email address.</p>}
              </div>

              <div className="mb-5">
                <label htmlFor="siPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <PasswordInput
                  id="siPassword"
                  value={siPassword}
                  onChange={(v) => { setSiPassword(v); setSiErrors((p) => ({ ...p, password: false })); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                {siErrors.password && <p className="text-[13px] text-red-500 mt-1.5">Please enter your password.</p>}
              </div>

              <button
                onClick={handleSignIn}
                className="w-full py-3 px-5 bg-[#80020E] hover:bg-[#6b010c] text-white border-none rounded-[10px] text-[15px] font-semibold cursor-pointer transition-colors inline-flex items-center justify-center gap-2 mt-1"
              >
                Sign in
                <ArrowRight />
              </button>

              <button
                onClick={() => switchView("forgot")}
                className="block w-full text-center text-sm text-gray-500 hover:text-[#1a1a1a] mt-4 cursor-pointer bg-transparent border-none p-0 font-[inherit] transition-colors"
              >
                Forgot password?
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[13px] text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={() => switchView("magic")}
                className="w-full py-3 px-5 bg-white hover:bg-gray-50 text-[#1a1a1a] border border-gray-300 hover:border-gray-400 rounded-[10px] text-[15px] font-medium cursor-pointer transition-all inline-flex items-center justify-center gap-2"
              >
                <MailIcon />
                Sign in with magic link
              </button>

              <p className="text-center text-sm text-gray-500 mt-7">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => switchView("create")}
                  className="text-[#80020E] hover:text-[#6b010c] font-medium cursor-pointer bg-transparent border-none p-0 font-[inherit] transition-colors"
                >
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ── Magic Link View ── */}
          {view === "magic" && (
            <>
              <BackLink />
              <h2 className="text-[26px] font-bold text-[#1a1a1a] mb-1.5 tracking-[-0.3px]">Magic link</h2>
              <p className="text-[15px] text-gray-500 mb-8 leading-relaxed">We&apos;ll send a sign-in link to your email. No password needed.</p>

              <div className="mb-5">
                <label htmlFor="mlEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="mlEmail"
                  type="email"
                  value={mlEmail}
                  onChange={(e) => { setMlEmail(e.target.value); setMlError(false); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full py-[11px] px-[14px] text-[15px] border rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] ${mlError ? "border-red-500" : "border-gray-300"}`}
                />
                {mlError && <p className="text-[13px] text-red-500 mt-1.5">Please enter a valid email address.</p>}
              </div>

              <button
                onClick={handleMagicLink}
                className="w-full py-3 px-5 bg-[#80020E] hover:bg-[#6b010c] text-white border-none rounded-[10px] text-[15px] font-semibold cursor-pointer transition-colors inline-flex items-center justify-center gap-2 mt-1"
              >
                <MailIcon />
                Send magic link
              </button>
            </>
          )}

          {/* ── Create Account View ── */}
          {view === "create" && (
            <>
              <BackLink />
              <h2 className="text-[26px] font-bold text-[#1a1a1a] mb-1.5 tracking-[-0.3px]">Create your account</h2>
              <p className="text-[15px] text-gray-500 mb-8 leading-relaxed">Get started with the Owner Portal.</p>

              <div className="mb-5">
                <label htmlFor="caName" className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <input
                  id="caName"
                  type="text"
                  value={caName}
                  onChange={(e) => { setCaName(e.target.value); setCaErrors((p) => ({ ...p, name: false })); }}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  className={`w-full py-[11px] px-[14px] text-[15px] border rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] ${caErrors.name ? "border-red-500" : "border-gray-300"}`}
                />
                {caErrors.name && <p className="text-[13px] text-red-500 mt-1.5">Please enter your name.</p>}
              </div>

              <div className="mb-5">
                <label htmlFor="caEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="caEmail"
                  type="email"
                  value={caEmail}
                  onChange={(e) => { setCaEmail(e.target.value); setCaErrors((p) => ({ ...p, email: false })); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full py-[11px] px-[14px] text-[15px] border rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] ${caErrors.email ? "border-red-500" : "border-gray-300"}`}
                />
                {caErrors.email && <p className="text-[13px] text-red-500 mt-1.5">Please enter a valid email address.</p>}
              </div>

              <div className="mb-5">
                <label htmlFor="caPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <PasswordInput
                  id="caPassword"
                  value={caPassword}
                  onChange={(v) => { setCaPassword(v); setCaErrors((p) => ({ ...p, password: false })); }}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <p className="text-[13px] text-gray-400 mt-1.5">Minimum 6 characters</p>
                {caErrors.password && <p className="text-[13px] text-red-500 mt-1">Password must be at least 6 characters.</p>}
              </div>

              <button
                onClick={handleCreateAccount}
                className="w-full py-3 px-5 bg-[#80020E] hover:bg-[#6b010c] text-white border-none rounded-[10px] text-[15px] font-semibold cursor-pointer transition-colors inline-flex items-center justify-center gap-2 mt-1"
              >
                Create account
              </button>

              <p className="text-center text-sm text-gray-500 mt-7">
                Already have an account?{" "}
                <button
                  onClick={() => switchView("signin")}
                  className="text-[#80020E] hover:text-[#6b010c] font-medium cursor-pointer bg-transparent border-none p-0 font-[inherit] transition-colors"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ── Forgot Password View ── */}
          {view === "forgot" && (
            <>
              <BackLink />
              <h2 className="text-[26px] font-bold text-[#1a1a1a] mb-1.5 tracking-[-0.3px]">Reset password</h2>
              <p className="text-[15px] text-gray-500 mb-8 leading-relaxed">Enter your email and we&apos;ll send a reset link.</p>

              <div className="mb-5">
                <label htmlFor="fpEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="fpEmail"
                  type="email"
                  value={fpEmail}
                  onChange={(e) => { setFpEmail(e.target.value); setFpError(false); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full py-[11px] px-[14px] text-[15px] border rounded-[10px] outline-none transition-all bg-white text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#80020E] focus:ring-[3px] focus:ring-[#80020E]/[0.08] ${fpError ? "border-red-500" : "border-gray-300"}`}
                />
                {fpError && <p className="text-[13px] text-red-500 mt-1.5">Please enter a valid email address.</p>}
              </div>

              <button
                onClick={handleForgotPassword}
                className="w-full py-3 px-5 bg-[#80020E] hover:bg-[#6b010c] text-white border-none rounded-[10px] text-[15px] font-semibold cursor-pointer transition-colors inline-flex items-center justify-center gap-2 mt-1"
              >
                Send reset link
              </button>
            </>
          )}

        </div>
      </div>

      {/* Toast */}
      <ToastNotification toast={toast} onDone={clearToast} />
    </div>
  );
}

/* ─── Responsive wrapper for lg breakpoint ─── */
/* Tailwind max-lg: maps to @media (max-width: 1023px), matching the ~900px intent from the Flask template */

/* ─── Main Page with Suspense boundary ─── */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="w-6 h-6 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
