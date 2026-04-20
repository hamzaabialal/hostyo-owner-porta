/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserScope } from "@/lib/scope";
import {
  listInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  pageToItem, type InventoryKind,
} from "@/lib/notion-inventory";

export const dynamic = "force-dynamic";

export type { InventoryItem, InventoryKind } from "@/lib/notion-inventory";

/** GET — list inventory. Admin only. */
export async function GET(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId") || undefined;
    const kind = (url.searchParams.get("kind") as InventoryKind | null) || undefined;

    const pages = await listInventory(propertyId, kind);
    const items = pages.map(pageToItem);
    return NextResponse.json({ ok: true, data: items });
  } catch (err) {
    console.error("GET /api/inventory failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — create a new inventory item (admin only) */
export async function POST(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json();
    const { propertyId, kind, category, name, currentLevel, minimumLevel, notes, present, condition, photo } = body;
    if (!propertyId || !kind || !category || !name) {
      return NextResponse.json({ error: "propertyId, kind, category, name required" }, { status: 400 });
    }
    const isAsset = kind === "asset";
    const page = await createInventoryItem({
      propertyId: String(propertyId),
      kind: isAsset ? "asset" : "stock",
      category: String(category).trim(),
      name: String(name).trim(),
      currentLevel: Number(currentLevel) || 0,
      minimumLevel: Number(minimumLevel) || 0,
      present: isAsset ? (present !== false) : undefined,
      condition: isAsset ? (condition || "Working") : undefined,
      photo: isAsset ? (photo || undefined) : undefined,
      notes: notes || undefined,
    });
    return NextResponse.json({ ok: true, data: pageToItem(page) });
  } catch (err) {
    console.error("POST /api/inventory failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — update an item (admin only) */
export async function PATCH(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await updateInventoryItem(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/inventory failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — remove an item (admin only) */
export async function DELETE(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteInventoryItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/inventory failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
