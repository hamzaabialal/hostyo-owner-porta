/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { cached } from "@/lib/cache";
import { getUserScope, filterByScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

async function fetchPayouts() {
  const pages = await queryDatabase(
    DB.payoutCycles,
    undefined,
    [{ property: "Cycle Start", direction: "descending" }]
  );

  return pages.map((p: any) => ({
    id: (p as { id: string }).id,
    cycleId: getProp(p, "Payout Cycle ID") || "",
    property: getProp(p, "Property") || "",
    cycleStart: getProp(p, "Cycle Start") || "",
    cycleEnd: getProp(p, "Cycle End") || "",
    grossEarnings: getProp(p, "Gross Earnings") || 0,
    fees: getProp(p, "Fees") || 0,
    expensesDeducted: getProp(p, "Expenses Deducted") || 0,
    netEarnings: getProp(p, "Net Earnings") || 0,
    startingBalance: getProp(p, "Starting Owner Balance") || 0,
    balanceAdjustment: getProp(p, "Balance Adjustment") || 0,
    finalPayout: getProp(p, "Final Payout Amount") || 0,
    status: getProp(p, "Payout Status") || "Upcoming",
    scheduledDate: getProp(p, "Scheduled Date") || "",
    paidDate: getProp(p, "Paid Date") || "",
    holdReason: getProp(p, "Hold Reason") || "",
  }));
}

export async function GET(req: NextRequest) {
  if (!DB.payoutCycles) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payouts = await cached("payouts", fetchPayouts);
    const scoped = filterByScope(scope, payouts, (p: any) => p.property || "");
    return NextResponse.json({ source: "notion", data: scoped });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
