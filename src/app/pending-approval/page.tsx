"use client";

import { signOut } from "next-auth/react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hostyo-logo.png" alt="Hostyo" className="w-10 h-10 rounded-xl object-contain" />
          <span className="text-[20px] font-bold text-[#111]">Hostyo</span>
        </div>

        <div className="bg-white border border-[#eaeaea] rounded-2xl p-8 shadow-sm">
          {/* Clock icon */}
          <div className="w-16 h-16 rounded-full bg-[#F6F1E6] flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>

          <h1 className="text-[20px] font-bold text-[#111] mb-2">Account Pending Approval</h1>
          <p className="text-[14px] text-[#666] leading-relaxed mb-6">
            Your account has been created successfully and is now awaiting admin approval. You&apos;ll be able to access the portal once an administrator approves your account.
          </p>

          <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-4 mb-6">
            <div className="text-[12px] text-[#888] mb-1">Need help?</div>
            <a href="mailto:support@hostyo.com" className="text-[13px] text-[#80020E] font-medium hover:underline">support@hostyo.com</a>
          </div>

          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full h-[44px] border border-[#e2e2e2] rounded-xl text-[13px] font-medium text-[#555] hover:bg-[#f5f5f5] transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
