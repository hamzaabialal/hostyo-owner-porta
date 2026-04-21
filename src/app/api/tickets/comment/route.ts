/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserScope } from "@/lib/scope";
import { findTicketById, updateTicket, pageToTicket, type TicketComment } from "@/lib/notion-tickets";

export const dynamic = "force-dynamic";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** POST — add a comment to a ticket (stored as JSON on the Notion page). */
export async function POST(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ticketId, message, authorName, authorImage, attachments } = body;
    if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

    const page = await findTicketById(ticketId);
    if (!page) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const current = pageToTicket(page);

    // Permission: owner can only comment on their own tickets
    if (!scope.isAdmin && (current.submittedEmail || "").toLowerCase() !== scope.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // If commenter IS the ticket submitter → "User" voice. Otherwise → "Admin" voice.
    const isTicketOwner = (current.submittedEmail || "").toLowerCase() === scope.email;
    const commentAuthor: "User" | "Admin" = isTicketOwner ? "User" : "Admin";

    const comment: TicketComment = {
      id: generateId(),
      author: commentAuthor,
      authorName: authorName || (isTicketOwner ? (current.submittedBy || "User") : "Admin"),
      authorEmail: scope.email,
      authorImage: authorImage || (isTicketOwner ? current.submittedImage : "") || "",
      message: String(message || "").trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: now,
    };

    const updatedComments = [...(current.comments || []), comment];

    await updateTicket(ticketId, {
      comments: updatedComments,
      ...(isTicketOwner ? { lastReadByUser: now } : { lastReadByAdmin: now }),
    });

    const fresh = await findTicketById(ticketId);
    return NextResponse.json({
      ok: true,
      comment,
      ticket: fresh ? pageToTicket(fresh) : { ...current, comments: updatedComments, updatedAt: now },
    });
  } catch (err) {
    console.error("POST /api/tickets/comment failed:", err);
    const message = err instanceof Error ? err.message : "Failed to post comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
