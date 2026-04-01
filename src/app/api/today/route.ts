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
    case "date": return p.date?.start || "";
    case "formula":
      if (p.formula.type === "number") return p.formula.number;
      return null;
    default: return null;
  }
}

async function fetchTodayData() {
  const today = new Date().toISOString().split("T")[0];

  // Arrivals: Check In = today, not cancelled
  const arrRes = await notion.databases.query({
    database_id: DB_ID,
    filter: {
      and: [
        { property: "Check In", date: { equals: today } },
        { property: "Deleted", checkbox: { equals: false } },
        { property: "Status", select: { does_not_equal: "Cancelled" } },
      ],
    },
  });

  const arrivals = arrRes.results.map((p: any) => ({
    guest: prop(p, "Guest"),
    property: prop(p, "Property"),
    guests: (prop(p, "Adults") || 0) + (prop(p, "Children") || 0),
    channel: prop(p, "Channel") || "Direct",
  }));

  // Departures: Check Out = today, not cancelled
  const depRes = await notion.databases.query({
    database_id: DB_ID,
    filter: {
      and: [
        { property: "Check Out", date: { equals: today } },
        { property: "Deleted", checkbox: { equals: false } },
        { property: "Status", select: { does_not_equal: "Cancelled" } },
      ],
    },
  });

  const departures = depRes.results.map((p: any) => ({
    guest: prop(p, "Guest"),
    property: prop(p, "Property"),
    guests: (prop(p, "Adults") || 0) + (prop(p, "Children") || 0),
    channel: prop(p, "Channel") || "Direct",
  }));

  // Upcoming: Check In > today, next 3
  const upRes = await notion.databases.query({
    database_id: DB_ID,
    filter: {
      and: [
        { property: "Check In", date: { after: today } },
        { property: "Deleted", checkbox: { equals: false } },
        { property: "Status", select: { does_not_equal: "Cancelled" } },
      ],
    },
    sorts: [{ property: "Check In", direction: "ascending" }],
    page_size: 3,
  });

  const upcoming = upRes.results.map((p: any) => {
    const ci = prop(p, "Check In")?.split("T")[0] || "";
    const co = prop(p, "Check Out")?.split("T")[0] || "";
    const formatDate = (d: string) => {
      if (!d) return "";
      const date = new Date(d);
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    };
    return {
      guest: prop(p, "Guest"),
      property: prop(p, "Property"),
      dates: `${formatDate(ci)} – ${formatDate(co)}`,
      amount: `£${(prop(p, "Revenue") || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      channel: prop(p, "Channel") || "Direct",
    };
  });

  // Payment summary — paginate through all reservations
  const allPages: any[] = [];
  let paymentCursor: string | undefined = undefined;
  do {
    const payRes: any = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: "Deleted", checkbox: { equals: false } },
      start_cursor: paymentCursor,
      page_size: 100,
    });
    allPages.push(...payRes.results);
    paymentCursor = payRes.has_more ? payRes.next_cursor : undefined;
  } while (paymentCursor);

  let paidThisMonth = 0;
  let pendingPayment = 0; // Completed + Pending payout
  let balance = 0; // In-House payout total
  let forecast = 0; // Future reservations (Pending status)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayStr = today;

  allPages.forEach((p: any) => {
    const status = prop(p, "Status");
    const payoutStatus = prop(p, "Payout Status");
    const ownerPayout = prop(p, "Owner Payout") || 0;
    const checkout = (prop(p, "Check Out") || "").split("T")[0];
    const checkin = (prop(p, "Check In") || "").split("T")[0];

    // Paid this month
    if (payoutStatus === "Paid" && checkout.startsWith(thisMonth)) {
      paidThisMonth += ownerPayout;
    }

    // Balance = In-House reservation payout total
    if (status === "In-House") {
      balance += ownerPayout;
    }

    // Pending Payment = Completed status + Pending payout status
    if (status === "Completed" && payoutStatus === "Pending") {
      pendingPayment += ownerPayout;
    }

    // Forecast = future reservations not cancelled
    if (checkin > todayStr && status !== "Cancelled" && payoutStatus !== "Paid") {
      forecast += ownerPayout;
    }
  });

  const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    arrivals,
    departures,
    upcoming,
    payment: {
      balance: fmt(balance),
      paidThisMonth: fmt(paidThisMonth),
      pending: fmt(pendingPayment),
      forecast: fmt(forecast),
    },
  };
}

export async function GET() {
  if (!DB_ID) {
    return NextResponse.json({ arrivals: [], departures: [], upcoming: [], payment: { balance: "£0", paidThisMonth: "£0", pending: "£0" } });
  }

  try {
    const data = await cached("today", fetchTodayData);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching today:", error?.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
