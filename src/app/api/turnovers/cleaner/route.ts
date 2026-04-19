/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

/**
 * Public GET endpoint for cleaners.
 * Auth: cleaner token + propertyId + departureDate (from the link).
 * Returns the turnover record + property info (bedrooms/bathrooms for the checklist).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const propertyId = url.searchParams.get("propertyId") || "";
  const departureDate = url.searchParams.get("departureDate") || "";

  if (!token || !propertyId || !departureDate) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  try {
    const blobs = await list({ prefix: "turnovers/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const res = await fetch(blobs.blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
    const all: any[] = res.ok ? await res.json() : [];
    const id = `${propertyId}__${departureDate}`;
    const record = all.find((r) => r.id === id);
    if (!record || record.cleanerToken !== token || record.cleanerLinkExpired) {
      return NextResponse.json({ error: "Link is no longer valid" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, data: record });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
