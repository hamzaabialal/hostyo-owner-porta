"use client";
import { useState, useEffect } from "react";
import { useEffectiveSession } from "@/lib/useEffectiveSession";

/**
 * Returns the *effective* user's profile picture URL — i.e. the impersonated
 * user's picture when an admin is impersonating, otherwise the signed-in
 * admin's. Backed by a per-email localStorage cache so the avatar paints
 * instantly on navigation, and seeded from the `/api/me` payload (which
 * already knows the effective profile picture) before falling back to a
 * `/api/profile` fetch.
 *
 * When the user updates their picture, dispatch:
 *   window.dispatchEvent(new CustomEvent("hostyo:profile-picture", { detail: newUrl }));
 * to update every component in the app immediately.
 */
const CACHE_PREFIX = "hostyo_profile_picture:";

function cacheKey(email: string): string {
  return `${CACHE_PREFIX}${email.toLowerCase()}`;
}

export function useProfilePicture(): string {
  const { effectiveEmail, effectivePicture } = useEffectiveSession();
  const [picture, setPicture] = useState<string>(() => {
    if (typeof window === "undefined" || !effectiveEmail) return "";
    return localStorage.getItem(cacheKey(effectiveEmail)) || "";
  });

  // Whenever the effective user changes (sign-in, impersonation start/stop),
  // re-read the per-user cache so we don't keep showing the previous user's
  // avatar.
  useEffect(() => {
    if (!effectiveEmail) { setPicture(""); return; }
    if (typeof window === "undefined") return;
    setPicture(localStorage.getItem(cacheKey(effectiveEmail)) || "");
  }, [effectiveEmail]);

  // /api/me already returns the effective user's picture — use it directly
  // and persist to the per-email cache. Fall back to /api/profile only if
  // /api/me didn't include a picture (older server build).
  useEffect(() => {
    if (!effectiveEmail) return;
    if (effectivePicture !== undefined && effectivePicture !== null) {
      setPicture(effectivePicture);
      try {
        if (effectivePicture) localStorage.setItem(cacheKey(effectiveEmail), effectivePicture);
        else localStorage.removeItem(cacheKey(effectiveEmail));
      } catch { /* ignore */ }
      // /api/me supplied a value — no need for the /api/profile fallback.
      if (effectivePicture) return;
    }

    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.profile) {
          const p = data.profile.profilePicture || "";
          setPicture(p);
          try {
            if (p) localStorage.setItem(cacheKey(effectiveEmail), p);
            else localStorage.removeItem(cacheKey(effectiveEmail));
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, [effectiveEmail, effectivePicture]);

  // Listen for cross-component updates (e.g. user just saved a new avatar).
  useEffect(() => {
    if (!effectiveEmail) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setPicture(detail || "");
      try {
        if (detail) localStorage.setItem(cacheKey(effectiveEmail), detail);
        else localStorage.removeItem(cacheKey(effectiveEmail));
      } catch { /* ignore */ }
    };
    window.addEventListener("hostyo:profile-picture", handler);
    return () => window.removeEventListener("hostyo:profile-picture", handler);
  }, [effectiveEmail]);

  return picture;
}
