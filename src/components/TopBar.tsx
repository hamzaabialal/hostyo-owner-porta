"use client";
import { useRouter } from "next/navigation";

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-6 md:px-8 h-[56px] flex items-center justify-between">
      <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF5A5F] rounded-full border-[1.5px] border-white" />
        </button>

        {/* Refresh */}
        <button onClick={() => window.location.reload()} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>

        {/* Add Property */}
        <button onClick={() => router.push("/properties?add=1")}
          className="w-9 h-9 rounded-full bg-[#80020E] flex items-center justify-center text-white hover:bg-[#6b010c] transition-colors shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
