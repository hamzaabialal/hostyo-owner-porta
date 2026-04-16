"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // codeSent state removed — step state handles this

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    setError("");

    try {
      // Send verification code
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name.trim(), type: "verify" }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Failed to send verification code");
        setLoading(false);
        return;
      }

      setStep("verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) { setError("Please enter the verification code"); return; }

    setLoading(true);
    setError("");

    try {
      // Verify code
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verifyCode.trim() }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.ok) {
        setError(verifyData.error || "Invalid code");
        setLoading(false);
        return;
      }

      // Register
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      const regData = await regRes.json();

      if (!regData.ok) {
        setError(regData.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Redirect to pending approval page
      window.location.href = "/pending-approval";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name.trim(), type: "verify" }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || "Failed to resend");
      else setError("");
    } catch { setError("Failed to resend code"); }
  };

  const handleGoogleSignup = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const inputCls = "w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white";

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/property-icons/ios_1024.png" alt="Hostyo" className="w-10 h-10 rounded-xl object-contain" />
          <span className="text-[20px] font-bold text-[#111]">Hostyo</span>
        </div>

        <div className="bg-white border border-[#eaeaea] rounded-2xl p-8 shadow-sm">
          {step === "form" ? (
            <>
              <h1 className="text-[18px] font-semibold text-[#111] text-center mb-1">Create your account</h1>
              <p className="text-[13px] text-[#888] text-center mb-6">Get started with your owner portal</p>

              {error && (
                <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium text-center">{error}</div>
              )}

              {/* Google Sign Up */}
              <button onClick={handleGoogleSignup}
                className="w-full h-[44px] flex items-center justify-center gap-2.5 border border-[#e2e2e2] rounded-xl text-[13px] font-medium text-[#333] hover:bg-[#f5f5f5] transition-colors mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[#eaeaea]" />
                <span className="text-[11px] text-[#bbb] font-medium">or</span>
                <div className="flex-1 h-px bg-[#eaeaea]" />
              </div>

              <form onSubmit={handleSendCode} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Confirm Password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm your password" required className={inputCls} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-[44px] bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
                  {loading ? "Sending verification..." : "Continue"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-[#80020E]/10 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#80020E" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>
                </div>
                <h1 className="text-[18px] font-semibold text-[#111] mb-1">Check your email</h1>
                <p className="text-[13px] text-[#888]">We sent a 6-digit code to <strong className="text-[#111]">{email}</strong></p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium text-center">{error}</div>
              )}

              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Verification Code</label>
                  <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus
                    className="w-full h-[48px] px-4 border border-[#e2e2e2] rounded-xl text-[20px] font-bold text-center text-[#111] tracking-[8px] placeholder:text-[#ddd] placeholder:tracking-[8px] outline-none focus:border-[#80020E] transition-colors bg-white" />
                </div>
                <button type="submit" disabled={loading || verifyCode.length !== 6}
                  className="w-full h-[44px] bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>
              </form>

              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { setStep("form"); setError(""); }} className="text-[12px] text-[#888] hover:text-[#555]">← Back</button>
                <button onClick={handleResendCode} className="text-[12px] text-[#80020E] font-medium hover:underline">Resend code</button>
              </div>
            </>
          )}
        </div>

        <p className="text-[13px] text-[#888] text-center mt-5">
          Already have an account?{" "}
          <a href="/login" className="text-[#80020E] font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
