/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

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

export async function GET() {
  if (!DB_ID) {
    return NextResponse.json({ arrivals: [], departures: [], upcoming: [], payment: { balance: "£0", paidThisMonth: "£0", pending: "£0" } });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Arrivals: Check In = today
    const arrRes = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        and: [
          { property: "Check In", date: { equals: today } },
          { property: "Deleted", checkbox: { equals: false } },
        ],
      },
    });

    const arrivals = arrRes.results.map((p: any) => ({
      guest: prop(p, "Guest"),
      property: prop(p, "Property"),
      guests: (prop(p, "Adults") || 0) + (prop(p, "Children") || 0),
      channel: prop(p, "Channel") || "Direct",
    }));

    // Departures: Check Out = today
    const depRes = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        and: [
          { property: "Check Out", date: { equals: today } },
          { property: "Deleted", checkbox: { equals: false } },
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
    let pending = 0;
    let balance = 0;
    const thisMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-03"

    allPages.forEach((p: any) => {
      const payoutStatus = prop(p, "Payout Status");
      const ownerPayout = prop(p, "Owner Payout") || 0;
      const checkout = (prop(p, "Check Out") || "").split("T")[0];

      if (payoutStatus === "Paid") {
        // Match checkout month to current month for "paid this month"
        if (checkout.startsWith(thisMonth)) {
          paidThisMonth += ownerPayout;
        }
        // Also count completed reservations with Paid status that checked out
        // before this month as part of total balance (already settled)
      } else if (payoutStatus === "Pending") {
        // Pending = scheduled but not yet sent
        pending += ownerPayout;
      } else if (payoutStatus === "On Hold") {
        balance += ownerPayout;
      }
    });

    // Balance = pending payouts from completed reservations (status=Completed but payout=Pending)
    let completedUnpaid = 0;
    allPages.forEach((p: any) => {
      const status = prop(p, "Status");
      const payoutStatus = prop(p, "Payout Status");
      const ownerPayout = prop(p, "Owner Payout") || 0;
      if (status === "Completed" && payoutStatus === "Pending") {
        completedUnpaid += ownerPayout;
      }
    });
    // Use completedUnpaid as balance if no On Hold exists
    if (balance === 0) balance = completedUnpaid;

    return NextResponse.json({
      arrivals,
      departures,
      upcoming,
      payment: {
        balance: `£${balance.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        paidThisMonth: `£${paidThisMonth.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        pending: `£${pending.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    });
  } catch (error: any) {
    console.error("Error fetching today:", error?.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
