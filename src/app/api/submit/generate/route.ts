import { NextResponse } from "next/server";
import { encodeToken } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { reservationId } = await req.json();
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const token = encodeToken(reservationId);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/submit/${token}`;

    // Just generate the link — don't create a duplicate expense
    // The expense will be created when the vendor actually submits the form

    return NextResponse.json({ ok: true, token, url });
  } catch {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
