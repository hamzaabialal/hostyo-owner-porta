/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { getUserScope, isInScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

interface DocumentMeta {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  url: string;
  size: string;
  type: "report" | "document";
  source: "System" | "Admin";
  createdAt: string;
}

const META_KEY = "documents/_meta.json";

async function readMeta(): Promise<DocumentMeta[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const blobs = await list({ prefix: "documents/_meta", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs.blobs.length === 0) return [];
    // Bust cache with a query string — Vercel Blob CDN can serve stale content otherwise
    const url = blobs.blobs[0].url + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? await res.json() : [];
  } catch (err) {
    console.error("readMeta error:", err);
    return [];
  }
}

async function writeMeta(docs: DocumentMeta[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(META_KEY, JSON.stringify(docs), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** GET — list documents for a property */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") || "";
  const propertyName = url.searchParams.get("propertyName") || "";

  // Scope check — owner can only see documents for their properties
  if (propertyName && !isInScope(scope, propertyName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await readMeta();
  const filtered = propertyId ? all.filter((d) => d.propertyId === propertyId) : all;
  return NextResponse.json({ ok: true, data: filtered });
}

/** POST — add a document record */
export async function POST(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { propertyId, propertyName, name, url, size, type, source } = body;

  // Admins can add docs to any property; owners can add to their own properties
  if (!scope.isAdmin && propertyName && !isInScope(scope, propertyName)) {
    return NextResponse.json({ error: "Forbidden — property not in your scope" }, { status: 403 });
  }

  const all = await readMeta();
  const newDoc: DocumentMeta = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    propertyId: propertyId || "",
    propertyName: propertyName || "",
    name: name || "",
    url: url || "",
    size: size || "0 KB",
    type: type || "document",
    source: scope.isAdmin ? (source || "Admin") : "Admin",
    createdAt: new Date().toISOString(),
  };
  all.unshift(newDoc);
  await writeMeta(all);

  return NextResponse.json({ ok: true, document: newDoc });
}

/** DELETE — remove a document */
export async function DELETE(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const url = new URL(req.url);
  const docId = url.searchParams.get("id") || "";
  if (!docId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const all = await readMeta();
  const filtered = all.filter((d) => d.id !== docId);
  await writeMeta(filtered);

  return NextResponse.json({ ok: true });
}
