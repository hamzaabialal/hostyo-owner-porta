/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 25 * 1024 * 1024;

/**
 * Public upload for cleaners. Auth: cleaner token validated against the turnover record.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = String(formData.get("token") || "");
    const propertyId = String(formData.get("propertyId") || "");
    const departureDate = String(formData.get("departureDate") || "");

    if (!file) return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
    if (!token || !propertyId || !departureDate) {
      return NextResponse.json({ ok: false, error: "Missing auth params" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "File too large (max 25MB)" }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ ok: false, error: "Storage not configured" }, { status: 500 });
    }

    // Validate cleaner token
    const blobs = await list({ prefix: "turnovers/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const metaRes = await fetch(blobs.blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
    const all: any[] = metaRes.ok ? await metaRes.json() : [];
    const id = `${propertyId}__${departureDate}`;
    const record = all.find((r) => r.id === id);
    if (!record || record.cleanerToken !== token || record.cleanerLinkExpired) {
      return NextResponse.json({ ok: false, error: "Link is no longer valid" }, { status: 403 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${randomUUID()}.${ext}`;

    const blob = await put(`turnovers/${propertyId}/${filename}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      ok: true,
      url: blob.url,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
