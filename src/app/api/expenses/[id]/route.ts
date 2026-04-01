/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/** PATCH — update expense status/category */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const properties: any = {};

    if (body.status) {
      properties["Status "] = { status: { name: body.status } };
    }
    if (body.category) {
      properties["Category "] = { select: { name: body.category } };
    }

    await notion.pages.update({ page_id: id, properties });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update expense error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Update failed" }, { status: 500 });
  }
}

/** DELETE — archive expense */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await notion.pages.update({ page_id: id, archived: true });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete expense error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Delete failed" }, { status: 500 });
  }
}
