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
 *
 * ## Caching
 *
 * AppShell mounts on every page (it's used at the page level, not a layout),
 * so without a cache `/api/me` would refetch on every navigation, briefly
 * flipping `isAdmin` from the JWT-claim default to the impersonated truth.
 * That makes admin-only sidebar items (Turnovers, Users, Support) flicker in
 * and out as the user navigates while impersonating.
 *
 * We cache the `/api/me` payload in sessionStorage so subsequent mounts read
 * the impersonation-aware truth synchronously and render correctly on the
 * first paint. The cache is cleared whenever impersonation is started or
 * stopped via the helpers exported below.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface MePayload {
  ok: boolean;
  email: string;
  name?: string;
  profilePicture?: string;
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
  /** The currently-displayed user's full name (Notion "Full Name"). Empty until /api/me resolves. */
  effectiveName: string;
  /** The currently-displayed user's profile picture URL. Empty until /api/me resolves. */
  effectivePicture: string;
  /** The real authenticated admin's email (when impersonating). */
  realEmail: string | null;
  /** True until the first /api/me call has resolved. UI should treat unknown gates conservatively. */
  loading: boolean;
}

const CACHE_KEY = "hostyo_me_cache_v1";
const CACHE_TTL_MS = 60_000;

let memCache: { data: MePayload; timestamp: number } | null = null;

function readCache(): MePayload | null {
  if (typeof window === "undefined") return null;
  if (memCache && Date.now() - memCache.timestamp < CACHE_TTL_MS) return memCache.data;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: MePayload; timestamp: number };
    if (!parsed?.data || typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp >= CACHE_TTL_MS) return null;
    memCache = parsed;
    return parsed.data;
  } catch { return null; }
}

function writeCache(data: MePayload) {
  if (typeof window === "undefined") return;
  const entry = { data, timestamp: Date.now() };
  memCache = entry;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* ignore */ }
}

/**
 * Drop the cached `/api/me` payload. Call this whenever impersonation is
 * started or stopped, so the next mount fetches fresh state instead of
 * using the previous user's scope.
 */
export function clearEffectiveSessionCache() {
  memCache = null;
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Prime the cache with a known scope so the next mount renders the correct
 * UI without a "loading" flash. Used right before a hard navigation triggered
 * by impersonation start/stop, where we already know what /api/me will say.
 *
 * `name` is optional: callers that have it (e.g. the start-impersonation flow
 * which receives the target's name in the API response) can include it for an
 * even smoother first paint. Otherwise it's left empty and the next /api/me
 * fetch fills it in.
 */
export function primeEffectiveSessionCache(payload: {
  email: string;
  name?: string;
  profilePicture?: string;
  isAdmin: boolean;
  isImpersonating: boolean;
  realEmail: string | null;
}) {
  writeCache({ ok: true, ...payload });
}

export function useEffectiveSession(): EffectiveSession {
  const { data: session, status } = useSession();
  // Hydrate state from the cache synchronously so the first paint already
  // reflects the impersonation-aware values when we have them.
  const [me, setMe] = useState<MePayload | null>(readCache);
  const [loading, setLoading] = useState(() => readCache() === null);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: MePayload) => {
        if (cancelled) return;
        if (d?.ok) {
          writeCache(d);
          // Avoid an unnecessary re-render if the payload is identical to the
          // value we hydrated from the cache.
          setMe((prev) => {
            if (
              prev &&
              prev.email === d.email &&
              prev.name === d.name &&
              prev.profilePicture === d.profilePicture &&
              prev.isAdmin === d.isAdmin &&
              prev.isImpersonating === d.isImpersonating &&
              prev.realEmail === d.realEmail
            ) {
              return prev;
            }
            return d;
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  // If we're authenticated and have NOTHING cached, the cautious thing is to
  // hide admin-only UI until /api/me resolves rather than show-then-hide. The
  // pre-cache flicker only happens on the very first page load per session
  // (sessionStorage persists across navigations within a tab), so this is
  // strictly a one-shot delay, not an ongoing UX cost.
  if (me) {
    return {
      isAdmin: me.isAdmin,
      isImpersonating: me.isImpersonating,
      effectiveEmail: me.email,
      effectiveName: me.name || "",
      effectivePicture: me.profilePicture || "",
      realEmail: me.realEmail,
      loading: false,
    };
  }

  return {
    // Conservative default: don't flash admin UI for an admin who is about to
    // be revealed as an impersonated owner. The window is < ~200ms and only
    // affects the very first load per browser tab.
    isAdmin: false,
    isImpersonating: false,
    effectiveEmail: session?.user?.email || null,
    effectiveName: session?.user?.name || "",
    // Don't surface session.user.image as the effective avatar. If the user
    // is actually impersonating, that JWT image belongs to the admin and
    // would briefly leak across to the impersonated identity. Empty string
    // forces UI components to render initials until /api/me resolves.
    effectivePicture: "",
    realEmail: null,
    loading,
  };
}
