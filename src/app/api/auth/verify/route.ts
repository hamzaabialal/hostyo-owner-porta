import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface StoredCode {
  code: string;
  expires: number;
  createdAt: number;
  type: string;
}

function getStore(): Map<string, StoredCode> {
  const g = globalThis as unknown as { __verificationCodes?: Map<string, StoredCode> };
  if (!g.__verificationCodes) g.__verificationCodes = new Map();
  return g.__verificationCodes;
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ ok: false, error: "Email and code are required" }, { status: 400 });
    }

    const key = email.toLowerCase();
    const store = getStore();
    const stored = store.get(key);

    if (!stored) {
      return NextResponse.json({ ok: false, error: "No verification code found. Please request a new one." }, { status: 400 });
    }

    // Strict expiry check — expired codes are deleted on read so they
    // can never be revived even if the user retries.
    if (stored.expires <= Date.now()) {
      store.delete(key);
      return NextResponse.json({ ok: false, error: "Code expired. Please request a new one." }, { status: 400 });
    }

    if (stored.code !== String(code).trim()) {
      return NextResponse.json({ ok: false, error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Code is valid — delete so it can't be replayed.
    store.delete(key);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 500 });
  }
}
