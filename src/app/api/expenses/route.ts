/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { cached, invalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function fetchExpenses() {
  const pages = await queryDatabase(
    DB.expenses,
    undefined,
    [{ property: "Created", direction: "descending" }]
  );

  return pages.filter((p: any) => {
    const expId = getProp(p, "Expense ID") || "";
    return expId.trim().length > 0;
  }).map((p: any) => {
    const amountStr = getProp(p, "Amount") || "0";
    const amount = parseFloat(amountStr.replace(/[^0-9.\-]/g, "")) || 0;

    // Proof — read from files property
    const proofProp = p.properties?.["Proof "] || p.properties?.["Proof"];
    const proofFiles = proofProp?.files || [];
    // Build full file objects (url + name) so we can split them by type
    const proofItems = proofFiles.map((f: any) => {
      const url = f.file?.url || f.external?.url || "";
      const name = (f.name || "").toString();
      return { url, name };
    }).filter((f: { url: string }) => Boolean(f.url));
    const proof = proofItems.map((f: { url: string }) => f.url);
    // Split into work photos vs. receipts/invoices based on the name prefix the
    // vendor portal uses when uploading. Anything starting with "Receipt" goes
    // to receipts; everything else (including "Photo N") is treated as a work photo.
    const receipts = proofItems
      .filter((f: { name: string }) => /^receipt/i.test(f.name))
      .map((f: { url: string }) => f.url);
    const photos = proofItems
      .filter((f: { name: string }) => !/^receipt/i.test(f.name))
      .map((f: { url: string }) => f.url);

    // Vendor
    let vendor = getProp(p, "Vendor Name") || "";
    if (!vendor) {
      const vendorPeople = p.properties?.["vendoor"]?.people || [];
      vendor = vendorPeople.map((v: any) => v.name || "").filter(Boolean).join(", ");
    }

    return {
      id: (p as { id: string }).id,
      expenseId: getProp(p, "Expense ID") || "",
      date: getProp(p, "Created") || "",
      property: getProp(p, "Property") || "",
      reservation: getProp(p, "Reservation ID") || "",
      category: getProp(p, "Category ") || getProp(p, "Category") || "",
      vendor,
      amount,
      status: getProp(p, "Status ") || getProp(p, "Status") || "Scheduled",
      proof,
      photos,
      receipts,
      description: getProp(p, "Description") || "",
      notes: getProp(p, "Notes") || "",
      workCategory: getProp(p, "work category") || "",
      deducted: (getProp(p, "Deducted?") || "").toLowerCase() === "yes",
      causedHold: (getProp(p, "Caused Hold?") || "").toLowerCase() === "yes",
    };
  });
}

export async function POST(req: Request) {
  if (!DB.expenses) {
    return NextResponse.json({ ok: false, error: "Expenses database not configured" }, { status: 500 });
  }
  try {
    const { Client } = await import("@notionhq/client");
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const body = await req.json();
    const { property, category, status, amount, vendor, notes, reservation } = body;

    const expenseId = `EXP-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    const properties: any = {
      "Expense ID": { title: [{ text: { content: expenseId } }] },
      "Created": { date: { start: today } },
    };

    if (property) properties["Property"] = { select: { name: property } };
    if (category) properties["Category "] = { select: { name: category } };
    if (status) properties["Status "] = { status: { name: status } };
    if (amount !== undefined) properties["Amount"] = { rich_text: [{ text: { content: String(parseFloat(amount) || 0) } }] };
    if (vendor) properties["Vendor Name"] = { rich_text: [{ text: { content: vendor } }] };
    if (notes) properties["Description"] = { rich_text: [{ text: { content: notes } }] };
    if (reservation) properties["Reservation ID"] = { rich_text: [{ text: { content: reservation } }] };

    await notion.pages.create({
      parent: { database_id: DB.expenses },
      properties,
    });

    // Invalidate cache
    const { invalidate } = await import("@/lib/cache");
    invalidate("expenses");

    // Refresh the affected property's Balance in Notion immediately
    if (property) {
      const { syncPropertyBalances } = await import("@/lib/sync-balances");
      await syncPropertyBalances([property]);
    }

    // If expense is linked to a reservation, sync the Expenses column on that reservation
    if (reservation) {
      const { syncReservationExpenses } = await import("@/lib/sync-balances");
      await syncReservationExpenses(reservation);
    }

    return NextResponse.json({ ok: true, expenseId });
  } catch (error: any) {
    console.error("Create expense error:", error?.message || error);
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create expense" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!DB.expenses) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    // If ?fresh=1 is passed, bypass cache completely
    const url = new URL(req.url);
    if (url.searchParams.get("fresh") === "1") {
      invalidate("expenses");
    }
    const expenses = await cached("expenses", fetchExpenses);
    return NextResponse.json({ source: "notion", data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
