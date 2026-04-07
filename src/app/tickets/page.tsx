"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { getTickets, updateTicket, deleteTicket, type SupportTicket } from "@/lib/tickets";

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"] as const;
const PRIORITY_OPTIONS = ["Low", "Medium", "High"] as const;

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

function statusColor(s: string) {
  switch (s) {
    case "Open": return "pill pill-pending";
    case "In Progress": return "pill pill-in-review";
    case "Resolved": return "pill pill-live";
    case "Closed": return "pill pill-scheduled";
    default: return "pill";
  }
}

function priorityColor(p: string) {
  switch (p) {
    case "High": return "text-[#FF5A5F] font-semibold";
    case "Medium": return "text-[#8A6A2E] font-medium";
    case "Low": return "text-[#999]";
    default: return "text-[#999]";
  }
}

export default function TicketsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useSession() as any;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    setTickets(getTickets());
  }, []);

  const refresh = () => setTickets(getTickets());

  const filtered = tickets.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) && !t.submittedBy.toLowerCase().includes(q) && !t.submittedEmail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;

  if (!isAdmin) {
    return (
      <AppShell title="Support Tickets">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">You don&apos;t have permission to access this page.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Support Tickets">
      <div className="text-[13px] text-[#888] mb-5 -mt-1">Manage support tickets from property owners.</div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Total</div>
          <div className="text-[22px] font-bold text-[#111]">{tickets.length}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Open</div>
          <div className="text-[22px] font-bold text-[#D4A843]">{openCount}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">In Progress</div>
          <div className="text-[22px] font-bold text-[#655E7A]">{inProgressCount}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Resolved</div>
          <div className="text-[22px] font-bold text-[#2F6B57]">{resolvedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E]">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E]">
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Tickets List */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#999]">
            {tickets.length === 0 ? "No support tickets yet. Tickets submitted via the Help button will appear here." : "No tickets match your filters."}
          </div>
        ) : (
          <div className="divide-y divide-[#f3f3f3]">
            {filtered.map((t) => (
              <button key={t.id} onClick={() => setSelectedTicket(t)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#f9f9f9] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={statusColor(t.status)}>{t.status}</span>
                    <span className={`text-[11px] ${priorityColor(t.priority)}`}>{t.priority}</span>
                  </div>
                  <div className="text-[14px] font-medium text-[#111] truncate">{t.subject}</div>
                  <div className="text-[12px] text-[#888] mt-0.5 truncate">{t.message}</div>
                  <div className="text-[10px] text-[#bbb] mt-1">{t.submittedBy} {t.submittedEmail && `· ${t.submittedEmail}`} · {timeAgo(t.createdAt)}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Drawer */}
      {selectedTicket && (
        <TicketDrawer ticket={selectedTicket} onClose={() => { setSelectedTicket(null); refresh(); }} onUpdate={(updates) => {
          updateTicket(selectedTicket.id, updates);
          setSelectedTicket({ ...selectedTicket, ...updates });
          refresh();
        }} onDelete={() => {
          deleteTicket(selectedTicket.id);
          setSelectedTicket(null);
          refresh();
        }} />
      )}
    </AppShell>
  );
}

/* ── Ticket Detail Drawer ── */
function TicketDrawer({ ticket, onClose, onUpdate, onDelete }: {
  ticket: SupportTicket;
  onClose: () => void;
  onUpdate: (updates: Partial<SupportTicket>) => void;
  onDelete: () => void;
}) {
  const [adminNote, setAdminNote] = useState(ticket.adminNote || "");

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[9999] flex flex-col">
        <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#eaeaea] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#111]">Ticket Details</span>
          <button onClick={onClose} className="p-2 text-[#999] hover:text-[#555] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Subject + Message */}
          <div className="mb-6">
            <h3 className="text-[16px] font-bold text-[#111] mb-2">{ticket.subject}</h3>
            <div className="bg-[#fafafa] rounded-xl p-4 text-[13px] text-[#555] leading-relaxed border border-[#f0f0f0]">{ticket.message}</div>
          </div>

          {/* Info */}
          <div className="mb-6 space-y-2.5">
            <div className="flex justify-between text-[13px]"><span className="text-[#999]">Submitted by</span><span className="text-[#111] font-medium">{ticket.submittedBy}</span></div>
            {ticket.submittedEmail && <div className="flex justify-between text-[13px]"><span className="text-[#999]">Email</span><span className="text-[#111]">{ticket.submittedEmail}</span></div>}
            <div className="flex justify-between text-[13px]"><span className="text-[#999]">Created</span><span className="text-[#111]">{new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
          </div>

          {/* Admin Controls */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wide mb-3">Admin Actions</div>

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Status</label>
              <select value={ticket.status} onChange={(e) => onUpdate({ status: e.target.value as SupportTicket["status"] })}
                className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E]">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Priority</label>
              <select value={ticket.priority} onChange={(e) => onUpdate({ priority: e.target.value as SupportTicket["priority"] })}
                className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E]">
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Admin Note</label>
              <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                onBlur={() => onUpdate({ adminNote })}
                placeholder="Internal notes about this ticket..."
                rows={3} className="w-full px-3 py-2.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] resize-none placeholder:text-[#bbb]" />
              <p className="text-[10px] text-[#bbb] mt-1">Auto-saves when you click outside.</p>
            </div>

            <button onClick={() => { if (confirm("Delete this ticket?")) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#7A5252] hover:bg-[#F6EDED] rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete ticket
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
