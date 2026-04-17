// Client-side support ticket store (localStorage)

export interface TicketComment {
  id: string;
  author: string;        // "User" or "Admin"
  authorName: string;
  authorEmail?: string;
  authorImage?: string;  // profile picture URL
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface TicketAttachment {
  name: string;
  url: string;           // Vercel Blob URL (or data URL for legacy)
  type: string;          // mime type
  size: number;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: "Open" | "In Progress" | "Closed";
  priority: "Low" | "Medium" | "High";
  submittedBy: string;
  submittedEmail: string;
  submittedImage?: string;
  createdAt: string;
  updatedAt: string;
  adminNote: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  /** ISO timestamp of when the user last read this ticket (for "new update" badge) */
  lastReadByUser?: string;
}

const STORAGE_KEY = "hostyo_tickets";

function readAll(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tickets: SupportTicket[] = raw ? JSON.parse(raw) : [];
    return tickets.map((t) => ({
      ...t,
      comments: t.comments || [],
      attachments: t.attachments || [],
    }));
  } catch { return []; }
}

function writeAll(tickets: SupportTicket[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

export function getTickets(currentEmail?: string): SupportTicket[] {
  const all = readAll();
  if (!currentEmail) return all;
  const mine = currentEmail.toLowerCase().trim();
  return all.filter((t) => (t.submittedEmail || "").toLowerCase().trim() === mine);
}

export function getTicketById(id: string): SupportTicket | null {
  return readAll().find((t) => t.id === id) || null;
}

export function addTicket(
  ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status" | "priority" | "adminNote" | "comments" | "attachments" | "lastReadByUser"> & { attachments?: TicketAttachment[] }
): SupportTicket {
  const tickets = readAll();
  const now = new Date().toISOString();
  const newTicket: SupportTicket = {
    ...ticket,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    status: "Open",
    priority: "Medium",
    adminNote: "",
    comments: [],
    attachments: ticket.attachments || [],
    createdAt: now,
    updatedAt: now,
    lastReadByUser: now,
  };
  tickets.unshift(newTicket);
  writeAll(tickets);
  return newTicket;
}

export function updateTicket(id: string, updates: Partial<SupportTicket>) {
  const tickets = readAll().map((t) =>
    t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
  );
  writeAll(tickets);
}

export function addComment(ticketId: string, comment: Omit<TicketComment, "id" | "createdAt">): TicketComment {
  const tickets = readAll();
  const newComment: TicketComment = {
    ...comment,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };
  const updated = tickets.map((t) =>
    t.id === ticketId
      ? { ...t, comments: [...(t.comments || []), newComment], updatedAt: new Date().toISOString() }
      : t
  );
  writeAll(updated);
  return newComment;
}

/** Mark a ticket as read by the user (clears "new update" badge) */
export function markTicketRead(id: string) {
  const tickets = readAll().map((t) =>
    t.id === id ? { ...t, lastReadByUser: new Date().toISOString() } : t
  );
  writeAll(tickets);
}

/** Check if a ticket has unread admin comments since the user last read it */
export function hasNewUpdate(ticket: SupportTicket): boolean {
  const lastRead = ticket.lastReadByUser || ticket.createdAt;
  return (ticket.comments || []).some(
    (c) => c.author === "Admin" && c.createdAt > lastRead
  );
}

export function deleteTicket(id: string) {
  const tickets = readAll().filter((t) => t.id !== id);
  writeAll(tickets);
}
