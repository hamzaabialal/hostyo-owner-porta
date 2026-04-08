import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ ok: false, error: "Email and code are required" }, { status: 400 });
    }

    const globalForCodes = globalThis as unknown as { __verificationCodes?: Map<string, { code: string; expires: number; type: string }> };
    const stored = globalForCodes.__verificationCodes?.get(email.toLowerCase());

    if (!stored) {
      return NextResponse.json({ ok: false, error: "No verification code found. Please request a new one." }, { status: 400 });
    }

    if (stored.expires < Date.now()) {
      globalForCodes.__verificationCodes?.delete(email.toLowerCase());
      return NextResponse.json({ ok: false, error: "Code expired. Please request a new one." }, { status: 400 });
    }

    if (stored.code !== code.trim()) {
      return NextResponse.json({ ok: false, error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Code is valid — delete it
    globalForCodes.__verificationCodes?.delete(email.toLowerCase());

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 500 });
  }
}
