/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { queryDatabase, getProp, DB } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!DB.properties) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    const pages = await queryDatabase(DB.properties);

    const properties = pages.map((p: any) => ({
      id: (p as { id: string }).id,
      propertyId: getProp(p, "Property ID") || "",
      name: getProp(p, "Property Name") || "",
      status: getProp(p, "Status") || "Active",
      ownerBalance: getProp(p, "Current Owner Balance") || 0,
      upcomingPayout: getProp(p, "Upcoming Payout Amount") || 0,
      payoutStatus: getProp(p, "Payout Status") || "",
      lastPayoutDate: getProp(p, "Last Payout Date") || "",
    }));

    return NextResponse.json({ source: "notion", data: properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
