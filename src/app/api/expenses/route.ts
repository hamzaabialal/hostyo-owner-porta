/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { queryDatabase, getProp, DB } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!DB.expenses) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    const pages = await queryDatabase(
      DB.expenses,
      undefined,
      [{ property: "Submitted At", direction: "descending" }]
    );

    const expenses = pages.map((p: any) => ({
      id: (p as { id: string }).id,
      expenseId: getProp(p, "Expense ID") || "",
      date: getProp(p, "Submitted At") || getProp(p, "Date") || "",
      property: getProp(p, "Property") || "",
      reservation: getProp(p, "Reservation") || "",
      category: getProp(p, "Category") || "",
      vendor: getProp(p, "Vendor") || "",
      amount: getProp(p, "Amount") || 0,
      status: getProp(p, "Status") || "Submitted",
      description: getProp(p, "Description") || "",
      proof: getProp(p, "Photo / Attachment") || [],
      receipt: getProp(p, "Receipt") || [],
      deducted: getProp(p, "Deducted from Payout?") || false,
      causedHold: getProp(p, "Caused On Hold?") || false,
      createdBalance: getProp(p, "Created Owner Balance?") || false,
      payoutCycle: getProp(p, "Linked Payout Cycle") || "",
      vendorNotes: getProp(p, "Vendor Notes") || "",
    }));

    return NextResponse.json({ source: "notion", data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
