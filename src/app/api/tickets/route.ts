/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserScope } from "@/lib/scope";
import {
  listTickets, findTicketById, createTicket, updateTicket, deleteTicketPage,
  pageToTicket, type SupportTicket,
} from "@/lib/notion-tickets";

export const dynamic = "force-dynamic";

/** GET — list tickets (admin sees all; owners see their own). */
export async function GET(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pages = await listTickets();
    const all = pages.map(pageToTicket);
    const filtered = scope.isAdmin
      ? all
      : all.filter((t) => (t.submittedEmail || "").toLowerCase() === scope.email);
    return NextResponse.json({ ok: true, data: filtered });
  } catch (err) {
    console.error("GET /api/tickets failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — create a new ticket. */
export async function POST(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { subject, message, submittedBy, submittedImage, attachments } = body;
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const page = await createTicket({
      subject: String(subject).trim(),
      message: String(message).trim(),
      submittedBy: submittedBy || "User",
      submittedEmail: scope.email,      // always trust the auth token
      submittedImage: submittedImage || undefined,
      attachments: Array.isArray(attachments) ? attachments : [],
    });
    return NextResponse.json({ ok: true, ticket: pageToTicket(page) });
  } catch (err) {
    console.error("POST /api/tickets failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — update ticket (status/priority/adminNote admin-only; markRead anyone). */
export async function PATCH(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, status, priority, adminNote, markRead } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const page = await findTicketById(id);
    if (!page) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const current = pageToTicket(page);

    // Permission: owner can only patch their own tickets' read state
    if (!scope.isAdmin && (current.submittedEmail || "").toLowerCase() !== scope.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Non-admins can only mark read
    if (!scope.isAdmin && (status !== undefined || priority !== undefined || adminNote !== undefined)) {
      return NextResponse.json({ error: "Forbidden — admin only fields" }, { status: 403 });
    }

    const updates: Partial<SupportTicket> = {};
    if (scope.isAdmin && status !== undefined) updates.status = status;
    if (scope.isAdmin && priority !== undefined) updates.priority = priority;
    if (scope.isAdmin && adminNote !== undefined) updates.adminNote = adminNote;
    const nowIso = new Date().toISOString();
    if (markRead === "user") updates.lastReadByUser = nowIso;
    if (markRead === "admin" && scope.isAdmin) updates.lastReadByAdmin = nowIso;

    if (Object.keys(updates).length > 0) {
      await updateTicket(id, updates);
    }

    const fresh = await findTicketById(id);
    return NextResponse.json({ ok: true, ticket: fresh ? pageToTicket(fresh) : current });
  } catch (err) {
    console.error("PATCH /api/tickets failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — admin only (archives the Notion page). */
export async function DELETE(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteTicketPage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tickets failed:", err);
    const message = err instanceof Error ? err.message : "Failed to delete ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
