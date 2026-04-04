import { NextResponse } from "next/server";
import { encodePropertyToken } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { propertyName } = await req.json();
    if (!propertyName) {
      return NextResponse.json({ error: "propertyName is required" }, { status: 400 });
    }

    const token = encodePropertyToken(propertyName);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/submit/${token}`;

    return NextResponse.json({ ok: true, token, url });
  } catch {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
