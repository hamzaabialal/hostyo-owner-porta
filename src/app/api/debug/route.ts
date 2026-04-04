/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_ID = process.env.NOTION_RESERVATIONS_DB || "";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyFilter = url.searchParams.get("property") || "";

  try {
    const allPages: any[] = [];
    let cursor: string | undefined = undefined;

    do {
      const res: any = await notion.databases.query({
        database_id: DB_ID,
        filter: { property: "Deleted", checkbox: { equals: false } },
        sorts: [{ property: "Check In", direction: "descending" }],
        start_cursor: cursor,
        page_size: 100,
      });
      allPages.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const mapped = allPages.map((page: any) => {
      const getProp = (name: string) => {
        const p = page.properties?.[name];
        if (!p) return `[no prop: ${name}]`;
        switch (p.type) {
          case "title": return p.title?.[0]?.plain_text || "";
          case "rich_text": return p.rich_text?.[0]?.plain_text || "";
          case "number": return p.number;
          case "select": return `[select] ${p.select?.name || ""}`;
          case "status": return `[status] ${p.status?.name || ""}`;
          case "date": return p.date?.start || "";
          case "checkbox": return p.checkbox;
          default: return `[${p.type}]`;
        }
      };

      return {
        guest: getProp("Guest"),
        property: getProp("Property"),
        status: getProp("Status"),
        payoutStatus: getProp("Payout Status"),
        checkin: getProp("Check In"),
        checkout: getProp("Check Out"),
        deleted: getProp("Deleted"),
      };
    });

    const filtered = propertyFilter
      ? mapped.filter((r: any) => String(r.property).includes(propertyFilter))
      : mapped;

    return NextResponse.json({
      totalFromNotion: allPages.length,
      filteredCount: filtered.length,
      data: filtered,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
