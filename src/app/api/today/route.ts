/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { cached } from "@/lib/cache";
import { getUserScope, isInScope } from "@/lib/scope";

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
  let pendingPayment = 0;
  let balance = 0;
  let forecast = 0;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayStr = today;

  // In-house guests (checked in, not checked out yet)
  const inHouse: any[] = [];
  // Next arrivals (checkin > today)
  const nextArrivals: any[] = [];

  allPages.forEach((p: any) => {
    const status = prop(p, "Status");
    const payoutStatus = prop(p, "Payout Status");
    const ownerPayout = prop(p, "Owner Payout") || 0;
    const checkout = (prop(p, "Check Out") || "").split("T")[0];
    const checkin = (prop(p, "Check In") || "").split("T")[0];
    const channel = prop(p, "Channel") || "Direct";
    const guest = prop(p, "Guest") || "";
    const property = prop(p, "Property") || "";
    const nights = prop(p, "Nights") || 0;

    if (payoutStatus === "Paid" && checkout.startsWith(thisMonth)) paidThisMonth += ownerPayout;
    if (status === "In-House") balance += ownerPayout;
    const psLower = (payoutStatus || "").toLowerCase();
    if (status === "Completed" && (psLower === "pending" || psLower === "on hold")) pendingPayment += ownerPayout;
    if (checkin > todayStr && status !== "Cancelled" && payoutStatus !== "Paid") forecast += ownerPayout;

    // In-house: checked in <= today && checkout >= today && not cancelled
    // (includes departing today: checkout === today, daysLeft = 0)
    if (checkin <= todayStr && checkout >= todayStr && status !== "Cancelled") {
      const daysLeft = Math.ceil((new Date(checkout + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
      inHouse.push({ guest, property, channel, checkout, daysLeft, nights });
    }

    // Next arrivals: checkin >= today && not cancelled
    // (includes arriving today: checkin === today, daysAway = 0)
    if (checkin >= todayStr && status !== "Cancelled") {
      const daysAway = Math.ceil((new Date(checkin + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
      const formatDate = (d: string) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
      nextArrivals.push({ guest, property, channel, checkin, daysAway, date: formatDate(checkin) });
    }
  });

  // Sort in-house by days left ascending, next arrivals by days away ascending
  inHouse.sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  nextArrivals.sort((a: any, b: any) => a.daysAway - b.daysAway);

  const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return {
    arrivals,
    departures,
    upcoming,
    inHouse: inHouse.slice(0, 6),
    nextArrivals: nextArrivals.slice(0, 6),
    payment: {
      balance: fmt(balance),
      paidThisMonth: fmt(paidThisMonth),
      pending: fmt(pendingPayment),
      forecast: fmt(forecast),
    },
  };
}

export async function GET(req: NextRequest) {
  if (!DB_ID) {
    return NextResponse.json({ arrivals: [], departures: [], upcoming: [], payment: { balance: "£0", paidThisMonth: "£0", pending: "£0" } });
  }

  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // The fetchTodayData builds an aggregate response. For owners we need
    // to filter property-scoped lists AND recompute the payment totals.
    // Simplest path: if not admin, fetch the raw reservations and rebuild.
    const data: any = await cached("today", fetchTodayData);

    if (scope.isAdmin) {
      return NextResponse.json(data);
    }

    // For owners: compute EVERYTHING fresh from paginated Notion data.
    // This avoids stale cache issues and ensures scope filtering is accurate.
    const thisMonth = new Date().toISOString().slice(0, 7);
    const todayStr = new Date().toISOString().split("T")[0];
    const allPages: any[] = [];
    let cursor: string | undefined = undefined;
    do {
      const payRes: any = await notion.databases.query({
        database_id: DB_ID,
        filter: { property: "Deleted", checkbox: { equals: false } },
        start_cursor: cursor,
        page_size: 100,
      });
      allPages.push(...payRes.results);
      cursor = payRes.has_more ? payRes.next_cursor : undefined;
    } while (cursor);

    let balance = 0, paidThisMonth = 0, pending = 0, forecast = 0;
    const inHouse: any[] = [];
    const nextArrivals: any[] = [];
    const arrivals: any[] = [];
    const departures: any[] = [];

    for (const p of allPages) {
      const propertyName = prop(p, "Property") || "";
      if (!isInScope(scope, propertyName)) continue;

      const status = prop(p, "Status");
      const payoutStatus = prop(p, "Payout Status");
      const ownerPayout = prop(p, "Owner Payout") || 0;
      const checkin = (prop(p, "Check In") || "").split("T")[0];
      const checkout = (prop(p, "Check Out") || "").split("T")[0];
      const channel = prop(p, "Channel") || "Direct";
      const guest = prop(p, "Guest") || "";
      const nights = prop(p, "Nights") || 0;
      const psLower = (payoutStatus || "").toLowerCase();

      // Payment totals
      if (payoutStatus === "Paid" && checkout.startsWith(thisMonth)) paidThisMonth += ownerPayout;
      if (status === "Completed" && (psLower === "pending" || psLower === "on hold")) { balance += ownerPayout; pending += ownerPayout; }
      if (checkin > todayStr && status !== "Cancelled" && payoutStatus !== "Paid") forecast += ownerPayout;

      // In-house: checked in <= today && checkout >= today && not cancelled
      if (checkin <= todayStr && checkout >= todayStr && status !== "Cancelled") {
        const daysLeft = Math.ceil((new Date(checkout + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
        inHouse.push({ guest, property: propertyName, channel, checkout, daysLeft, nights });
      }

      // Next arrivals: checkin >= today && not cancelled
      if (checkin >= todayStr && status !== "Cancelled") {
        const daysAway = Math.ceil((new Date(checkin + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
        const fmtDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
        nextArrivals.push({ guest, property: propertyName, channel, checkin, daysAway, date: fmtDate(checkin) });
      }

      // Arrivals today
      if (checkin === todayStr && status !== "Cancelled") {
        arrivals.push({ guest, property: propertyName, guests: 0, channel });
      }
      // Departures today
      if (checkout === todayStr && status !== "Cancelled") {
        departures.push({ guest, property: propertyName, channel });
      }
    }

    inHouse.sort((a: any, b: any) => a.daysLeft - b.daysLeft);
    nextArrivals.sort((a: any, b: any) => a.daysAway - b.daysAway);

    const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    return NextResponse.json({
      arrivals,
      departures,
      upcoming: nextArrivals.slice(0, 3),
      inHouse: inHouse.slice(0, 6),
      nextArrivals,
      payment: {
        balance: fmt(balance),
        paidThisMonth: fmt(paidThisMonth),
        pending: fmt(pending),
        forecast: fmt(forecast),
      },
    });
  } catch (error: any) {
    console.error("Error fetching today:", error?.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
