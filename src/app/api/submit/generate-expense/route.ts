import { NextResponse } from "next/server";
import { encodeExpenseToken } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { expenseId } = await req.json();
    if (!expenseId) {
      return NextResponse.json({ error: "expenseId is required" }, { status: 400 });
    }

    const token = encodeExpenseToken(expenseId);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/submit/${token}`;

    return NextResponse.json({ ok: true, token, url });
  } catch {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
