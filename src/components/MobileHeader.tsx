"use client";

export default function MobileHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-4 h-[52px] flex items-center justify-between md:hidden">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hostyo-logo.png" alt="Hostyo" className="w-7 h-7 rounded-md object-contain" />
        <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>
      </div>
      <button className="relative p-2 text-[#888]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white" />
      </button>
    </header>
  );
}
