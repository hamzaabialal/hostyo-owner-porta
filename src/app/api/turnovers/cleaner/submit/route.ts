/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const META_KEY = "turnovers/_meta.json";

async function readAll(): Promise<any[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "turnovers/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    const res = await fetch(blobs.blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

async function writeAll(records: any[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(META_KEY, JSON.stringify(records), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

/**
 * Public endpoint for cleaner actions:
 *   addPhoto, removePhoto, addIssue, startTimer, submit, updateNotes
 * Auth: cleaner token + propertyId + departureDate (must match record).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, propertyId, departureDate } = body;
    if (!token || !propertyId || !departureDate) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const all = await readAll();
    const id = `${propertyId}__${departureDate}`;
    const record = all.find((r) => r.id === id);
    if (!record || record.cleanerToken !== token || record.cleanerLinkExpired) {
      return NextResponse.json({ error: "Link is no longer valid" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { addPhoto, removePhoto, addIssue, startTimer, submit, notes } = body;

    if (addPhoto && addPhoto.itemKey && addPhoto.url) {
      const photo = {
        url: addPhoto.url,
        uploadedAt: now,
        exifDateTime: addPhoto.exifDateTime,
        deviceModel: addPhoto.deviceModel,
        latitude: addPhoto.latitude,
        longitude: addPhoto.longitude,
        size: addPhoto.size,
        name: addPhoto.name,
      };
      const existing = record.items[addPhoto.itemKey] || [];
      record.items[addPhoto.itemKey] = [...existing, photo];
      if (record.status === "Pending") record.status = "In progress";
    }

    if (removePhoto && removePhoto.itemKey) {
      const list = record.items[removePhoto.itemKey] || [];
      record.items[removePhoto.itemKey] = list.filter((p: any) => p.url !== removePhoto.url);
      if (record.items[removePhoto.itemKey].length === 0) delete record.items[removePhoto.itemKey];
    }

    if (addIssue && addIssue.description) {
      const issue = {
        id: randomUUID(),
        category: addIssue.category,
        title: addIssue.title,
        description: String(addIssue.description).trim(),
        photoUrl: addIssue.photoUrl || undefined,
        severity: addIssue.severity,
        categoryId: addIssue.categoryId,
        subcategoryId: addIssue.subcategoryId,
        itemId: addIssue.itemId,
        createdAt: now,
      };
      record.issues = [...(record.issues || []), issue];
    }

    if (startTimer && !record.timerStartedAt) {
      record.timerStartedAt = now;
      if (record.status === "Pending") record.status = "In progress";
    }

    if (notes !== undefined) {
      record.notes = String(notes);
    }

    if (submit) {
      record.status = "Submitted";
      record.submittedAt = now;
    }

    record.updatedAt = now;
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) all[idx] = record;
    await writeAll(all);

    return NextResponse.json({ ok: true, data: record });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
