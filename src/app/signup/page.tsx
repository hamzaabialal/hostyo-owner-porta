"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    setError("");

    try {
      // Register via API
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      await signIn("credentials", { email, password, callbackUrl: "/dashboard", redirect: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hostyo-logo.png" alt="Hostyo" className="w-10 h-10 rounded-xl object-contain" />
          <span className="text-[20px] font-bold text-[#111]">Hostyo</span>
        </div>

        <div className="bg-white border border-[#eaeaea] rounded-2xl p-8 shadow-sm">
          <h1 className="text-[18px] font-semibold text-[#111] text-center mb-1">Create your account</h1>
          <p className="text-[13px] text-[#888] text-center mb-6">Get started with your owner portal</p>

          {error && (
            <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium text-center">
              {error}
            </div>
          )}

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignup}
            className="w-full h-[44px] flex items-center justify-center gap-2.5 border border-[#e2e2e2] rounded-xl text-[13px] font-medium text-[#333] hover:bg-[#f5f5f5] transition-colors mb-4"
          >
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

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm your password"
                required
                className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-[13px] text-[#888] text-center mt-5">
          Already have an account?{" "}
          <a href="/login" className="text-[#80020E] font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
