/* eslint-disable @typescript-eslint/no-explicit-any */
import notion, { DB } from "./notion";

export interface TicketAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface TicketComment {
  id: string;
  author: "User" | "Admin";
  authorName: string;
  authorEmail?: string;
  authorImage?: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface SupportTicket {
  id: string;                 // Notion page id
  subject: string;
  message: string;
  status: "Open" | "In Progress" | "Closed";
  priority: "Low" | "Medium" | "High";
  submittedBy: string;
  submittedEmail: string;
  submittedImage?: string;
  adminNote: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  lastReadByUser?: string;
  lastReadByAdmin?: string;
  createdAt: string;
  updatedAt: string;
}

const txt = (s?: string) => s ? [{ type: "text" as const, text: { content: s.slice(0, 2000) } }] : [];

// Comments/attachments can get large — store compacted JSON per block (max 2000 chars).
// If it exceeds, we truncate oldest comments. Safe for typical ticket volumes.
const MAX_JSON_CHARS = 1800;
const txtJson = (value: unknown): Array<{ type: "text"; text: { content: string } }> => {
  try {
    let json = JSON.stringify(value);
    if (json.length > MAX_JSON_CHARS && Array.isArray(value)) {
      const arr = [...value];
      while (json.length > MAX_JSON_CHARS && arr.length > 0) {
        arr.shift();
        json = JSON.stringify(arr);
      }
    }
    return json.length > 0 ? [{ type: "text" as const, text: { content: json.slice(0, 2000) } }] : [];
  } catch { return []; }
};

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function pageToTicket(page: any): SupportTicket {
  const props = page.properties || {};
  const rt = (p: any) => p?.rich_text?.[0]?.plain_text || "";
  const title = (p: any) => p?.title?.[0]?.plain_text || "";
  const date = (p: any) => p?.date?.start || "";
  const status = (p: any) => p?.status?.name || "Open";
  const select = (p: any) => p?.select?.name || "";
  const email = (p: any) => p?.email || "";
  const url = (p: any) => p?.url || "";

  const statusVal = status(props["Status"]);
  const normStatus: SupportTicket["status"] =
    statusVal === "Closed" ? "Closed" :
    statusVal === "In Progress" ? "In Progress" : "Open";

  const prio = select(props["Priority"]);
  const normPrio: SupportTicket["priority"] =
    prio === "High" ? "High" :
    prio === "Low" ? "Low" : "Medium";

  return {
    id: page.id,
    subject: title(props["Name"]) || "",
    message: rt(props["Message"]) || "",
    status: normStatus,
    priority: normPrio,
    submittedBy: rt(props["Submitted By"]) || "",
    submittedEmail: email(props["Submitted Email"]) || "",
    submittedImage: url(props["Submitted Image"]) || undefined,
    adminNote: rt(props["Admin Note"]) || "",
    comments: parseJson<TicketComment[]>(rt(props["Comments JSON"]), []),
    attachments: parseJson<TicketAttachment[]>(rt(props["Attachments JSON"]), []),
    lastReadByUser: date(props["Last Read By User"]) || undefined,
    lastReadByAdmin: date(props["Last Read By Admin"]) || undefined,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

export async function listTickets() {
  if (!DB.tickets) return [];
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (notion as any).databases.query({
      database_id: DB.tickets,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function findTicketById(pageId: string) {
  if (!DB.tickets || !pageId) return null;
  try {
    const res: any = await (notion as any).pages.retrieve({ page_id: pageId });
    return res;
  } catch { return null; }
}

export async function createTicket(data: {
  subject: string;
  message: string;
  submittedBy: string;
  submittedEmail: string;
  submittedImage?: string;
  attachments?: TicketAttachment[];
  priority?: SupportTicket["priority"];
}) {
  if (!DB.tickets) throw new Error("NOTION_TICKETS_DB not configured");
  const nowIso = new Date().toISOString();
  const properties: any = {
    "Name": { title: txt(data.subject) },
    "Message": { rich_text: txt(data.message) },
    "Status": { status: { name: "Open" } },
    "Priority": { select: { name: data.priority || "Medium" } },
    "Submitted By": { rich_text: txt(data.submittedBy) },
    "Submitted Email": { email: data.submittedEmail },
    "Last Read By User": { date: { start: nowIso } },
  };
  if (data.submittedImage) properties["Submitted Image"] = { url: data.submittedImage };
  if (data.attachments && data.attachments.length > 0) {
    properties["Attachments JSON"] = { rich_text: txtJson(data.attachments) };
  }
  const page: any = await (notion as any).pages.create({
    parent: { database_id: DB.tickets },
    properties,
  });
  return page;
}

export async function updateTicket(pageId: string, updates: Partial<SupportTicket>) {
  if (!DB.tickets) throw new Error("NOTION_TICKETS_DB not configured");
  const properties: any = {};
  if (updates.status !== undefined) properties["Status"] = { status: { name: updates.status } };
  if (updates.priority !== undefined) properties["Priority"] = { select: { name: updates.priority } };
  if (updates.adminNote !== undefined) properties["Admin Note"] = { rich_text: txt(updates.adminNote) };
  if (updates.comments !== undefined) properties["Comments JSON"] = { rich_text: txtJson(updates.comments) };
  if (updates.attachments !== undefined) properties["Attachments JSON"] = { rich_text: txtJson(updates.attachments) };
  if (updates.lastReadByUser !== undefined) properties["Last Read By User"] = { date: { start: updates.lastReadByUser } };
  if (updates.lastReadByAdmin !== undefined) properties["Last Read By Admin"] = { date: { start: updates.lastReadByAdmin } };
  if (Object.keys(properties).length === 0) return null;
  await (notion as any).pages.update({ page_id: pageId, properties });
  return pageId;
}

export async function deleteTicketPage(pageId: string) {
  if (!DB.tickets) throw new Error("NOTION_TICKETS_DB not configured");
  await (notion as any).pages.update({ page_id: pageId, archived: true });
}
