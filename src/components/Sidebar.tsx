"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { label: "Home", href: "/dashboard", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { label: "Properties", href: "/properties", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { label: "Reservations", href: "/reservations", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
];

const financesIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 14h2"/></svg>;

const financesSubNav = [
  { label: "Overview", href: "/finances" },
  { label: "Earnings", href: "/finances/earnings" },
  { label: "Expenses", href: "/finances/expenses" },
];

const STORAGE_KEY = "hostyo_sidebar_collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const financesActive = pathname.startsWith("/finances");
  const [financesOpen, setFinancesOpen] = useState(financesActive);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    // Dispatch event so AppShell can adjust margin
    window.dispatchEvent(new CustomEvent("hostyo:sidebar", { detail: next }));
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image || "";
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    return pathname === href || (href !== "/finances" && pathname.startsWith(href));
  };

  const isFinancesSubActive = (href: string) => {
    if (href === "/finances") return pathname === "/finances";
    return pathname.startsWith(href);
  };

  const w = collapsed ? "w-[68px]" : "w-[220px]";

  return (
    <aside className={`fixed top-0 left-0 bottom-0 ${w} bg-white border-r border-[#eaeaea] flex flex-col z-50 transition-all duration-200`}>
      {/* Logo + Collapse toggle */}
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"} pt-5 pb-4`}>
        <Link href="/dashboard" className="flex items-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hostyo-logo.png" alt="Hostyo" className={`w-8 h-8 rounded-lg object-contain flex-shrink-0 ${collapsed ? "" : "hidden"}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/property-icons/hostyo-07.png" alt="Hostyo" className={`h-8 object-contain ${collapsed ? "hidden" : ""}`} />
        </Link>
        {!collapsed && (
          <button onClick={toggleCollapse} className="p-1 text-[#ccc] hover:text-[#888] transition-colors" title="Collapse sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
            </svg>
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button onClick={toggleCollapse} className="mx-auto mb-2 p-1 text-[#ccc] hover:text-[#888] transition-colors" title="Expand sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
          </svg>
        </button>
      )}

      {/* Nav */}
      <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.slice(0, 3).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
              className={`flex items-center ${collapsed ? "justify-center" : ""} gap-2.5 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[14px] mb-0.5 transition-colors ${
                active ? "bg-accent-light text-accent font-semibold" : "text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary"
              }`}>
              {item.icon}
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Finances */}
        <button onClick={() => { if (collapsed) { window.location.href = "/finances"; } else { setFinancesOpen(!financesOpen); } }}
          title={collapsed ? "Finances" : undefined}
          className={`w-full flex items-center ${collapsed ? "justify-center" : ""} gap-2.5 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[14px] mb-0.5 transition-colors ${
            financesActive ? "bg-accent-light text-accent font-semibold" : "text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary"
          }`}>
          {financesIcon}
          {!collapsed && <span className="flex-1 text-left">Finances</span>}
          {!collapsed && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`flex-shrink-0 transition-transform ${financesOpen ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </button>
        {!collapsed && financesOpen && (
          <div className="ml-[30px] border-l border-[#eaeaea] pl-2 mb-1">
            {financesSubNav.map((sub) => {
              const active = isFinancesSubActive(sub.href);
              return (
                <Link key={sub.href} href={sub.href}
                  className={`block px-3 py-[7px] rounded-md text-[13px] mb-0.5 transition-colors ${
                    active ? "text-accent font-semibold" : "text-text-secondary hover:text-text-primary hover:bg-[#f5f5f5]"
                  }`}>
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Users (admin only) */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(session?.user as any)?.role === "admin" && (() => {
          const usersActive = pathname.startsWith("/users");
          return (
            <Link href="/users" title={collapsed ? "Users" : undefined}
              className={`flex items-center ${collapsed ? "justify-center" : ""} gap-2.5 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[14px] mb-0.5 transition-colors ${
                usersActive ? "bg-accent-light text-accent font-semibold" : "text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary"
              }`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              {!collapsed && "Users"}
            </Link>
          );
        })()}

        {/* Settings */}
        {navItems.slice(3).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
              className={`flex items-center ${collapsed ? "justify-center" : ""} gap-2.5 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[14px] mb-0.5 transition-colors ${
                active ? "bg-accent-light text-accent font-semibold" : "text-text-secondary hover:bg-[#f5f5f5] hover:text-text-primary"
              }`}>
              {item.icon}
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile + Sign out */}
      <div className={`border-t border-[#eaeaea] ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt={userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-bold">{initials}</div>
            )}
            <button onClick={() => signOut({ callbackUrl: "/login" })} title="Log out"
              className="p-1.5 text-[#999] hover:text-[#555] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px]">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mb-3">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt={userName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">{initials}</div>
              )}
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#111] truncate">{userName}</div>
                {userEmail && <div className="text-[10px] text-[#999] truncate">{userEmail}</div>}
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-[#999] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors w-full">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px]">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Log out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
