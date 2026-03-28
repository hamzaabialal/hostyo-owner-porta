import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    if (!allowed.some((t) => file.type.startsWith(t.split("/")[0]) || file.type === t)) {
      return NextResponse.json({ ok: false, error: "File type not supported" }, { status: 400 });
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Ensure upload dir exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Build public URL
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/uploads/${filename}`;

    return NextResponse.json({ ok: true, url, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
