// Client-side support ticket store (localStorage)
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
}

const STORAGE_KEY = "hostyo_tickets";

export function getTickets(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addTicket(ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status" | "priority" | "adminNote">): SupportTicket {
  const tickets = getTickets();
  const newTicket: SupportTicket = {
    ...ticket,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    status: "Open",
    priority: "Medium",
    adminNote: "",
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

export function deleteTicket(id: string) {
  const tickets = getTickets().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}
