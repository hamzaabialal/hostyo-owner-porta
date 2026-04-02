"use client";
import { useRouter } from "next/navigation";

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-6 md:px-8 h-[56px] flex items-center justify-between">
      <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>

      <div className="flex items-center gap-1">
        {/* Help */}
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#ccc] hover:bg-[#f5f5f5] hover:text-[#888] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#ccc] hover:bg-[#f5f5f5] hover:text-[#888] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#FF5A5F] rounded-full" />
        </button>

        {/* Add Property */}
        <button onClick={() => router.push("/properties?add=1")}
          className="w-9 h-9 rounded-full bg-[#80020E] flex items-center justify-center text-white hover:bg-[#6b010c] transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
