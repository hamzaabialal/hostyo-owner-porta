import { NextResponse } from "next/server";
import { sendEmail, generateCode, loginCodeEmailHtml, verificationEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

// In-memory code store (per serverless instance — works for short-lived codes)
const codeStore = new Map<string, { code: string; expires: number; type: string }>();

// Clean expired codes
function cleanExpired() {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expires < now) codeStore.delete(key);
  }
}

export async function POST(req: Request) {
  try {
    const { email, name, type } = await req.json();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    cleanExpired();

    // Rate limit: max 1 code per email per 60 seconds
    const existing = codeStore.get(email.toLowerCase());
    if (existing && existing.expires > Date.now() - (type === "login" ? 4 * 60 * 1000 : 9 * 60 * 1000)) {
      // Code was sent less than 1 minute ago
      return NextResponse.json({ ok: false, error: "Please wait before requesting another code" }, { status: 429 });
    }

    const code = generateCode();
    const expiresIn = type === "login" ? 5 * 60 * 1000 : 10 * 60 * 1000;

    codeStore.set(email.toLowerCase(), {
      code,
      expires: Date.now() + expiresIn,
      type: type || "verify",
    });

    // Also store globally for verification endpoint
    const globalForCodes = globalThis as unknown as { __verificationCodes?: Map<string, { code: string; expires: number; type: string }> };
    if (!globalForCodes.__verificationCodes) globalForCodes.__verificationCodes = new Map();
    globalForCodes.__verificationCodes.set(email.toLowerCase(), { code, expires: Date.now() + expiresIn, type: type || "verify" });

    const html = type === "login"
      ? loginCodeEmailHtml(code, name || email.split("@")[0])
      : verificationEmailHtml(code, name || email.split("@")[0]);

    const subject = type === "login" ? "Your Hostyo login code" : "Verify your Hostyo email";

    const sent = await sendEmail({ to: email, subject, html });

    if (!sent) {
      return NextResponse.json({ ok: false, error: "Failed to send email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json({ ok: false, error: "Failed to send code" }, { status: 500 });
  }
}
