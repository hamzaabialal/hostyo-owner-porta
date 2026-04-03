import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// Increase body size limit for file uploads
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle direct file upload (content-type is not multipart)
    if (!contentType.includes("multipart/form-data")) {
      const filename = req.headers.get("x-filename") || `${randomUUID()}.jpg`;
      const blob = await put(`expenses/${filename}`, req.body!, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return NextResponse.json({ ok: true, url: blob.url, filename });
    }

    // Handle multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${randomUUID()}.${ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`expenses/${filename}`, file, {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        return NextResponse.json({ ok: true, url: blob.url, filename });
      } catch (blobErr: unknown) {
        const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
        console.error("Vercel Blob upload error:", msg);
        return NextResponse.json({ ok: false, error: `Blob upload failed: ${msg}` }, { status: 500 });
      }
    }

    // No blob token — return error in production
    return NextResponse.json({ ok: false, error: "File storage not configured" }, { status: 500 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", msg);
    return NextResponse.json({ ok: false, error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
