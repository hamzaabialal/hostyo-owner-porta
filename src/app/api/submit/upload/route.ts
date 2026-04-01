import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${randomUUID()}.${ext}`;

    // Save to /tmp/ (works on Vercel) or public/uploads/ (local)
    const isVercel = !!process.env.VERCEL;
    const uploadDir = isVercel ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    // Build the URL — use API route on Vercel, direct path locally
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = isVercel
      ? `${protocol}://${host}/api/submit/file/${filename}`
      : `${protocol}://${host}/uploads/${filename}`;

    // Also create a base64 preview for immediate display in browser
    const mimeType = file.type || "application/octet-stream";
    const preview = `data:${mimeType};base64,${buffer.toString("base64")}`;

    return NextResponse.json({ ok: true, url, preview, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
