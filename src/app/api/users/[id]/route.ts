/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// PATCH — update user role/properties
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const properties: any = {};

    if (body.name !== undefined) {
      properties["Full Name"] = { title: [{ text: { content: body.name.trim() } }] };
    }
    if (body.isAdmin !== undefined) {
      properties["Is Admin"] = { checkbox: body.isAdmin };
    }
    if (body.properties !== undefined) {
      properties["Properties"] = { rich_text: [{ text: { content: body.properties } }] };
    }

    await notion.pages.update({ page_id: id, properties });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Update failed" }, { status: 500 });
  }
}

// DELETE — archive user
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await notion.pages.update({ page_id: id, archived: true });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Delete failed" }, { status: 500 });
  }
}
