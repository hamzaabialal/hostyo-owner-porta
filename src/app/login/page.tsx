"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(error === "CredentialsSignin" ? "Invalid email or password" : "");

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setLoginError("");
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: true,
    });
    if (result?.error) {
      setLoginError("Invalid email or password");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
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
          <h1 className="text-[18px] font-semibold text-[#111] text-center mb-1">Welcome back</h1>
          <p className="text-[13px] text-[#888] text-center mb-6">Sign in to your owner portal</p>

          {loginError && (
            <div className="mb-4 p-3 bg-[#F6EDED] border border-[#E8D8D8] rounded-xl text-[12px] text-[#7A5252] font-medium text-center">
              {loginError}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
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

          {/* Email/Password */}
          <form onSubmit={handleCredentialLogin} className="space-y-3">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-[#888]">Password</label>
                <a href="mailto:support@hostyo.com?subject=Password%20Reset%20Request" className="text-[11px] text-[#80020E] font-medium hover:underline">Forgot password?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] bg-[#80020E] text-white rounded-xl text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </div>

        <p className="text-[13px] text-[#888] text-center mt-5">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-[#80020E] font-semibold hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center text-[#999]">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
