/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { decodeToken, isPropertyToken, decodePropertyToken } from "@/lib/token";

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
    case "date": return p.date?.start || "";
    case "formula":
      if (p.formula.type === "string") return p.formula.string || "";
      if (p.formula.type === "number") return p.formula.number;
      return null;
    default: return null;
  }
}

/** GET — fetch reservation/property context for the vendor form */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    // Property-only submission (not tied to a reservation)
    if (isPropertyToken(token)) {
      const propertyName = decodePropertyToken(token);
      return NextResponse.json({
        ok: true,
        isPropertyOnly: true,
        reservation: {
          id: "",
          ref: "",
          property: propertyName,
          guest: "",
          checkin: "",
          checkout: "",
          channel: "",
        },
      });
    }

    // Reservation-based submission
    const pageId = decodeToken(token);
    const page = await notion.pages.retrieve({ page_id: pageId }) as any;

    return NextResponse.json({
      ok: true,
      reservation: {
        id: page.id,
        ref: prop(page, "Reservation Code") || prop(page, "Name") || "",
        property: prop(page, "Property") || "",
        guest: prop(page, "Guest") || "",
        checkin: (prop(page, "Check In") || "").split("T")[0],
        checkout: (prop(page, "Check Out") || "").split("T")[0],
        channel: prop(page, "Channel") || "",
      },
    });
  } catch (error: any) {
    console.error("Submit GET error:", error?.message);
    if (error?.code === "object_not_found") {
      return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 400 });
  }
}

/** POST — create expense record in Notion */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!EXPENSES_DB) {
    return NextResponse.json({ ok: false, error: "Expenses database not configured. Please add NOTION_EXPENSES_DB to environment variables." }, { status: 500 });
  }

  try {
    let reservationRef = "";
    let propertyName = "";

    if (isPropertyToken(token)) {
      // Property-only submission
      propertyName = decodePropertyToken(token);
    } else {
      // Reservation-based submission
      let pageId: string;
      try {
        pageId = decodeToken(token);
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid token format" }, { status: 400 });
      }
      let page: any;
      try {
        page = await notion.pages.retrieve({ page_id: pageId });
      } catch (e: any) {
        console.error("Reservation lookup failed:", e?.message);
        return NextResponse.json({ ok: false, error: "Reservation not found: " + (e?.message || "unknown") }, { status: 404 });
      }
      reservationRef = prop(page, "Reservation Code") || prop(page, "Name") || "";
      propertyName = prop(page, "Property") || "";
    }

    const body = await req.json();
    const { category, description, amount, vendorName, status: workStatus, photoUrls, receiptUrls } = body;

    // Validation — description is optional, amount is set by admin

    // Build expense ID
    const expenseId = `VEXP-${Date.now()}`;

    // Build Notion properties
    const properties: any = {
      "Expense ID": { title: [{ text: { content: expenseId } }] },
      "Created": { date: { start: new Date().toISOString().split("T")[0] } },
      "Amount": { rich_text: [{ text: { content: String(parseFloat(amount || "0").toFixed(2)) } }] },
    };

    if (reservationRef) {
      properties["Reservation ID"] = { rich_text: [{ text: { content: reservationRef } }] };
    }

    // Category (select) — only set if provided
    if (category) {
      properties["Category "] = { select: { name: category } };
    }

    // Property (select) — use the reservation's property
    if (propertyName) {
      properties["Property"] = { select: { name: propertyName } };
    }

    // Status
    if (workStatus) {
      properties["Status "] = { status: { name: workStatus } };
    }

    // Vendor Name
    if (vendorName?.trim()) {
      properties["Vendor Name"] = { rich_text: [{ text: { content: vendorName.trim() } }] };
    }

    // Description — save to both Description and Notes fields
    if (description?.trim()) {
      properties["Description"] = { rich_text: [{ text: { content: description.trim() } }] };
      properties["Notes"] = { rich_text: [{ text: { content: description.trim() } }] };
    }

    // Work category — save to work category rich_text field too
    if (category) {
      properties["work category"] = { rich_text: [{ text: { content: category } }] };
    }

    // Proof files — save all real URLs to Notion (filter out data: URLs)
    const allFiles = [
      ...(photoUrls || []).filter((u: string) => u && !u.startsWith("data:")).map((url: string, i: number) => ({
        type: "external" as const,
        name: `Photo ${i + 1}`,
        external: { url },
      })),
      ...(receiptUrls || []).filter((u: string) => u && !u.startsWith("data:")).map((url: string, i: number) => ({
        type: "external" as const,
        name: `Receipt ${i + 1}`,
        external: { url },
      })),
    ];

    if (allFiles.length > 0) {
      properties["Proof "] = { files: allFiles };
    }

    // Create the page
    await notion.pages.create({
      parent: { database_id: EXPENSES_DB },
      properties,
    });

    // Invalidate expenses cache so the new expense shows immediately
    try {
      const { invalidate } = await import("@/lib/cache");
      invalidate("expenses");
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, expenseId });
  } catch (error: any) {
    console.error("Submit POST error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Submission failed" }, { status: 500 });
  }
}
