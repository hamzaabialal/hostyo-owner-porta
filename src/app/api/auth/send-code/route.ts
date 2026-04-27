import { NextResponse } from "next/server";
import { sendEmail, generateCode, loginCodeEmailHtml, verificationEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

// 6-digit codes are short-lived: a fresh code expires 60s after issue. The
// resend cooldown matches so the user can request a new code as soon as the
// old one is no longer usable. Anything longer was abusive: an old code could
// still be entered after the user had clearly moved on.
const CODE_TTL_MS = 60 * 1000;
// Server-side resend cooldown: refuse a brand-new code if the previous one
// was issued less than this many ms ago. Mirrors the client-side countdown
// in /login and /signup so a malicious or buggy client can't bypass it.
const RESEND_COOLDOWN_MS = 60 * 1000;

interface StoredCode {
  code: string;
  expires: number;
  /** When this code was issued — used for the resend cooldown. */
  createdAt: number;
  type: string;
}

// Consolidated to a single globalThis map so /api/auth/send-code and
// /api/auth/verify always look at the same state within a warm serverless
// instance. (The previous code kept two parallel maps which could drift.)
function getStore(): Map<string, StoredCode> {
  const g = globalThis as unknown as { __verificationCodes?: Map<string, StoredCode> };
  if (!g.__verificationCodes) g.__verificationCodes = new Map();
  return g.__verificationCodes;
}

function cleanExpired() {
  const store = getStore();
  const now = Date.now();
  store.forEach((val, key) => {
    if (val.expires < now) store.delete(key);
  });
}

export async function POST(req: Request) {
  try {
    const { email, name, type } = await req.json();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    const key = email.toLowerCase();
    const store = getStore();
    cleanExpired();

    // Resend cooldown: refuse if the previous code is younger than the cooldown.
    const existing = store.get(key);
    if (existing && Date.now() - existing.createdAt < RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.createdAt)) / 1000);
      return NextResponse.json(
        { ok: false, error: `Please wait ${retryAfterSec}s before requesting another code` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const code = generateCode();
    const now = Date.now();
    store.set(key, {
      code,
      expires: now + CODE_TTL_MS,
      createdAt: now,
      type: type || "verify",
    });

    const html = type === "login"
      ? loginCodeEmailHtml(code, name || email.split("@")[0])
      : verificationEmailHtml(code, name || email.split("@")[0]);

    const subject = type === "login" ? "Your Hostyo login code" : "Verify your Hostyo email";

    const sent = await sendEmail({ to: email, subject, html });

    if (!sent) {
      // Roll back the code so a failed delivery doesn't lock the user out
      // of resending for the cooldown window.
      store.delete(key);
      return NextResponse.json({ ok: false, error: "Failed to send email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json({ ok: false, error: "Failed to send code" }, { status: 500 });
  }
}
