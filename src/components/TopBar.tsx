"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const properties = ["All Properties", "The Kensington Residence", "Villa Serena", "Mayfair Studio"];

export default function TopBar({ title, showAddProperty = true }: { title: string; showAddProperty?: boolean }) {
  const [propOpen, setPropOpen] = useState(false);
  const [selectedProp, setSelectedProp] = useState("All Properties");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-8 h-[60px] flex items-center justify-between">
      <h1 className="text-[16px] font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Property filter */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setPropOpen(!propOpen)}
            className="dropdown-trigger min-w-[170px]"
          >
            <span className="truncate">{selectedProp}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#999] flex-shrink-0">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {propOpen && (
            <div className="dropdown-panel right-0 min-w-[220px] max-h-[280px] overflow-y-auto">
              {properties.map((p) => (
                <button
                  key={p}
                  onClick={() => { setSelectedProp(p); setPropOpen(false); }}
                  className={`dropdown-item ${selectedProp === p ? "selected" : ""}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <span className="dropdown-trigger text-text-tertiary cursor-default">
          Mar 1 – Mar 31, 2026
        </span>

        {/* Export */}
        <button className="dropdown-trigger text-text-secondary hover:text-text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Export</span>
        </button>

        {/* Add Property */}
        {showAddProperty && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add property
          </Link>
        )}

        {/* Bell */}
        <button className="relative p-2 text-text-secondary hover:text-text-primary transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white text-[11px] font-bold">AP</div>
          <span className="text-[13px] font-medium text-text-primary hidden xl:block">Alexandra Pemberton</span>
        </div>
      </div>
    </header>
  );
}
