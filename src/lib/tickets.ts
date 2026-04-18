// Server-side ticket store (Vercel Blob via /api/tickets).
// Admins and owners share the same data source — true two-way communication.

export interface TicketComment {
  id: string;
  author: string;
  authorName: string;
  authorEmail?: string;
  authorImage?: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface TicketAttachment {
  name: string;
  url: string;
  type: string;
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
  lastReadByUser?: string;
  lastReadByAdmin?: string;
}

/** Fetch tickets from the server. Admins get all; owners get their own. */
export async function fetchTickets(): Promise<SupportTicket[]> {
  try {
    const res = await fetch("/api/tickets", { cache: "no-store" });
    const data = await res.json();
    if (data.ok && Array.isArray(data.data)) return data.data;
  } catch { /* ignore */ }
  return [];
}

/** Create a new ticket */
export async function createTicket(
  ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status" | "priority" | "adminNote" | "comments" | "submittedEmail" | "lastReadByUser" | "lastReadByAdmin"> & { attachments?: TicketAttachment[] }
): Promise<SupportTicket | null> {
  try {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticket),
    });
    const data = await res.json();
    return data.ok ? data.ticket : null;
  } catch { return null; }
}

/** Update ticket fields (admin: status/priority/adminNote; anyone: markRead) */
export async function patchTicket(
  id: string,
  updates: { status?: SupportTicket["status"]; priority?: SupportTicket["priority"]; adminNote?: string; markRead?: "user" | "admin" }
): Promise<SupportTicket | null> {
  try {
    const res = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await res.json();
    return data.ok ? data.ticket : null;
  } catch { return null; }
}

/** Add a comment to a ticket */
export async function addTicketComment(
  ticketId: string,
  comment: { message: string; authorName: string; authorImage?: string; attachments?: TicketAttachment[] }
): Promise<SupportTicket | null> {
  try {
    const res = await fetch("/api/tickets/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, ...comment }),
    });
    const data = await res.json();
    return data.ok ? data.ticket : null;
  } catch { return null; }
}

/** Mark a ticket as read by the current user */
export async function markTicketRead(id: string, as: "user" | "admin" = "user"): Promise<void> {
  try {
    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, markRead: as }),
    });
  } catch { /* ignore */ }
}

/** Delete a ticket (admin only) */
export async function deleteTicketServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/tickets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    return !!data.ok;
  } catch { return false; }
}

/** Check if an admin comment is unread by the user (for "new update" badge) */
export function hasNewUpdateForUser(ticket: SupportTicket): boolean {
  const lastRead = ticket.lastReadByUser || ticket.createdAt;
  return (ticket.comments || []).some((c) => c.author === "Admin" && c.createdAt > lastRead);
}

/** Check if a user comment is unread by the admin */
export function hasNewUpdateForAdmin(ticket: SupportTicket): boolean {
  const lastRead = ticket.lastReadByAdmin || "";
  // No read tracking yet → treat as unread if there are any user comments newer than creation
  if (!lastRead) return (ticket.comments || []).some((c) => c.author === "User");
  return (ticket.comments || []).some((c) => c.author === "User" && c.createdAt > lastRead);
}

// ── Backward-compat shims (for any components still importing the old names) ──

/** @deprecated Use fetchTickets() */
export async function getTickets(): Promise<SupportTicket[]> {
  return fetchTickets();
}

/** @deprecated Use createTicket() */
export async function addTicket(ticket: Parameters<typeof createTicket>[0]): Promise<SupportTicket | null> {
  return createTicket(ticket);
}

/** @deprecated Use patchTicket() */
export async function updateTicket(id: string, updates: Parameters<typeof patchTicket>[1]): Promise<SupportTicket | null> {
  return patchTicket(id, updates);
}

/** @deprecated Use addTicketComment() */
export async function addComment(ticketId: string, comment: { author?: string; authorName: string; authorImage?: string; message: string; attachments?: TicketAttachment[] }): Promise<SupportTicket | null> {
  return addTicketComment(ticketId, { message: comment.message, authorName: comment.authorName, authorImage: comment.authorImage, attachments: comment.attachments });
}

/** @deprecated Use deleteTicketServer() */
export async function deleteTicket(id: string): Promise<boolean> {
  return deleteTicketServer(id);
}

/** @deprecated Use hasNewUpdateForUser() */
export function hasNewUpdate(ticket: SupportTicket): boolean {
  return hasNewUpdateForUser(ticket);
}
