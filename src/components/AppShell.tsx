"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import { useData } from "@/lib/DataContext";
import { addNotification, diffAndMarkSeen, pruneObsoleteNotifications, setNotificationOwner } from "@/lib/notifications";
import { fetchTickets } from "@/lib/tickets";
import { primeEffectiveSessionCache, useEffectiveSession } from "@/lib/useEffectiveSession";

const PREFETCH_URLS = [
  ["properties", "/api/properties"],
  ["reservations", "/api/reservations"],
  ["expenses", "/api/expenses"],
  ["payouts", "/api/payouts"],
  ["today", "/api/today"],
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function stableResId(r: any): string {
  return String(r.notionId || r.ref || `${r.guest}-${r.checkin}-${r.property}`);
}
function stableExpId(e: any): string {
  return String(e.id || e.notionId || `${e.date || ""}-${e.category || ""}-${e.amount || 0}-${e.property || ""}`);
}

/**
 * Emits notifications only for events the current user hasn't already seen.
 * The first run for a (user, category) pair is silent — we just record what's
 * there so that pre-existing data doesn't flood the feed when someone signs
 * in for the first time. Subsequent runs notify on real new events.
 *
 * Categories tracked here:
 *   - reservations_new      → "New reservation"
 *   - reservations_cancelled → "Reservation cancelled"
 *   - payouts_paid          → "Payout Sent"
 *   - expenses_new          → "Expense submitted"
 *
 * "New report" comes from documents.ts (per-property document polling).
 * "New message" comes from the ticket polling effect below.
 */
function seedNotifications(reservations: any[], expenses: any[]) {
  const byId = new Map<string, any>();
  for (const r of reservations) byId.set(stableResId(r), r);

  const cancelledIds = reservations.filter((r) => r.status === "Cancelled").map(stableResId);
  const paidIds = reservations.filter((r) => r.payoutStatus === "Paid").map(stableResId);
  const allResIds = reservations.map(stableResId);
  const allExpIds = expenses.map(stableExpId);

  const cancelledDiff = diffAndMarkSeen("reservations_cancelled", cancelledIds);
  const paidDiff = diffAndMarkSeen("payouts_paid", paidIds);
  const newResDiff = diffAndMarkSeen("reservations_new", allResIds);
  const newExpDiff = diffAndMarkSeen("expenses_new", allExpIds);

  for (const id of cancelledDiff.newIds) {
    const r = byId.get(id);
    if (!r) continue;
    addNotification({
      type: "reservation",
      title: "Reservation cancelled",
      description: `${r.guest} at ${r.property} was cancelled.`,
      fingerprint: `res:${id}:cancelled`,
    });
  }

  for (const id of newResDiff.newIds) {
    const r = byId.get(id);
    if (!r || r.status === "Cancelled") continue; // cancellation already covered
    addNotification({
      type: "reservation",
      title: "New reservation",
      description: `${r.guest} at ${r.property}${r.checkin ? ` from ${r.checkin}` : ""}.`,
      fingerprint: `res:${id}:new`,
    });
  }

  for (const id of paidDiff.newIds) {
    const r = byId.get(id);
    if (!r) continue;
    addNotification({
      type: "payout",
      title: "Payout Sent",
      description: `€${(r.ownerPayout || 0).toFixed(2)} paid for ${r.guest} at ${r.property}.`,
      fingerprint: `pay:${id}:paid`,
    });
  }

  const expById = new Map<string, any>();
  for (const e of expenses) expById.set(stableExpId(e), e);
  for (const id of newExpDiff.newIds) {
    const e = expById.get(id);
    if (!e) continue;
    addNotification({
      type: "expense",
      title: "Expense submitted",
      description: `${e.category || "Expense"} — €${(e.amount || 0).toFixed(2)} at ${e.property || "a property"}.`,
      fingerprint: `exp:${id}`,
    });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Polls /api/tickets and raises a "New message" notification whenever an
 * admin reply appears that this user hasn't been told about yet. First run is
 * silent (so old admin replies don't reappear after a re-login).
 */
async function pollTicketReplies() {
  try {
    const tickets = await fetchTickets();
    const adminCommentIds: string[] = [];
    const lookup = new Map<string, { ticketSubject: string; message: string }>();
    for (const t of tickets) {
      for (const c of t.comments || []) {
        if (c.author !== "Admin") continue;
        const id = `${t.id}:${c.id}`;
        adminCommentIds.push(id);
        lookup.set(id, { ticketSubject: t.subject, message: c.message });
      }
    }
    const diff = diffAndMarkSeen("tickets_admin_replies", adminCommentIds);
    for (const id of diff.newIds) {
      const meta = lookup.get(id);
      if (!meta) continue;
      const preview = meta.message.length > 80 ? meta.message.slice(0, 80) + "…" : meta.message;
      addNotification({
        type: "message",
        title: "New message",
        description: `Reply on "${meta.ticketSubject}": ${preview || "Open the ticket to read it."}`,
        fingerprint: `msg:${id}`,
      });
    }
  } catch { /* network blip — try again next tick */ }
}

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { fetchData, invalidate } = useData();
  const { effectiveEmail } = useEffectiveSession();
  const seededFor = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hostyo_sidebar_collapsed") === "true";
    }
    return false;
  });

  // Listen for sidebar collapse toggle events
  useEffect(() => {
    const handler = (e: Event) => setSidebarCollapsed((e as CustomEvent).detail);
    window.addEventListener("hostyo:sidebar", handler);
    return () => window.removeEventListener("hostyo:sidebar", handler);
  }, []);

  // Prefetch all data in background on mount
  useEffect(() => {
    PREFETCH_URLS.forEach(([key, url]) => {
      fetchData(key, url).catch(() => {});
    });

    // Auto-sync balances + deficit adjustments in the background.
    // Throttled: only runs once per 10-minute window per browser session.
    const SYNC_KEY = "hostyo_last_auto_sync";
    const lastSync = Number(sessionStorage.getItem(SYNC_KEY) || "0");
    const TEN_MINUTES = 10 * 60 * 1000;
    if (Date.now() - lastSync > TEN_MINUTES) {
      sessionStorage.setItem(SYNC_KEY, String(Date.now()));
      fetch("/api/properties/sync-balances", { method: "POST" }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the effective user is known, route notifications into their bucket
  // and (re-)seed from scoped API data. Re-runs when impersonation toggles or
  // a different user signs in on this browser.
  useEffect(() => {
    if (!effectiveEmail) return;
    const ownerChanged = setNotificationOwner(effectiveEmail);
    // Migrate any pre-existing notifications from older app versions
    // (rename "Payout completed" → "Payout Sent", drop dropped types).
    pruneObsoleteNotifications();
    if (ownerChanged) {
      // Drop cached responses captured under the previous user's scope so the
      // fresh fetch returns data the new effective user is allowed to see.
      invalidate("reservations");
      invalidate("expenses");
      invalidate("payouts");
      invalidate("properties");
      invalidate("today");
    }
    if (seededFor.current === effectiveEmail) return;
    seededFor.current = effectiveEmail;
    Promise.all([
      fetchData("reservations", "/api/reservations"),
      fetchData("expenses", "/api/expenses"),
    ]).then(([resResult, expResult]: unknown[]) => {
      const rr = resResult as { data?: unknown[] };
      const er = expResult as { data?: unknown[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seedNotifications((rr.data as any[]) || [], (er.data as any[]) || []);
    }).catch(() => {});

    // Poll tickets for new admin replies. The first run is silent (handled
    // inside pollTicketReplies via diffAndMarkSeen) so re-logins don't
    // resurface old replies.
    pollTicketReplies();
    const ticketsTimer = setInterval(pollTicketReplies, 30_000);
    return () => clearInterval(ticketsTimer);
  }, [effectiveEmail, fetchData, invalidate]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-200 ${sidebarCollapsed ? "md:ml-[68px]" : "md:ml-[220px]"}`}>
        {/* Mobile header - shown only on mobile */}
        <MobileHeader title={title} />
        {/* TopBar is always mounted (header itself hides on mobile) so the help/support
            drawer listener keeps working when invoked from the mobile ? icon */}
        <TopBar title={title} />

        <ImpersonationBanner />

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav - shown only on mobile */}
      <MobileNav />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Impersonation banner — persistent at top when admin is viewing as  */
/*  another user. Only renders when /api/me returns isImpersonating.   */
/* ------------------------------------------------------------------ */
function ImpersonationBanner() {
  // Reuse the shared session-cached /api/me payload — fetching here too would
  // both waste a request and risk drift from the sidebar's view of the world.
  const { isImpersonating, effectiveEmail, realEmail } = useEffectiveSession();
  if (!isImpersonating) return null;

  const stop = async () => {
    try {
      await fetch("/api/impersonate", { method: "DELETE" });
    } finally {
      // Prime the cache with the admin's own scope so the post-redirect
      // first paint already shows the admin nav (Turnovers, Users, Support)
      // instead of flashing the impersonated owner's view. The user can
      // only have reached "Stop impersonating" by being a real admin, so
      // isAdmin: true is safe to assert here.
      if (realEmail) {
        primeEffectiveSessionCache({
          email: realEmail,
          isAdmin: true,
          isImpersonating: false,
          realEmail: null,
        });
      }
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="sticky top-0 z-[60] bg-[#3B5BA5] text-white px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/>
        </svg>
        <div className="text-[13px] truncate">
          Viewing as <span className="font-semibold">{effectiveEmail}</span>
          {realEmail && <span className="opacity-80"> · admin: {realEmail}</span>}
        </div>
      </div>
      <button
        onClick={stop}
        className="h-[28px] px-3 rounded-md bg-white/15 hover:bg-white/25 text-[12px] font-semibold transition-colors flex-shrink-0"
      >
        Stop impersonating
      </button>
    </div>
  );
}
