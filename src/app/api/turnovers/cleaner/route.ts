/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import notion, { getProp } from "@/lib/notion";
import { findTurnover, pageToTurnover } from "@/lib/notion-turnovers";
import { listIssuesForTurnover, pageToIssue } from "@/lib/notion-issues";

export const dynamic = "force-dynamic";

async function fetchPropertyInfo(propertyId: string) {
  try {
    const page: any = await (notion as any).pages.retrieve({ page_id: propertyId });
    // Extract cover URL (cover > Photos fallback)
    let coverUrl = "";
    if (page.cover?.type === "file") coverUrl = page.cover.file.url;
    else if (page.cover?.type === "external") coverUrl = page.cover.external.url;
    if (!coverUrl) {
      const photosProp = page.properties?.["Photos"];
      if (photosProp?.type === "files" && photosProp.files?.length > 0) {
        const first = photosProp.files[0];
        coverUrl = first.file?.url || first.external?.url || "";
      }
    }
    const city = getProp(page, "City") || "";
    const country = getProp(page, "Country") || "";
    const address = getProp(page, "Address") || "";
    return {
      propertyName: getProp(page, "Name") || "",
      propertyLocation: [city, country].filter(Boolean).join(", ") || address || "",
      propertyCoverUrl: coverUrl,
      propertyBedrooms: getProp(page, "Bedrooms") || 0,
      propertyBathrooms: getProp(page, "Bathrooms") || 0,
      livingRoom: getProp(page, "Living Room") === true,
      balcony: getProp(page, "Balcony") === true,
      hallway: getProp(page, "Hallway") === true,
      amenities: getProp(page, "Amenities") || [],
    };
  } catch { return null; }
}

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
    const [issues, propInfo] = await Promise.all([
      listIssuesForTurnover(page.id),
      fetchPropertyInfo(propertyId),
    ]);
    return NextResponse.json({
      ok: true,
      data: {
        ...rec,
        ...(propInfo || {}),
        issues: issues.map(pageToIssue),
        id: rec.compositeId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
