"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* ── Help Drawer ── */
function HelpDrawer({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    // Open mailto with prefilled subject/body
    const mailto = `mailto:support@hostyo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(mailto, "_blank");
    setSent(true);
    setTimeout(() => onClose(), 1500);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[400px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[201] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#eaeaea] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#111]">Help & Support</span>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
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
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[400px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[201] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#eaeaea] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#111]">Notifications</span>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div className="text-[15px] font-semibold text-[#111] mb-1">No notifications</div>
            <div className="text-[13px] text-[#888]">You&apos;re all caught up. New activity will appear here.</div>
          </div>
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

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-6 md:px-8 h-[56px] flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-[#111]">{title}</h1>

        <div className="flex items-center gap-1.5">
          {/* Help */}
          <button onClick={() => setHelpOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>

          {/* Notifications */}
          <button onClick={() => setNotifOpen(true)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF5A5F] rounded-full ring-2 ring-white" />
          </button>

          {/* Add Property */}
          <button onClick={() => router.push("/properties?add=1")}
            className="w-9 h-9 rounded-full bg-[#80020E] flex items-center justify-center text-white hover:bg-[#6b010c] transition-colors ml-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} />}
      {notifOpen && <NotificationsDrawer onClose={() => setNotifOpen(false)} />}
    </>
  );
}
