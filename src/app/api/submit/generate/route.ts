import { NextResponse } from "next/server";
import { encodeToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * POST /api/submit/generate
 * Body: { reservationId: "notion-page-id" }
 * Returns: { url: "http://host/submit/TOKEN" }
 *
 * Use this from Notion automations or buttons to generate
 * a shareable expense submission URL for a reservation.
 */
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

    return NextResponse.json({ ok: true, token, url });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
