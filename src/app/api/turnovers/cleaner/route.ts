/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { findTurnover, pageToTurnover } from "@/lib/notion-turnovers";
import { listIssuesForTurnover, pageToIssue } from "@/lib/notion-issues";

export const dynamic = "force-dynamic";

/**
 * Public GET endpoint for cleaners.
 * Auth: cleaner token + propertyId + departureDate (from the link).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const propertyId = url.searchParams.get("propertyId") || "";
  const departureDate = url.searchParams.get("departureDate") || "";

  if (!token || !propertyId || !departureDate) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const page = await findTurnover(propertyId, departureDate);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rec = pageToTurnover(page);
    if (!rec.cleanerToken || rec.cleanerToken !== token) {
      return NextResponse.json({ error: "Link is no longer valid" }, { status: 403 });
    }
    const issues = await listIssuesForTurnover(page.id);
    return NextResponse.json({ ok: true, data: { ...rec, issues: issues.map(pageToIssue), id: rec.compositeId } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
