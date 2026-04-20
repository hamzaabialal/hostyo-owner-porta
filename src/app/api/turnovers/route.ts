/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { getUserScope } from "@/lib/scope";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export interface TurnoverPhoto {
  url: string;
  uploadedAt: string;   // server-side upload timestamp (guaranteed audit source)
  exifDateTime?: string; // original EXIF date if extracted
  deviceModel?: string;
  latitude?: number;
  longitude?: number;
  size?: number;
  name?: string;
}

export interface TurnoverIssue {
  id: string;
  category?: string;   // e.g. "Kitchen", "Bedroom 1"
  title?: string;      // short type label, e.g. "Broken appliance"
  description: string;
  photoUrl?: string;
  severity?: "Low" | "Medium" | "High";
  createdAt: string;
  categoryId?: string;
  subcategoryId?: string;
  itemId?: string;
  resolved?: boolean;
}

export interface TurnoverRecord {
  id: string;                // "<propertyId>__<departureDate>"
  propertyId: string;
  propertyName?: string;
  propertyBedrooms?: number;
  propertyBathrooms?: number;
  propertyLocation?: string;
  propertyCoverUrl?: string;
  departureDate: string;
  status: "Pending" | "In progress" | "Submitted" | "Completed";
  items: Record<string, TurnoverPhoto[]>;
  issues: TurnoverIssue[];
  notes?: string;
  // Cleaner assignment
  cleanerName?: string;
  cleanerToken?: string;     // Random token for unique public URL
  cleanerLinkExpired?: boolean;
  // Timer
  timerStartedAt?: string;
  timerStoppedAt?: string;
  timerDurationSec?: number; // only set when stopped
  // Tracking
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
}

const META_KEY = "turnovers/_meta.json";

async function readAll(): Promise<TurnoverRecord[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "turnovers/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    const url = blobs.blobs[0].url + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function writeAll(records: TurnoverRecord[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN env var is not configured");
  }
  await put(META_KEY, JSON.stringify(records), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

function recordId(propertyId: string, departureDate: string): string {
  return `${propertyId}__${departureDate}`;
}

/** GET — fetch turnover(s). Admin only. */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const propertyId = url.searchParams.get("propertyId");
  const departureDate = url.searchParams.get("departureDate");
  const issues = url.searchParams.get("issues");

  const all = await readAll();

  // All issues across turnovers, surfaced for the Issues tab
  if (issues === "1") {
    const allIssues: Array<TurnoverIssue & { propertyId: string; propertyName?: string; propertyLocation?: string; propertyCoverUrl?: string; departureDate: string }> = [];
    for (const r of all) {
      for (const iss of r.issues || []) {
        allIssues.push({
          ...iss,
          propertyId: r.propertyId,
          propertyName: r.propertyName,
          propertyLocation: r.propertyLocation,
          propertyCoverUrl: r.propertyCoverUrl,
          departureDate: r.departureDate,
        });
      }
    }
    allIssues.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json({ ok: true, data: allIssues });
  }

  if (id) {
    return NextResponse.json({ ok: true, data: all.find((r) => r.id === id) || null });
  }
  if (propertyId && departureDate) {
    return NextResponse.json({ ok: true, data: all.find((r) => r.id === recordId(propertyId, departureDate)) || null });
  }
  return NextResponse.json({ ok: true, data: all });
}

/** POST — assign cleaner + generate link (admin only) */
export async function POST(req: NextRequest) {
  try {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const body = await req.json();
  const { propertyId, propertyName, propertyBedrooms, propertyBathrooms, propertyLocation, propertyCoverUrl, departureDate, cleanerName } = body;
  if (!propertyId || !departureDate) {
    return NextResponse.json({ error: "propertyId + departureDate required" }, { status: 400 });
  }

  const all = await readAll();
  const id = recordId(propertyId, departureDate);
  const now = new Date().toISOString();
  let record = all.find((r) => r.id === id);
  if (!record) {
    record = {
      id, propertyId, propertyName, departureDate,
      status: "Pending",
      items: {},
      issues: [],
      createdAt: now,
      updatedAt: now,
    };
    all.push(record);
  }
  record.cleanerName = cleanerName || "";
  record.cleanerToken = randomUUID();
  record.cleanerLinkExpired = false;
  record.updatedAt = now;
  if (propertyName) record.propertyName = propertyName;
  if (propertyBedrooms !== undefined) record.propertyBedrooms = propertyBedrooms;
  if (propertyBathrooms !== undefined) record.propertyBathrooms = propertyBathrooms;
  if (propertyLocation) record.propertyLocation = propertyLocation;
  if (propertyCoverUrl) record.propertyCoverUrl = propertyCoverUrl;

  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) all[idx] = record;
  await writeAll(all);
  return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    console.error("POST /api/turnovers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create turnover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — update record (admin-only fields vs cleaner-allowed fields) */
export async function PATCH(req: NextRequest) {
  try {
  const body = await req.json();
  const { propertyId, departureDate, token } = body;
  if (!propertyId || !departureDate) {
    return NextResponse.json({ error: "propertyId + departureDate required" }, { status: 400 });
  }

  // Authentication: either admin session OR cleaner token
  const scope = await getUserScope(req);
  const all = await readAll();
  const id = recordId(propertyId, departureDate);
  let record = all.find((r) => r.id === id);

  const isAdmin = scope?.isAdmin === true;

  // Admin may auto-create a record when adding an issue/note/photo against a
  // turnover that doesn't exist yet. This does NOT generate a cleanerToken —
  // that stays the job of the POST endpoint (cleaner assignment).
  if (!record && isAdmin) {
    const nowIso = new Date().toISOString();
    record = {
      id,
      propertyId,
      propertyName: body.propertyName,
      propertyBedrooms: body.propertyBedrooms,
      propertyBathrooms: body.propertyBathrooms,
      propertyLocation: body.propertyLocation,
      propertyCoverUrl: body.propertyCoverUrl,
      departureDate,
      status: "Pending",
      items: {},
      issues: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    all.push(record);
  }

  if (!record) return NextResponse.json({ error: "Turnover not found" }, { status: 404 });

  const isCleaner = !!token && record.cleanerToken === token && record.cleanerLinkExpired !== true;

  if (!isAdmin && !isCleaner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const {
    addPhoto, removePhoto,
    status, notes,
    addIssue, resolveIssue,
    startTimer, stopTimer,
    expireLink,
    approve,
  } = body;

  // ── Cleaner-allowed actions ──
  if (addPhoto && addPhoto.itemKey && addPhoto.url) {
    const photo: TurnoverPhoto = {
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
    record.items[removePhoto.itemKey] = list.filter((p) => p.url !== removePhoto.url);
    if (record.items[removePhoto.itemKey].length === 0) delete record.items[removePhoto.itemKey];
  }

  if (addIssue && addIssue.description) {
    const issue: TurnoverIssue = {
      id: randomUUID(),
      category: addIssue.category,
      title: addIssue.title,
      description: String(addIssue.description).trim(),
      photoUrl: addIssue.photoUrl || undefined,
      severity: addIssue.severity,
      createdAt: now,
      categoryId: addIssue.categoryId,
      subcategoryId: addIssue.subcategoryId,
      itemId: addIssue.itemId,
    };
    record.issues = [...(record.issues || []), issue];
  }

  if (startTimer && !record.timerStartedAt) {
    record.timerStartedAt = now;
  }

  // ── Admin-only actions ──
  if (isAdmin) {
    if (stopTimer && record.timerStartedAt && !record.timerStoppedAt) {
      record.timerStoppedAt = now;
      const durationMs = new Date(now).getTime() - new Date(record.timerStartedAt).getTime();
      record.timerDurationSec = Math.round(durationMs / 1000);
    }
    if (status) record.status = status;
    if (notes !== undefined) record.notes = notes;
    if (resolveIssue) {
      record.issues = (record.issues || []).map((i) => i.id === resolveIssue ? { ...i, resolved: true } : i);
    }
    if (expireLink) {
      record.cleanerLinkExpired = true;
    }
    if (approve) {
      record.status = "Completed";
      record.completedAt = now;
      record.cleanerLinkExpired = true;
    }
  }

  // Cleaner submitting for review
  if (isCleaner && body.submit) {
    record.status = "Submitted";
    record.submittedAt = now;
  }

  record.updatedAt = now;
  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) all[idx] = record;
  await writeAll(all);
  return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    console.error("PATCH /api/turnovers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to save turnover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
