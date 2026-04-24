import crypto from "crypto";

/**
 * Impersonation cookie support. An admin can choose to view the app as another
 * user; the server sets this signed cookie so subsequent API calls resolve
 * that user's scope instead of the admin's.
 *
 * Cookie format:  `<email>|<hmac-sha256-of-email>`
 * Signed with NEXTAUTH_SECRET so it cannot be forged client-side.
 */

export const IMPERSONATE_COOKIE = "hostyo-impersonate";
// Short-ish TTL so forgotten impersonation sessions auto-expire.
export const IMPERSONATE_MAX_AGE_SEC = 8 * 60 * 60; // 8 hours

function secret(): string {
  return process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";
}

export function signImpersonation(email: string): string {
  const payload = email.toLowerCase().trim();
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

export function verifyImpersonation(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const [payload, sig] = cookieValue.split("|");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  // Constant-time comparison to avoid timing attacks
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch { return null; }
  return payload;
}
