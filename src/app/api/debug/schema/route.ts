/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function describeDb(dbId: string) {
  if (!dbId) return { error: "DB id missing" };
  try {
    const res: any = await notion.databases.retrieve({ database_id: dbId });
    const props: Record<string, { type: string; options?: string[] }> = {};
    for (const [name, p] of Object.entries(res.properties || {})) {
      const prop = p as any;
      const entry: { type: string; options?: string[] } = { type: prop.type };
      if (prop.type === "select" && prop.select?.options) {
        entry.options = prop.select.options.map((o: any) => o.name);
      }
      if (prop.type === "status" && prop.status?.options) {
        entry.options = prop.status.options.map((o: any) => o.name);
      }
      if (prop.type === "multi_select" && prop.multi_select?.options) {
        entry.options = prop.multi_select.options.map((o: any) => o.name);
      }
      props[name] = entry;
    }
    return { title: res.title?.[0]?.plain_text || "", properties: props };
  } catch (e: any) {
    return { error: e?.message || "Failed" };
  }
}

export async function GET() {
  const [turnovers, issues, inventory, properties] = await Promise.all([
    describeDb(process.env.NOTION_TURNOVERS_DB || ""),
    describeDb(process.env.NOTION_ISSUES_DB || ""),
    describeDb(process.env.NOTION_INVENTORY_DB || ""),
    describeDb(process.env.NOTION_PROPERTIES_DB || ""),
  ]);
  return NextResponse.json({ turnovers, issues, inventory, properties });
}
