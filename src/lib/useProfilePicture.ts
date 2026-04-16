"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const CACHE_KEY = "hostyo_profile_picture";

/**
 * Hook that returns the current user's profile picture URL.
 * Falls back to the session image if the Notion-stored picture isn't set.
 * Caches the result in localStorage so it's instant on navigation.
 *
 * When the user updates their picture, dispatch a window event
 *   window.dispatchEvent(new CustomEvent("hostyo:profile-picture", { detail: newUrl }));
 * to update every component in the app immediately.
 */
export function useProfilePicture(): string {
  const { data: session } = useSession();
  const [picture, setPicture] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(CACHE_KEY) || "";
  });

  // Fetch from the profile API when the session loads
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    fetch(`/api/profile?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.profile) {
          const p = data.profile.profilePicture || "";
          setPicture(p);
          if (p) localStorage.setItem(CACHE_KEY, p);
          else localStorage.removeItem(CACHE_KEY);
        }
      })
      .catch(() => {});
  }, [session]);

  // Listen for cross-component updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setPicture(detail || "");
      if (detail) localStorage.setItem(CACHE_KEY, detail);
      else localStorage.removeItem(CACHE_KEY);
    };
    window.addEventListener("hostyo:profile-picture", handler);
    return () => window.removeEventListener("hostyo:profile-picture", handler);
  }, []);

  // Fall back to the NextAuth session image if no Notion picture
  return picture || session?.user?.image || "";
}
