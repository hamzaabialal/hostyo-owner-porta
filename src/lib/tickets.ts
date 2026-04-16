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
  url: string;           // data URL for localStorage
  type: string;          // mime type
  size: number;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High";
  submittedBy: string;
  submittedEmail: string;
  submittedImage?: string;  // profile picture URL of the user who submitted
  createdAt: string;
  updatedAt: string;
  adminNote: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
}

const STORAGE_KEY = "hostyo_tickets";

/**
 * Returns all tickets stored locally.
 *
 * Admins see everything; owners only see their own tickets (filtered by email).
 * Pass `currentEmail` to scope the result to that user. If omitted, all tickets
 * are returned (use for admin views).
 */
export function getTickets(currentEmail?: string): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tickets: SupportTicket[] = raw ? JSON.parse(raw) : [];
    // Migration: add comments/attachments arrays to old tickets
    const migrated = tickets.map((t) => ({
      ...t,
      comments: t.comments || [],
      attachments: t.attachments || [],
    }));
    if (!currentEmail) return migrated;
    const mine = currentEmail.toLowerCase().trim();
    return migrated.filter((t) => (t.submittedEmail || "").toLowerCase().trim() === mine);
  } catch { return []; }
}

export function addTicket(
  ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status" | "priority" | "adminNote" | "comments" | "attachments"> & { attachments?: TicketAttachment[] }
): SupportTicket {
  const tickets = getTickets();
  const newTicket: SupportTicket = {
    ...ticket,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    status: "Open",
    priority: "Medium",
    adminNote: "",
    comments: [],
    attachments: ticket.attachments || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tickets.unshift(newTicket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  return newTicket;
}

export function updateTicket(id: string, updates: Partial<SupportTicket>) {
  const tickets = getTickets().map((t) =>
    t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

export function addComment(ticketId: string, comment: Omit<TicketComment, "id" | "createdAt">): TicketComment {
  const tickets = getTickets();
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newComment;
}

export function deleteTicket(id: string) {
  const tickets = getTickets().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}
