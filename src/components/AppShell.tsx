"use client";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import { useData } from "@/lib/DataContext";

const PREFETCH_URLS = [
  ["properties", "/api/properties"],
  ["reservations", "/api/reservations"],
  ["expenses", "/api/expenses"],
  ["payouts", "/api/payouts"],
  ["today", "/api/today"],
];

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { fetchData } = useData();

  // Prefetch all data in background on mount
  useEffect(() => {
    PREFETCH_URLS.forEach(([key, url]) => {
      fetchData(key, url).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-h-screen min-w-0 md:ml-[220px]">
        {/* Mobile header - shown only on mobile */}
        <MobileHeader title={title} />
        {/* Desktop top bar - hidden on mobile */}
        <div className="hidden md:block">
          <TopBar title={title} />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 min-w-0 overflow-x-hidden">{children}</main>
      </div>

      {/* Mobile bottom nav - shown only on mobile */}
      <MobileNav />
    </div>
  );
}
