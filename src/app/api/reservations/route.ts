/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_ID = process.env.NOTION_RESERVATIONS_DB || "";

function prop(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "number": return p.number;
    case "select": return p.select?.name || "";
    case "status": return p.status?.name || "";
    case "date": return p.date?.start || "";
    case "checkbox": return p.checkbox;
    case "formula":
      if (p.formula.type === "number") return p.formula.number;
      if (p.formula.type === "string") return p.formula.string;
      return null;
    case "email": return p.email || "";
    case "phone_number": return p.phone_number || "";
    default: return null;
  }
}

async function fetchReservations() {
  const allPages: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res: any = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: "Deleted", checkbox: { equals: false } },
      sorts: [{ property: "Check In", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    allPages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return allPages.map((page: any, i: number) => {
    const checkin = prop(page, "Check In") || "";
    const checkout = prop(page, "Check Out") || "";
    let nights = 0;
    if (checkin && checkout) {
      const ci = new Date(checkin);
      const co = new Date(checkout);
      nights = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      id: i + 1,
      notionId: page.id,
      ref: prop(page, "Reservation Code") || "",
      property: prop(page, "Property") || "",
      guest: prop(page, "Guest") || "",
      channel: prop(page, "Channel") || "Direct",
      checkin: checkin.split("T")[0],
      checkout: checkout.split("T")[0],
      nights,
      status: prop(page, "Status") || "Pending",
      grossAmount: prop(page, "Revenue") || 0,
      platformFee: prop(page, "Platform Commission") || 0,
      netBooking: prop(page, "Net Booking") || 0,
      managementFee: prop(page, "Management Fee") || 0,
      cleaning: prop(page, "Cleaning") || 0,
      expenses: prop(page, "Expenses") || 0,
      ownerPayout: prop(page, "Owner Payout") || 0,
      payoutStatus: prop(page, "Payout Status") || "Pending",
      payoutError: prop(page, "Error Reason") || prop(page, "Payout Error") || prop(page, "Error Message") || prop(page, "Error") || "",
      deficitAdjustment: prop(page, "Deficit Adjustment") || 0,
      deficitSource: prop(page, "Deficit Source") || "",
      adjustedPayout: prop(page, "Adjusted Payout") || 0,
      adults: prop(page, "Adults") || 0,
      children: prop(page, "Children") || 0,
      infants: prop(page, "Infants") || 0,
      email: prop(page, "Email") || "",
      phone: prop(page, "Phone") || "",
      bookedOn: prop(page, "Booked On") || "",
    };
  });
}

export async function GET(req: Request) {
  if (!DB_ID) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    // Force fresh data if ?fresh=1
    const url = new URL(req.url);
    if (url.searchParams.get("fresh") === "1") {
      const { invalidate } = await import("@/lib/cache");
      invalidate("reservations");
    }
    const reservations = await cached("reservations", fetchReservations);
    return NextResponse.json({ source: "notion", data: reservations });
  } catch (error: any) {
    console.error("Error fetching reservations:", error?.message);
    return NextResponse.json({ error: "Failed to fetch", detail: error?.message }, { status: 500 });
  }
}
