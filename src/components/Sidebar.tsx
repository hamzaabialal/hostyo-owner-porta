"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/dashboard", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { label: "Reservations", href: "/reservations", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: "Earnings", href: "/earnings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { label: "Expenses", href: "/expenses", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    if (href === "/earnings") return pathname.startsWith("/earnings");
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[220px] bg-white border-r border-[#eaeaea] flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://lh3.googleusercontent.com/d/1O-0eQ8Nlh0SuXjHcofZTAbom6iV59aVK"
          alt="Hostyo"
          className="w-8 h-8 rounded-lg object-contain"
        />
        <span className="font-semibold text-[15px] text-text-primary">Hostyo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] mb-0.5 transition-colors ${
                active
                  ? "bg-accent-light text-accent font-semibold"
                  : "text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#eaeaea] px-3 py-3">
        <Link
          href="/login?signed_out=1"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </Link>
      </div>
    </aside>
  );
}
