// Client-side support ticket store (localStorage)

export interface TicketComment {
  id: string;
  author: string;        // "User" or "Admin"
  authorName: string;
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
  createdAt: string;
  updatedAt: string;
  adminNote: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
}

const STORAGE_KEY = "hostyo_tickets";

export function getTickets(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tickets = raw ? JSON.parse(raw) : [];
    // Migration: add comments/attachments arrays to old tickets
    return tickets.map((t: SupportTicket) => ({
      ...t,
      comments: t.comments || [],
      attachments: t.attachments || [],
    }));
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
