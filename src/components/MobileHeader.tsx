"use client";
import { useState, useEffect, useCallback } from "react";
import { getNotifications, markAllRead, markAsRead, getUnreadCount, dismissNotification, clearAllNotifications, type AppNotification } from "@/lib/notifications";

function stopPropagation(ev: { stopPropagation: () => void }): void {
  ev.stopPropagation();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function notifIcon(type: AppNotification["type"]) {
  const icons: Record<string, { bg: string; stroke: string; path: string }> = {
    reservation: { bg: "#EEF1F5", stroke: "#5E6673", path: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    payout: { bg: "#EAF3EF", stroke: "#2F6B57", path: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>' },
    expense: { bg: "#F6EDED", stroke: "#7A5252", path: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    property: { bg: "#F6F1E6", stroke: "#8A6A2E", path: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    system: { bg: "#f5f5f5", stroke: "#888", path: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
  };
  const i = icons[type] || icons.system;
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: i.bg }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={i.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: i.path }} />
    </div>
  );
}

export default function MobileHeader({ title }: { title: string }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    setItems(getNotifications());
    setUnreadCount(getUnreadCount());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("hostyo:notification", refresh);
    return () => window.removeEventListener("hostyo:notification", refresh);
  }, [refresh]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-4 h-[52px] flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hostyo-logo.png" alt="Hostyo" className="w-7 h-7 rounded-md object-contain" />
          <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>
        </div>
        <button onClick={() => setNotifOpen(true)} className="relative p-2 text-[#888] hover:text-[#555] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-[#FF5A5F] rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white px-0.5">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* Notifications Drawer */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={() => setNotifOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-[#eaeaea] flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[16px] font-bold text-[#111]">Notifications</span>
                <button
                  onClick={() => setNotifOpen(false)}
                  title="Close"
                  aria-label="Close notifications"
                  className="-mt-1 -mr-1 w-9 h-9 flex items-center justify-center rounded-full text-[#666] hover:text-[#111] hover:bg-[#f3f3f3] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px]">
                  {unread > 0 && <span className="text-[#80020E] font-semibold">{unread} Unread</span>}
                  {unread > 0 && items.length > 0 && <span className="text-[#ccc]">&bull;</span>}
                  <span className="text-[#999]">{items.length} Total</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] font-medium">
                  <button onClick={() => { markAllRead(); refresh(); }} className="text-[#888] hover:text-[#555] transition-colors">Mark all read</button>
                  <span className="text-[#ddd]">|</span>
                  <button onClick={() => { clearAllNotifications(); refresh(); }} className="text-[#888] hover:text-[#555] transition-colors">Clear All</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                    </svg>
                  </div>
                  <div className="text-[15px] font-semibold text-[#111] mb-1">No notifications</div>
                  <div className="text-[13px] text-[#888]">You&apos;re all caught up.</div>
                </div>
              ) : (
                <div>
                  {items.map((n) => (
                    <div key={n.id} onClick={() => { if (!n.read) { markAsRead(n.id); refresh(); } }}
                      className={`flex items-start gap-3 px-5 py-4 border-b border-[#f3f3f3] cursor-pointer hover:bg-[#f9f9f9] transition-colors ${
                        !n.read ? "bg-[#80020E]/[0.02] border-l-[3px] border-l-[#80020E]" : "border-l-[3px] border-l-transparent"
                      }`}>
                      {notifIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111]">{n.title}</div>
                        <div className="text-[12px] text-[#777] mt-0.5 leading-relaxed">{n.description}</div>
                        <div className="text-[10px] text-[#bbb] mt-1.5">{timeAgo(n.timestamp)}</div>
                      </div>
                      <button onClick={(ev) => { stopPropagation(ev); dismissNotification(n.id); refresh(); }}
                        className="p-1 text-[#ccc] hover:text-[#888] transition-all flex-shrink-0 mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
