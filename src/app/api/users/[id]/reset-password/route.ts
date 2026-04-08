/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Generate new temporary password
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = createHash("sha256").update(tempPassword + SECRET).digest("hex");

    await notion.pages.update({
      page_id: id,
      properties: {
        "Password": { rich_text: [{ text: { content: passwordHash } }] },
      },
    });

    return NextResponse.json({ ok: true, tempPassword });
  } catch (error: any) {
    console.error("Reset password error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Failed to reset password" }, { status: 500 });
  }
}
