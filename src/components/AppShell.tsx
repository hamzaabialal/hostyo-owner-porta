"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import { useData } from "@/lib/DataContext";
import { addNotification, getNotifications } from "@/lib/notifications";

const PREFETCH_URLS = [
  ["properties", "/api/properties"],
  ["reservations", "/api/reservations"],
  ["expenses", "/api/expenses"],
  ["payouts", "/api/payouts"],
  ["today", "/api/today"],
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function seedNotifications(reservations: any[], expenses: any[]) {
  const existing = getNotifications();
  if (existing.length > 0) return; // Only seed once

  const today = new Date().toISOString().split("T")[0];

  // Generate notifications from recent reservations
  const sorted = [...reservations]
    .filter((r: any) => r.checkin || r.checkout)
    .sort((a: any, b: any) => (b.checkout || b.checkin || "").localeCompare(a.checkout || a.checkin || ""))
    .slice(0, 15);

  for (const r of sorted) {
    if (r.status === "Cancelled") {
      addNotification({ type: "reservation", title: "Reservation cancelled", description: `${r.guest} at ${r.property} was cancelled.` });
    } else if (r.checkin === today) {
      addNotification({ type: "reservation", title: "Check-in today", description: `${r.guest} is checking in at ${r.property}.` });
    } else if (r.checkout === today) {
      addNotification({ type: "reservation", title: "Check-out today", description: `${r.guest} is checking out of ${r.property}.` });
    } else if (r.payoutStatus === "Paid") {
      addNotification({ type: "payout", title: "Payout completed", description: `€${(r.ownerPayout || 0).toFixed(2)} paid for ${r.guest} at ${r.property}.` });
    } else if (r.payoutStatus === "Pending" && r.status === "Completed") {
      addNotification({ type: "payout", title: "Payout pending", description: `€${(r.ownerPayout || 0).toFixed(2)} pending for ${r.guest} at ${r.property}.` });
    } else if (r.checkin > today) {
      addNotification({ type: "reservation", title: "Upcoming reservation", description: `${r.guest} arriving at ${r.property} on ${r.checkin}.` });
    } else {
      addNotification({ type: "reservation", title: "Reservation completed", description: `${r.guest} stayed at ${r.property}.` });
    }
  }

  // Generate from recent expenses
  const recentExp = [...expenses].slice(0, 5);
  for (const e of recentExp) {
    addNotification({
      type: "expense",
      title: "Expense submitted",
      description: `${e.category || "Expense"} — €${(e.amount || 0).toFixed(2)} at ${e.property || "a property"}.`,
    });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { fetchData } = useData();
  const seeded = useRef(false);
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

    // Seed notifications from reservation + expense data
    if (!seeded.current) {
      seeded.current = true;
      Promise.all([
        fetchData("reservations", "/api/reservations"),
        fetchData("expenses", "/api/expenses"),
      ]).then(([resResult, expResult]: unknown[]) => {
        const rr = resResult as { data?: unknown[] };
        const er = expResult as { data?: unknown[] };
        seedNotifications(rr.data || [], er.data || []);
      }).catch(() => {});

      // Auto-sync balances + deficit adjustments in the background.
      // Throttled: only runs once per 10-minute window per browser session.
      const SYNC_KEY = "hostyo_last_auto_sync";
      const lastSync = Number(sessionStorage.getItem(SYNC_KEY) || "0");
      const TEN_MINUTES = 10 * 60 * 1000;
      if (Date.now() - lastSync > TEN_MINUTES) {
        sessionStorage.setItem(SYNC_KEY, String(Date.now()));
        fetch("/api/properties/sync-balances", { method: "POST" }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [state, setState] = useState<{ isImpersonating: boolean; email: string; realEmail: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.isImpersonating) {
          setState({ isImpersonating: true, email: d.email, realEmail: d.realEmail });
        }
      })
      .catch(() => {});
  }, []);

  if (!state?.isImpersonating) return null;

  const stop = async () => {
    try {
      await fetch("/api/impersonate", { method: "DELETE" });
    } finally {
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
          Viewing as <span className="font-semibold">{state.email}</span>
          {state.realEmail && <span className="opacity-80"> · admin: {state.realEmail}</span>}
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
