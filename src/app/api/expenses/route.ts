/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function fetchExpenses() {
  const pages = await queryDatabase(
    DB.expenses,
    undefined,
    [{ property: "Date", direction: "descending" }]
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
    const proof = proofFiles.map((f: any) => {
      if (f.file?.url) return f.file.url;
      if (f.external?.url) return f.external.url;
      return "";
    }).filter(Boolean);

    // Vendor
    let vendor = getProp(p, "Vendor Name") || "";
    if (!vendor) {
      const vendorPeople = p.properties?.["vendoor"]?.people || [];
      vendor = vendorPeople.map((v: any) => v.name || "").filter(Boolean).join(", ");
    }

    return {
      id: (p as { id: string }).id,
      expenseId: getProp(p, "Expense ID") || "",
      date: getProp(p, "Date") || "",
      property: getProp(p, "Propertyt") || "",
      reservation: getProp(p, "Reservation ID") || "",
      category: getProp(p, "Category ") || getProp(p, "Category") || "",
      vendor,
      amount,
      status: getProp(p, "Status ") || getProp(p, "Status") || "Scheduled",
      proof,
      description: getProp(p, "Description") || "",
      notes: getProp(p, "Notes") || "",
      workCategory: getProp(p, "work category") || "",
      deducted: (getProp(p, "Deducted?") || "").toLowerCase() === "yes",
      causedHold: (getProp(p, "Caused Hold?") || "").toLowerCase() === "yes",
    };
  });
}

export async function GET() {
  if (!DB.expenses) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    const expenses = await cached("expenses", fetchExpenses);
    return NextResponse.json({ source: "notion", data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
