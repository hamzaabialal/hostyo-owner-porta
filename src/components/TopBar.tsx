"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getNotifications, markAllRead, markAsRead, getUnreadCount, dismissNotification, clearAllNotifications, type AppNotification } from "@/lib/notifications";
import { addTicket } from "@/lib/tickets";

/* ── Time helpers ── */
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
  switch (type) {
    case "reservation":
      return (
        <div className="w-8 h-8 rounded-full bg-[#EEF1F5] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
      );
    case "payout":
      return (
        <div className="w-8 h-8 rounded-full bg-[#EAF3EF] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </div>
      );
    case "expense":
      return (
        <div className="w-8 h-8 rounded-full bg-[#F6EDED] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A5252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
      );
    case "property":
      return (
        <div className="w-8 h-8 rounded-full bg-[#F6F1E6] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
      );
  }
}

/* ── Help Drawer ── */
function HelpDrawer({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    addTicket({
      subject: subject.trim(),
      message: message.trim(),
      submittedBy: "User",
      submittedEmail: "",
    });
    setSent(true);
    setTimeout(() => onClose(), 1500);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[400px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#eaeaea] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#111]">Help & Support</span>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#EAF3EF] flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text-[15px] font-semibold text-[#111] mb-1">Ticket submitted</div>
              <div className="text-[13px] text-[#888]">We&apos;ll get back to you shortly.</div>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[#888] mb-5">Submit a support ticket and our team will get back to you as soon as possible.</p>
              <div className="mb-4">
                <label className="block text-[13px] font-medium text-[#555] mb-1.5">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue"
                  className="w-full h-[42px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
              </div>
              <div className="mb-5">
                <label className="block text-[13px] font-medium text-[#555] mb-1.5">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue in detail..."
                  rows={5} className="w-full px-3.5 py-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
              </div>
              <button onClick={handleSubmit} disabled={!subject.trim() || !message.trim()}
                className="w-full h-[42px] rounded-lg bg-[#80020E] text-white text-[13px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-40">
                Submit Ticket
              </button>
              <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
                <p className="text-[12px] text-[#999] mb-2">Or contact us directly:</p>
                <a href="mailto:support@hostyo.com" className="text-[13px] text-[#80020E] font-medium hover:underline">support@hostyo.com</a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Notifications Drawer ── */
function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    setItems(getNotifications());
    const handler = () => setItems(getNotifications());
    window.addEventListener("hostyo:notification", handler);
    return () => window.removeEventListener("hostyo:notification", handler);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    markAllRead();
    setItems(getNotifications());
  };

  const handleClearAll = () => {
    clearAllNotifications();
    setItems([]);
  };

  const handleDismiss = (id: string) => {
    dismissNotification(id);
    setItems(getNotifications());
  };

  const handleClickNotification = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(id);
      setItems(getNotifications());
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#eaeaea] flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[16px] font-bold text-[#111]">Notifications</span>
            <div className="flex items-center gap-3 text-[12px] font-medium">
              <button onClick={handleMarkAllRead} className="text-[#888] hover:text-[#555] transition-colors">Mark all read</button>
              <span className="text-[#ddd]">|</span>
              <button onClick={handleClearAll} className="text-[#888] hover:text-[#555] transition-colors">Clear All</button>
              <button onClick={onClose} className="ml-1 p-1 text-[#999] hover:text-[#555] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            {unread > 0 && <span className="text-[#80020E] font-semibold">{unread} Unread</span>}
            {unread > 0 && items.length > 0 && <span className="text-[#ccc]">&bull;</span>}
            <span className="text-[#999]">{items.length} Total</span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <div className="text-[15px] font-semibold text-[#111] mb-1">No notifications</div>
              <div className="text-[13px] text-[#888]">You&apos;re all caught up. New activity will appear here.</div>
            </div>
          ) : (
            <div>
              {items.map((n) => (
                <div key={n.id} onClick={() => handleClickNotification(n.id, n.read)}
                  className={`flex items-start gap-3 px-5 py-4 border-b border-[#f3f3f3] transition-colors group cursor-pointer hover:bg-[#f9f9f9] ${
                    !n.read ? "bg-[#80020E]/[0.02] border-l-[3px] border-l-[#80020E]" : "border-l-[3px] border-l-transparent"
                  }`}>
                  {notifIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#111]">{n.title}</div>
                    <div className="text-[12px] text-[#777] mt-0.5 leading-relaxed">{n.description}</div>
                    <div className="text-[10px] text-[#bbb] mt-1.5">{timeAgo(n.timestamp)}</div>
                  </div>
                  <button onClick={() => handleDismiss(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#ccc] hover:text-[#888] transition-all flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── TopBar ── */
export default function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(() => {
    setUnreadCount(getUnreadCount());
  }, []);

  useEffect(() => {
    refreshCount();
    window.addEventListener("hostyo:notification", refreshCount);
    return () => window.removeEventListener("hostyo:notification", refreshCount);
  }, [refreshCount]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-6 md:px-8 h-[56px] flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>

        <div className="flex items-center gap-2.5">
          {/* Help */}
          <button onClick={() => setHelpOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-[#555] transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>

          {/* Notifications */}
          <button onClick={() => { setNotifOpen(true); }}
            className="relative w-8 h-8 flex items-center justify-center text-[#888] hover:text-[#555] transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0 w-2.5 h-2.5 bg-[#80020E] rounded-full ring-[1.5px] ring-white" />
            )}
          </button>

          {/* Add Property */}
          <button onClick={() => router.push("/properties?add=1")}
            className="w-8 h-8 rounded-full bg-[#80020E] flex items-center justify-center text-white hover:bg-[#6b010c] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} />}
      {notifOpen && <NotificationsDrawer onClose={() => { setNotifOpen(false); refreshCount(); }} />}
    </>
  );
}
