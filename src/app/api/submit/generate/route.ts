/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { encodeToken } from "@/lib/token";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const EXPENSES_DB = process.env.NOTION_EXPENSES_DB || "";

function prop(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "select": return p.select?.name || "";
    default: return null;
  }
}

export async function POST(req: Request) {
  try {
    const { reservationId, category, internalNote } = await req.json();
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const token = encodeToken(reservationId);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/submit/${token}`;

    // Create expense record in Notion so the vendor submission can UPDATE it
    let expensePageId = "";
    if (EXPENSES_DB) {
      try {
        const page = await notion.pages.retrieve({ page_id: reservationId }) as any;
        const reservationRef = prop(page, "Reservation Code") || prop(page, "Name") || "";
        const propertyName = prop(page, "Property") || "";

        const expenseId = `EXP-${Date.now()}`;
        const properties: any = {
          "Expense ID": { title: [{ text: { content: expenseId } }] },
          "Created": { date: { start: new Date().toISOString().split("T")[0] } },
          "Reservation ID": { rich_text: [{ text: { content: reservationRef } }] },
          "Status ": { status: { name: "Scheduled" } },
        };

        if (propertyName) properties["Property"] = { select: { name: propertyName } };
        if (category) properties["Category "] = { select: { name: category } };
        if (internalNote?.trim()) {
          properties["Description"] = { rich_text: [{ text: { content: `[Internal] ${internalNote.trim()}` } }] };
        }

        const created = await notion.pages.create({
          parent: { database_id: EXPENSES_DB },
          properties,
        });
        expensePageId = created.id;

        // Invalidate cache
        try {
          const { invalidate } = await import("@/lib/cache");
          invalidate("expenses");
        } catch { /* ignore */ }
      } catch (e: any) {
        console.error("Failed to create expense:", e?.message);
      }
    }

    return NextResponse.json({ ok: true, token, url, expensePageId });
  } catch {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
