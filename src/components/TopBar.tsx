"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getNotifications, markAllRead, markAsRead, getUnreadCount, dismissNotification, clearAllNotifications, type AppNotification } from "@/lib/notifications";
import { createTicket, fetchTickets, addTicketComment, markTicketRead, hasNewUpdateForUser, type SupportTicket, type TicketAttachment } from "@/lib/tickets";
import { useEffectiveSession } from "@/lib/useEffectiveSession";

function stopPropagation(ev: { stopPropagation: () => void }): void {
  ev.stopPropagation();
}

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      );
    case "message":
      return (
        <div className="w-8 h-8 rounded-full bg-[#EEF1F5] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
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
    case "document":
      return (
        <div className="w-8 h-8 rounded-full bg-[#EEF0F5] flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
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

/* ── Helper: time ago ── */
function supportTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isImageAttachment(att: TicketAttachment): boolean {
  return att.type?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(att.name || "");
}

/* ── Contact Support Drawer ── */
function HelpDrawer({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  // Tickets are scoped to the *effective* user so an admin who is impersonating
  // an owner sees that owner's tickets, not their own. Falls back to the raw
  // session while /api/me is still loading.
  const effective = useEffectiveSession();
  const userEmail = effective.effectiveEmail || session?.user?.email || "";
  const userName = effective.effectiveName || session?.user?.name || "User";

  const [tab, setTab] = useState<"new" | "list">("new");
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);

  // New ticket form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // My tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const refreshTickets = useCallback(async () => {
    if (userEmail) {
      const list = await fetchTickets();
      setTickets(list);
      setTicketsLoaded(true);
      // If a ticket drawer is open, sync its data so new admin replies appear.
      // Prefer whichever copy has a newer updatedAt (protects against stale polls).
      setOpenTicket((current) => {
        if (!current) return current;
        const fresh = list.find((t) => t.id === current.id);
        if (!fresh) return current;
        if (current.updatedAt && fresh.updatedAt && current.updatedAt > fresh.updatedAt) return current;
        return fresh;
      });
    }
  }, [userEmail]);
  useEffect(() => {
    refreshTickets();
    // Poll every 10 seconds while the drawer is open so new admin replies surface quickly
    const interval = setInterval(() => refreshTickets(), 10000);
    return () => clearInterval(interval);
  }, [refreshTickets]);

  // Conversation state
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<TicketAttachment[]>([]);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Profile image — pulled from /api/me via useEffectiveSession so impersonating
  // an owner shows their avatar in the support drawer, not the admin's.
  const userImage = effective.effectivePicture || session?.user?.image || "";

  // Upload handler (shared for new ticket + replies)
  const uploadFiles = async (selected: FileList, setFilesState: React.Dispatch<React.SetStateAction<TicketAttachment[]>>, setUploadingState: React.Dispatch<React.SetStateAction<boolean>>) => {
    setUploadError("");
    setUploadingState(true);
    try {
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        if (file.size > 10 * 1024 * 1024) { setUploadError(`${file.name} too large (max 10MB).`); continue; }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/tickets/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
          setFilesState((prev) => [...prev, { name: data.name, url: data.url, type: data.type, size: data.size }]);
        } else { setUploadError(data.error || "Upload failed."); }
      }
    } catch { setUploadError("Upload failed."); }
    finally { setUploadingState(false); }
  };

  // Submit new ticket
  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    const created = await createTicket({ subject: subject.trim(), message: message.trim(), submittedBy: userName, submittedImage: userImage, attachments: files });
    setSubmitting(false);
    if (!created) {
      setUploadError("Failed to submit ticket. Please try again.");
      return;
    }
    setSent(true);
    setSubject(""); setMessage(""); setFiles([]);
    await refreshTickets();
    setTimeout(() => { setSent(false); setTab("list"); }, 1500);
  };

  // Open a ticket conversation
  const openConversation = async (t: SupportTicket) => {
    setOpenTicket(t);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    await markTicketRead(t.id, "user");
    await refreshTickets();
  };

  // Send reply in conversation
  const handleSendReply = async () => {
    if ((!replyText.trim() && replyFiles.length === 0) || replySending || !openTicket) return;
    setReplySending(true);
    const updated = await addTicketComment(openTicket.id, {
      message: replyText.trim(),
      authorName: userName,
      authorImage: userImage,
      attachments: replyFiles,
    });
    setReplyText(""); setReplyFiles([]);
    if (updated) { setOpenTicket(updated); }
    await refreshTickets();
    setReplySending(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const filteredTickets = tickets
    .filter((t) => !search || t.subject.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const isClosed = openTicket?.status === "Closed";

  // ── Conversation view ──
  if (openTicket) {
    const allMsgs = [
      { id: "init", author: "User" as const, authorName: openTicket.submittedBy, authorImage: openTicket.submittedImage, message: openTicket.message, attachments: openTicket.attachments || [], createdAt: openTicket.createdAt },
      ...(openTicket.comments || []),
    ];
    return (
      <>
        <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 w-full max-w-[440px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
          <div className="flex items-center justify-between px-5 h-[52px] border-b border-[#eaeaea] flex-shrink-0">
            <button onClick={() => { setOpenTicket(null); refreshTickets(); }} className="text-[13px] text-[#888] hover:text-[#555] flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to tickets
            </button>
            <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <h3 className="text-[16px] font-bold text-[#111] mb-0.5">{openTicket.subject}</h3>
            <div className="text-[11px] text-[#999] mb-5">Created: {new Date(openTicket.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            <div className="text-[13px] font-semibold text-[#111] mb-3">Conversation</div>
            <div className="space-y-4">
              {allMsgs.map((msg) => {
                const isAdmin = msg.author === "Admin";
                return (
                  <div key={msg.id} className="flex items-start gap-2.5">
                    {msg.authorImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.authorImage} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${isAdmin ? "bg-[#333]" : "bg-accent"}`}>
                        {isAdmin ? "S" : (msg.authorName || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-[#111]">{isAdmin ? "Support" : "You"}</span>
                        <span className="text-[11px] text-[#bbb]">{supportTimeAgo(msg.createdAt)}</span>
                      </div>
                      {msg.message && (
                        <div className="text-[13px] text-[#555] leading-relaxed bg-[#fafafa] rounded-lg p-3 border border-[#f0f0f0]">{msg.message}</div>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((att, i) => isImageAttachment(att) ? (
                            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[#eaeaea] hover:border-[#ccc] transition-colors max-w-[200px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att.url} alt={att.name} className="w-full h-auto max-h-[160px] object-cover" />
                            </a>
                          ) : (
                            <a key={i} href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f5f5f5] border border-[#eaeaea] rounded-lg text-[11px] text-[#555] hover:border-[#ccc]">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* Reply input */}
          <div className="border-t border-[#eaeaea] px-5 py-3 flex-shrink-0">
            {isClosed && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#f5f5f5] rounded-lg text-[12px] text-[#888]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                This conversation is closed. Still need help? <button onClick={() => { setOpenTicket(null); setTab("new"); }} className="text-[#80020E] font-medium hover:underline ml-0.5">Contact us</button>
              </div>
            )}
            {replyFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {replyFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[#f5f5f5] border border-[#eaeaea] rounded text-[11px] text-[#555]">
                    {isImageAttachment(f) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    )}
                    <span className="truncate max-w-[80px]">{f.name}</span>
                    <button onClick={() => setReplyFiles((p) => p.filter((_, j) => j !== i))} className="text-[#bbb] hover:text-[#555]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => !replyUploading && replyFileRef.current?.click()} disabled={isClosed || replyUploading}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#555] hover:border-[#ccc] transition-colors flex-shrink-0 disabled:opacity-40">
                {replyUploading ? <div className="w-3 h-3 border-2 border-[#999] border-t-transparent rounded-full animate-spin" /> :
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                }
              </button>
              <input ref={replyFileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" onChange={async (e) => { if (e.target.files) { await uploadFiles(e.target.files, setReplyFiles, setReplyUploading); e.target.value = ""; } }} className="hidden" />
              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder={isClosed ? "Ticket closed" : "Write a reply..."}
                disabled={isClosed}
                className="flex-1 h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white disabled:bg-[#f8f8f8] disabled:cursor-not-allowed" />
              <button type="button" onClick={handleSendReply} disabled={isClosed || replySending || (!replyText.trim() && replyFiles.length === 0)}
                className="h-[36px] px-3.5 rounded-lg border border-[#80020E] text-[#80020E] text-[12px] font-semibold hover:bg-[#80020E]/5 transition-colors flex-shrink-0 disabled:opacity-40">
                {replySending ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main drawer (tabs: New ticket / My tickets) ──
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[52px] border-b border-[#eaeaea] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#111]">Support</span>
          <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#eaeaea] px-6">
          <button onClick={() => setTab("new")} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === "new" ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"}`}>
            New ticket
          </button>
          <button onClick={() => { setTab("list"); refreshTickets(); }} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === "list" ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"}`}>
            My tickets ({tickets.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── New Ticket Tab ── */}
          {tab === "new" && (
            <div className="px-6 py-5">
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
                  <div className="mb-4">
                    <label className="block text-[13px] font-medium text-[#555] mb-1.5">Message</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue in detail..."
                      rows={4} className="w-full px-3.5 py-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white" />
                  </div>
                  <div className="mb-5">
                    <button type="button" onClick={() => !uploading && fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#d0d0d0] rounded-lg text-[12px] text-[#888] hover:border-[#999] hover:text-[#555] transition-colors w-full justify-center disabled:opacity-60">
                      {uploading ? <><div className="w-3 h-3 border-2 border-[#999] border-t-transparent rounded-full animate-spin" />Uploading...</> :
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>Attach files</>}
                    </button>
                    <input ref={fileRef} type="file" multiple onChange={async (e) => { if (e.target.files) { await uploadFiles(e.target.files, setFiles, setUploading); e.target.value = ""; } }} className="hidden" />
                    {uploadError && <div className="mt-2 text-[11px] text-[#B7484F]">{uploadError}</div>}
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-[#f9f9f9] border border-[#eee] rounded-lg text-[11px]">
                            <span className="text-[#555] truncate flex-1">{f.name}</span>
                            <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-[#bbb] hover:text-[#555] ml-2 flex-shrink-0">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleSubmit} disabled={!subject.trim() || !message.trim() || submitting || uploading}
                    className="w-full h-[42px] rounded-lg border border-[#80020E] text-[#80020E] text-[13px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-40">
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── My Tickets Tab ── */}
          {tab === "list" && (
            <div className="px-5 py-4">
              {tickets.length > 0 && (
                <div className="relative mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
                    className="w-full h-[36px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
                </div>
              )}
              {!ticketsLoaded ? (
                <div className="py-10 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin mb-2" />
                  <div className="text-[12px] text-[#999]">Loading tickets...</div>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-[13px] text-[#999]">{tickets.length === 0 ? "No tickets yet" : "No matching tickets"}</div>
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredTickets.map((t) => {
                    const isNew = hasNewUpdateForUser(t);
                    return (
                      <button key={t.id} onClick={() => openConversation(t)}
                        className={`w-full flex items-center gap-3 py-3.5 text-left transition-colors hover:bg-[#f9f9f9] -mx-2 px-2 rounded-lg ${isNew ? "border-l-[3px] border-l-[#80020E] pl-3" : "border-l-[3px] border-l-transparent"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-[#111] truncate">{t.subject}</div>
                          <div className="text-[11px] text-[#999] mt-0.5">{supportTimeAgo(t.updatedAt)}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isNew && (
                            <span className="text-[10px] font-semibold text-[#80020E] bg-[#80020E]/[0.08] px-2 py-0.5 rounded-full border border-[#80020E]/20">New update</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
          <div className="flex items-start justify-between mb-2">
            <span className="text-[16px] font-bold text-[#111]">Notifications</span>
            <button
              onClick={onClose}
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
              <button onClick={handleMarkAllRead} className="text-[#888] hover:text-[#555] transition-colors">Mark all read</button>
              <span className="text-[#ddd]">|</span>
              <button onClick={handleClearAll} className="text-[#888] hover:text-[#555] transition-colors">Clear All</button>
            </div>
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
                  <button onClick={(ev) => { stopPropagation(ev); handleDismiss(n.id); }}
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
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.role === "admin";
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(() => {
    setUnreadCount(getUnreadCount());
  }, []);

  useEffect(() => {
    refreshCount();
    window.addEventListener("hostyo:notification", refreshCount);
    // Listen for mobile header opening the support drawer
    const openSupport = () => setHelpOpen(true);
    window.addEventListener("hostyo:open-support", openSupport);
    return () => {
      window.removeEventListener("hostyo:notification", refreshCount);
      window.removeEventListener("hostyo:open-support", openSupport);
    };
  }, [refreshCount]);

  return (
    <>
      <header className="hidden md:flex sticky top-0 z-40 bg-white border-b border-[#eaeaea] px-6 md:px-8 h-[56px] items-center justify-between">
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

          {/* Add Property — admin only */}
          {isAdmin && (
            <button onClick={() => router.push("/properties?add=1")}
              className="w-8 h-8 rounded-full bg-[#80020E] flex items-center justify-center text-white hover:bg-[#6b010c] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      {helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} />}
      {notifOpen && <NotificationsDrawer onClose={() => { setNotifOpen(false); refreshCount(); }} />}
    </>
  );
}
