/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { getUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

interface TicketAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface TicketComment {
  id: string;
  author: "User" | "Admin";
  authorName: string;
  authorEmail?: string;
  authorImage?: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

interface SupportTicket {
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

const META_KEY = "tickets/_meta.json";

async function readTickets(): Promise<SupportTicket[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "tickets/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    const url = blobs.blobs[0].url + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("readTickets error:", err);
    return [];
  }
}

async function writeTickets(tickets: SupportTicket[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(META_KEY, JSON.stringify(tickets), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    // Disable CDN caching so reads always get the latest content
    cacheControlMaxAge: 0,
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** GET — list tickets (admin sees all, owners see their own) */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await readTickets();
  const filtered = scope.isAdmin ? all : all.filter((t) => (t.submittedEmail || "").toLowerCase() === scope.email);
  return NextResponse.json({ ok: true, data: filtered });
}

/** POST — create a new ticket */
export async function POST(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subject, message, submittedBy, submittedImage, attachments } = body;

  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const all = await readTickets();
  const now = new Date().toISOString();
  const newTicket: SupportTicket = {
    id: generateId(),
    subject: String(subject).trim(),
    message: String(message).trim(),
    status: "Open",
    priority: "Medium",
    submittedBy: submittedBy || "User",
    submittedEmail: scope.email,  // always trust the auth token
    submittedImage: submittedImage || "",
    createdAt: now,
    updatedAt: now,
    adminNote: "",
    comments: [],
    attachments: attachments || [],
    lastReadByUser: now,
  };
  all.unshift(newTicket);
  await writeTickets(all);

  return NextResponse.json({ ok: true, ticket: newTicket });
}

/** PATCH — update ticket (status, priority, note, read tracking) */
export async function PATCH(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, priority, adminNote, markRead } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const all = await readTickets();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const t = all[idx];

  // Permission check — owner can only patch their own tickets' read state
  if (!scope.isAdmin && (t.submittedEmail || "").toLowerCase() !== scope.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Non-admins can only update read state
  if (!scope.isAdmin && (status !== undefined || priority !== undefined || adminNote !== undefined)) {
    return NextResponse.json({ error: "Forbidden — admin only fields" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const updated: SupportTicket = {
    ...t,
    ...(scope.isAdmin && status !== undefined ? { status } : {}),
    ...(scope.isAdmin && priority !== undefined ? { priority } : {}),
    ...(scope.isAdmin && adminNote !== undefined ? { adminNote } : {}),
    ...(markRead === "user" ? { lastReadByUser: now } : {}),
    ...(markRead === "admin" && scope.isAdmin ? { lastReadByAdmin: now } : {}),
    updatedAt: status !== undefined || priority !== undefined ? now : t.updatedAt,
  };
  all[idx] = updated;
  await writeTickets(all);

  return NextResponse.json({ ok: true, ticket: updated });
}

/** DELETE — admin only */
export async function DELETE(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const all = await readTickets();
  const filtered = all.filter((t) => t.id !== id);
  await writeTickets(filtered);

  return NextResponse.json({ ok: true });
}
