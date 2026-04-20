/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { getUserScope } from "@/lib/scope";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export type InventoryKind = "stock" | "asset";

export interface AssetPhotoEntry {
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
  condition?: "Working" | "Broken" | "Missing" | "New";
  note?: string;
}

export interface InventoryItem {
  id: string;
  propertyId: string;
  kind: InventoryKind;        // stock = disposables, asset = durable goods
  category: string;            // Stock: "Cleaning Supplies". Assets: "Kitchen", "Living Room", "Bedroom 1", etc.
  name: string;                // e.g. "Dish soap" or "Kettle"
  // Stock fields
  currentLevel: number;
  minimumLevel: number;
  status?: "OK" | "Low" | "Out" | "Missing" | "Damaged";
  // Asset-specific fields
  present?: boolean;           // Is this asset present at the property?
  condition?: "Working" | "Broken" | "Missing" | "New";
  photo?: string;              // Current photo URL
  photoHistory?: AssetPhotoEntry[]; // Full audit trail of photos + conditions
  // Common fields
  lastCheckedAt?: string;
  updatedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const META_KEY = "inventory/_meta.json";

async function readAll(): Promise<InventoryItem[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "inventory/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    const url = blobs.blobs[0].url + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function writeAll(items: InventoryItem[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN env var is not configured");
  }
  await put(META_KEY, JSON.stringify(items), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

function computeStatus(current: number, minimum: number): "OK" | "Low" | "Out" {
  if (current <= 0) return "Out";
  if (current <= minimum) return "Low";
  return "OK";
}

function ensureStatus(item: InventoryItem): InventoryItem {
  // Stock items get automatic OK/Low/Out based on levels.
  // Assets keep their explicit status (Missing/Damaged/OK).
  if (item.kind === "asset") {
    return { ...item, status: item.status || "OK" };
  }
  return { ...item, status: computeStatus(item.currentLevel || 0, item.minimumLevel || 0) };
}

/** GET — list inventory. Admin only. */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  const kind = url.searchParams.get("kind") as InventoryKind | null;

  let all = await readAll();
  all = all.map(ensureStatus);

  let filtered = all;
  if (propertyId) filtered = filtered.filter((i) => i.propertyId === propertyId);
  if (kind) filtered = filtered.filter((i) => i.kind === kind);

  return NextResponse.json({ ok: true, data: filtered });
}

/** POST — create a new inventory item (admin only) */
export async function POST(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const body = await req.json();
  const { propertyId, kind, category, name, currentLevel, minimumLevel, status, updatedBy, notes, present, condition, photo } = body;

  if (!propertyId || !kind || !category || !name) {
    return NextResponse.json({ error: "propertyId, kind, category, name required" }, { status: 400 });
  }

  const all = await readAll();
  const now = new Date().toISOString();
  const isAsset = kind === "asset";
  const initialCondition: AssetPhotoEntry["condition"] | undefined = isAsset ? (condition || "Working") : undefined;
  const newItem: InventoryItem = {
    id: randomUUID(),
    propertyId: String(propertyId),
    kind: isAsset ? "asset" : "stock",
    category: String(category).trim(),
    name: String(name).trim(),
    currentLevel: Number(currentLevel) || 0,
    minimumLevel: Number(minimumLevel) || 0,
    status,
    present: isAsset ? (present !== false) : undefined,
    condition: isAsset ? initialCondition : undefined,
    photo: isAsset ? (photo || undefined) : undefined,
    photoHistory: isAsset && photo ? [{
      url: photo,
      uploadedAt: now,
      uploadedBy: updatedBy || scope.email,
      condition: initialCondition,
    }] : [],
    lastCheckedAt: now,
    updatedBy: updatedBy || scope.email,
    notes: notes || undefined,
    createdAt: now,
    updatedAt: now,
  };
  all.push(ensureStatus(newItem));
  await writeAll(all);

  return NextResponse.json({ ok: true, data: newItem });
}

/** PATCH — update an item (admin only) */
export async function PATCH(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const all = await readAll();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const existing = all[idx];

  // For assets: append to photoHistory when photo or condition changes
  let photoHistory = existing.photoHistory || [];
  if (existing.kind === "asset") {
    const photoChanged = updates.photo !== undefined && updates.photo !== existing.photo;
    const conditionChanged = updates.condition !== undefined && updates.condition !== existing.condition;
    if ((photoChanged && updates.photo) || conditionChanged) {
      const entry: AssetPhotoEntry = {
        url: updates.photo || existing.photo || "",
        uploadedAt: now,
        uploadedBy: updates.updatedBy || scope.email,
        condition: updates.condition || existing.condition,
        note: updates.photoNote || undefined,
      };
      photoHistory = [...photoHistory, entry];
    }
  }

  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    propertyId: existing.propertyId,
    photoHistory,
    updatedAt: now,
    lastCheckedAt: updates.lastCheckedAt || now,
    updatedBy: updates.updatedBy || scope.email,
  };
  // strip transient fields
  delete (merged as any).photoNote;
  all[idx] = ensureStatus(merged);
  await writeAll(all);

  return NextResponse.json({ ok: true, data: all[idx] });
}

/** DELETE — remove an item (admin only) */
export async function DELETE(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const all = await readAll();
  const filtered = all.filter((i) => i.id !== id);
  await writeAll(filtered);

  return NextResponse.json({ ok: true });
}
