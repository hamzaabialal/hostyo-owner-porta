"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { fetchTickets, patchTicket, deleteTicketServer, addTicketComment, markTicketRead, type SupportTicket, type TicketAttachment } from "@/lib/tickets";

const STATUS_OPTIONS = ["Open", "In Progress", "Closed"] as const;
type TicketStatus = (typeof STATUS_OPTIONS)[number];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"] as const;

// Kanban column visual config
const COLUMNS: { status: TicketStatus; label: string; dot: string; bar: string; count: string }[] = [
  { status: "Open",        label: "Open",        dot: "#D4A843", bar: "#D4A843", count: "text-[#8A6A2E]" },
  { status: "In Progress", label: "In Progress", dot: "#655E7A", bar: "#655E7A", count: "text-[#4A4360]" },
  { status: "Closed",      label: "Closed",      dot: "#999",    bar: "#bbb",    count: "text-[#666]" },
];

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

function priorityBadge(p: string): { color: string; bg: string; label: string } {
  switch (p) {
    case "High":   return { color: "#B7484F", bg: "#F6EDED", label: "High" };
    case "Medium": return { color: "#8A6A2E", bg: "#FBF1E2", label: "Medium" };
    case "Low":    return { color: "#5A8570", bg: "#EAF2ED", label: "Low" };
    default:       return { color: "#999",    bg: "#f5f5f5", label: p };
  }
}

function initialsOf(name: string): string {
  return name.split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "U";
}

export default function TicketsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useSession() as any;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<TicketStatus | null>(null);
  // Tickets with an in-flight PATCH — the poller's response is stale for these
  // so we preserve the local (optimistic) state until the PATCH resolves.
  const pendingPatchesRef = useRef<Set<string>>(new Set());

  const isAdmin = session?.user?.role === "admin";

  const refresh = async () => {
    const list = await fetchTickets();
    setTickets((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return list.map((t) => {
        const local = prevById.get(t.id);
        // If a PATCH is in flight, always keep the local (optimistic) state
        if (pendingPatchesRef.current.has(t.id)) {
          return local || t;
        }
        // Otherwise: compare updatedAt. If the local copy is newer than what the
        // server returned, it means the blob storage is still serving stale data
        // after a recent write — keep the local copy until the server catches up.
        if (local && local.updatedAt && t.updatedAt && local.updatedAt > t.updatedAt) {
          return local;
        }
        return t;
      });
    });
  };

  useEffect(() => {
    refresh();
    // Poll every 20 seconds so admin sees new tickets without refreshing
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchesFilters = (t: SupportTicket): boolean => {
    if (filterPriority && t.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.subject.toLowerCase().includes(q) &&
        !t.submittedBy.toLowerCase().includes(q) &&
        !t.submittedEmail.toLowerCase().includes(q) &&
        !t.message.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  };

  const ticketsByStatus = (status: TicketStatus): SupportTicket[] =>
    tickets.filter((t) => t.status === status && matchesFilters(t));

  const totalVisible = tickets.filter(matchesFilters).length;

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => { setDraggingId(null); setHoverColumn(null); };
  const handleDrop = async (status: TicketStatus) => {
    if (!draggingId) return;
    const ticket = tickets.find((t) => t.id === draggingId);
    if (!ticket || ticket.status === status) { setDraggingId(null); setHoverColumn(null); return; }
    const previousStatus = ticket.status;
    const id = draggingId;
    // Optimistic update + mark as in-flight so the poller ignores it
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    pendingPatchesRef.current.add(id);
    setDraggingId(null);
    setHoverColumn(null);
    try {
      const result = await patchTicket(id, { status });
      if (!result) {
        console.error("Failed to update ticket status; reverting");
        setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: previousStatus } : t));
        alert("Couldn't update ticket status — check the browser console and try again.");
        return;
      }
      // Merge server response so we have the canonical updatedAt etc.
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, ...result } : t));
    } finally {
      pendingPatchesRef.current.delete(id);
    }
  };

  if (!isAdmin) {
    return (
      <AppShell title="Support Tickets">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">You don&apos;t have permission to access this page.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Support Tickets">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap -mt-1">
        <div>
          <div className="text-[13px] text-[#888]">Manage support tickets from property owners.</div>
          <div className="text-[11px] text-[#bbb] mt-0.5">{totalVisible} of {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} · drag cards between columns to update status</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
              className="h-[36px] w-[220px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
          </div>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="h-[36px] px-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]">
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban board */}
      {tickets.length === 0 ? (
        <div className="bg-white border border-[#eaeaea] rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div className="text-[15px] font-semibold text-[#111] mb-1">No support tickets yet</div>
          <div className="text-[13px] text-[#888]">Tickets submitted via the Help button will appear here.</div>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:-mx-0 pb-4">
          <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] md:grid-cols-3 md:auto-cols-auto gap-3 px-4 md:px-0 min-w-full">
            {COLUMNS.map((col) => {
              const list = ticketsByStatus(col.status);
              const isHover = hoverColumn === col.status;
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => { e.preventDefault(); setHoverColumn(col.status); }}
                  onDragLeave={() => setHoverColumn((cur) => (cur === col.status ? null : cur))}
                  onDrop={() => handleDrop(col.status)}
                  className={`bg-[#f7f7f8] rounded-xl border transition-colors flex flex-col ${
                    isHover ? "border-[#80020E]/40 bg-[#F6EDED]/40" : "border-[#ececec]"
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-[#ececec]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
                      <span className="text-[12px] font-semibold text-[#333] uppercase tracking-wide truncate">{col.label}</span>
                      <span className={`text-[11px] font-semibold tabular-nums ${col.count}`}>{list.length}</span>
                    </div>
                  </div>
                  {/* Accent bar */}
                  <div className="h-[3px] w-full" style={{ backgroundColor: col.bar }} />
                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                    {list.length === 0 ? (
                      <div className="text-[11px] text-[#bbb] italic text-center py-6 border border-dashed border-[#e5e5e5] rounded-lg">
                        Drop here
                      </div>
                    ) : (
                      list.map((t) => {
                        const pb = priorityBadge(t.priority);
                        const isDragging = draggingId === t.id;
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => handleDragStart(t.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedTicket(t)}
                            className={`group bg-white border border-[#eaeaea] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[#ddd] transition-all ${
                              isDragging ? "opacity-40 rotate-[1deg]" : ""
                            }`}
                          >
                            {/* Priority pill + ID */}
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded"
                                style={{ color: pb.color, backgroundColor: pb.bg }}
                              >
                                {pb.label}
                              </span>
                              <span className="text-[10px] text-[#bbb] font-mono truncate">#{t.id.slice(-5)}</span>
                            </div>
                            {/* Title */}
                            <div className="text-[13px] font-semibold text-[#111] leading-snug mb-1 line-clamp-2">{t.subject}</div>
                            {/* Message preview */}
                            <div className="text-[11px] text-[#888] leading-relaxed line-clamp-2 mb-2.5">{t.message}</div>
                            {/* Footer: avatar + time */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f3f3f3]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {t.submittedImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.submittedImage} alt={t.submittedBy} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                                    {initialsOf(t.submittedBy)}
                                  </div>
                                )}
                                <span className="text-[10px] text-[#777] truncate">{t.submittedBy}</span>
                              </div>
                              <span className="text-[10px] text-[#bbb] flex-shrink-0">{timeAgo(t.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket Detail Drawer */}
      {selectedTicket && (
        <TicketDrawer
          ticket={selectedTicket}
          onClose={() => { setSelectedTicket(null); refresh(); }}
          onUpdate={async (updates) => {
            // Optimistic update
            setSelectedTicket({ ...selectedTicket, ...updates });
            const updated = await patchTicket(selectedTicket.id, updates as Parameters<typeof patchTicket>[1]);
            if (updated) setSelectedTicket(updated);
            refresh();
          }}
          onCommentAdded={(updated) => setSelectedTicket(updated)}
          onDelete={async () => {
            await deleteTicketServer(selectedTicket.id);
            setSelectedTicket(null);
            refresh();
          }}
        />
      )}
    </AppShell>
  );
}

/* ── Ticket Detail Drawer ── */
function TicketDrawer({ ticket, onClose, onUpdate, onCommentAdded, onDelete }: {
  ticket: SupportTicket;
  onClose: () => void;
  onUpdate: (updates: Partial<SupportTicket>) => void;
  onCommentAdded: (updated: SupportTicket) => void;
  onDelete: () => void;
}) {
  // Mark ticket as read by admin when opened
  useEffect(() => {
    markTicketRead(ticket.id, "admin").catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);
  const [commentText, setCommentText] = useState("");
  const [commentFiles, setCommentFiles] = useState<TicketAttachment[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const commentFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build the full message thread: initial message + comments
  const allMessages = [
    {
      id: "initial",
      author: "User" as const,
      authorName: ticket.submittedBy,
      authorEmail: ticket.submittedEmail,
      authorImage: ticket.submittedImage,
      message: ticket.message,
      attachments: ticket.attachments || [],
      createdAt: ticket.createdAt,
    },
    ...(ticket.comments || []),
  ];

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    setUploadError("");
    setUploadingComment(true);
    try {
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        if (file.size > 10 * 1024 * 1024) { setUploadError(`${file.name} too large (max 10MB).`); continue; }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/tickets/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
          setCommentFiles((prev) => [...prev, { name: data.name, url: data.url, type: data.type, size: data.size }]);
        } else {
          setUploadError(data.error || "Upload failed.");
        }
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingComment(false);
      e.target.value = "";
    }
  };

  const handleSendComment = async () => {
    if ((!commentText.trim() && commentFiles.length === 0) || sendingComment) return;
    setSendingComment(true);
    try {
      const updated = await addTicketComment(ticket.id, {
        message: commentText.trim(),
        authorName: "Admin",
        attachments: commentFiles,
      });
      setCommentText("");
      setCommentFiles([]);
      if (updated) onCommentAdded(updated);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } finally {
      setSendingComment(false);
    }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#eaeaea] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="text-[13px] text-[#888] hover:text-[#555] transition-colors flex items-center gap-1 flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Tickets
            </button>
          </div>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Subject + meta */}
          <div className="mb-5">
            <h3 className="text-[17px] font-bold text-[#111] mb-1">{ticket.subject}</h3>
            <div className="text-[12px] text-[#999]">
              Submitted by: {ticket.submittedBy} &middot; Created: {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* Admin Controls */}
          <div className="mb-5 pb-5 border-b border-[#f0f0f0]">
            <div className="text-[11px] font-semibold text-[#999] uppercase tracking-wide mb-2.5">Admin Actions</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#888] mb-1">Status</label>
                <select value={ticket.status} onChange={(e) => onUpdate({ status: e.target.value as SupportTicket["status"] })}
                  className="w-full h-[34px] px-2.5 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#888] mb-1">Priority</label>
                <select value={ticket.priority} onChange={(e) => onUpdate({ priority: e.target.value as SupportTicket["priority"] })}
                  className="w-full h-[34px] px-2.5 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] bg-white outline-none focus:border-[#80020E]">
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Messages thread */}
          <div className="mb-4">
            <div className="text-[13px] font-bold text-[#111] mb-3">Messages</div>
            <div className="space-y-4">
              {allMessages.map((msg) => {
                const isAdmin = msg.author === "Admin";
                return (
                  <div key={msg.id} className="flex items-start gap-3">
                    {msg.authorImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.authorImage} alt={msg.authorName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${isAdmin ? "bg-[#333]" : "bg-accent"}`}>
                        {isAdmin ? "A" : initialsOf(msg.authorName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-[#111]">{isAdmin ? "Admin" : msg.authorName}</span>
                        {msg.authorEmail && !isAdmin && <span className="text-[11px] text-[#999]">{msg.authorEmail}</span>}
                        <span className="text-[11px] text-[#bbb]">{timeAgo(msg.createdAt)}</span>
                      </div>
                      {msg.message && (
                        <div className="text-[13px] text-[#555] leading-relaxed bg-[#fafafa] rounded-lg p-3 border border-[#f0f0f0]">
                          {msg.message}
                        </div>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((att, i) => (
                            <a key={i} href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f5f5f5] border border-[#eaeaea] rounded-lg text-[11px] text-[#555] hover:border-[#ccc] transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <span className="text-[#bbb]">{fmtSize(att.size)}</span>
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
        </div>

        {/* Comment input */}
        <div className="border-t border-[#eaeaea] px-6 py-4 flex-shrink-0">
          {commentFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {commentFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[#f5f5f5] border border-[#eaeaea] rounded text-[11px] text-[#555]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  <span className="truncate max-w-[100px]">{f.name}</span>
                  <button onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))} className="text-[#bbb] hover:text-[#555] ml-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploadError && <div className="text-[11px] text-[#B7484F] mb-1.5">{uploadError}</div>}
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => !uploadingComment && commentFileRef.current?.click()} disabled={uploadingComment} title="Attach file"
              className="w-[38px] h-[38px] flex items-center justify-center rounded-lg border border-[#e2e2e2] text-[#999] hover:text-[#555] hover:border-[#ccc] transition-colors flex-shrink-0 disabled:opacity-60">
              {uploadingComment ? (
                <div className="w-3.5 h-3.5 border-2 border-[#999] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              )}
            </button>
            <input ref={commentFileRef} type="file" multiple onChange={handleAddFiles} className="hidden" />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
              placeholder="Write a message..."
              className="flex-1 h-[38px] px-3.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
            />
            <button type="button" onClick={handleSendComment} disabled={sendingComment || uploadingComment || (!commentText.trim() && commentFiles.length === 0)}
              className="h-[38px] px-4 rounded-lg border border-[#80020E] text-[#80020E] text-[13px] font-semibold hover:bg-[#80020E]/5 transition-colors flex-shrink-0 disabled:opacity-40">
              {sendingComment ? "Sending..." : "Send"}
            </button>
          </div>

          {/* Delete */}
          <button onClick={() => { if (confirm("Delete this ticket?")) onDelete(); }}
            className="flex items-center gap-1.5 mt-3 px-0 py-1 text-[12px] font-medium text-[#999] hover:text-[#7A5252] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete Ticket
          </button>
        </div>
      </div>
    </>
  );
}
