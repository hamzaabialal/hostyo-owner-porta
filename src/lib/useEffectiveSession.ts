"use client";
/**
 * Wraps next-auth's useSession to respect impersonation.
 *
 * When an admin is impersonating another user, /api/me reports the *effective*
 * scope (isImpersonating + impersonated email). We use that to derive the
 * effective `isAdmin` flag for client-side gates.
 *
 * Why not modify next-auth's session itself? Because the JWT IS the admin's
 * real token — impersonation is a server-side cookie overlay only. Mutating
 * the JWT would lose the audit trail of who's really logged in.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface MePayload {
  ok: boolean;
  email: string;
  isAdmin: boolean;
  isImpersonating: boolean;
  realEmail: string | null;
}

export interface EffectiveSession {
  /** The acting role — `admin` or `owner`. False during impersonation even if the real user is admin. */
  isAdmin: boolean;
  /** Whether the current admin is impersonating someone. */
  isImpersonating: boolean;
  /** The currently-displayed user's email (impersonated user when impersonating). */
  effectiveEmail: string | null;
  /** The real authenticated admin's email (when impersonating). */
  realEmail: string | null;
  /** True until the first /api/me call has resolved. UI should treat unknown gates conservatively. */
  loading: boolean;
}

export function useEffectiveSession(): EffectiveSession {
  const { data: session, status } = useSession();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setMe(d);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  // Fall back to the session's claim while /api/me is loading. Once /api/me
  // returns, the effective state may demote isAdmin (admin impersonating an
  // owner). Gates that hide things on `isAdmin === false` are therefore safe
  // to show during the brief loading window: they'll just disappear if needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRole = (session?.user as any)?.role as string | undefined;
  const sessionIsAdmin = sessionRole === "admin";

  if (me) {
    return {
      isAdmin: me.isAdmin,
      isImpersonating: me.isImpersonating,
      effectiveEmail: me.email,
      realEmail: me.realEmail,
      loading: false,
    };
  }

  return {
    isAdmin: sessionIsAdmin,
    isImpersonating: false,
    effectiveEmail: session?.user?.email || null,
    realEmail: null,
    loading,
  };
}
