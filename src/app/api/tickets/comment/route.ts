/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { getUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

const META_KEY = "tickets/_meta.json";

async function readTickets(): Promise<any[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "tickets/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    const url = blobs.blobs[0].url + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function writeTickets(tickets: any[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(META_KEY, JSON.stringify(tickets), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** POST — add a comment to a ticket */
export async function POST(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticketId, message, authorName, authorImage, attachments } = body;
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

  const all = await readTickets();
  const idx = all.findIndex((t: any) => t.id === ticketId);
  if (idx === -1) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const t = all[idx];
  // Permission: owner can only comment on their own tickets
  if (!scope.isAdmin && (t.submittedEmail || "").toLowerCase() !== scope.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const comment = {
    id: generateId(),
    author: scope.isAdmin ? "Admin" : "User",
    authorName: authorName || (scope.isAdmin ? "Admin" : "User"),
    authorEmail: scope.email,
    authorImage: authorImage || "",
    message: String(message || "").trim(),
    attachments: attachments || [],
    createdAt: now,
  };

  const updated = {
    ...t,
    comments: [...(t.comments || []), comment],
    updatedAt: now,
    // Mark the other party as "unread" implicitly by NOT updating their lastRead
    // Mark the sender as up-to-date
    ...(scope.isAdmin ? { lastReadByAdmin: now } : { lastReadByUser: now }),
  };
  all[idx] = updated;
  await writeTickets(all);

  return NextResponse.json({ ok: true, comment, ticket: updated });
}
