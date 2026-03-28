import { Client } from "@notionhq/client";

// Initialize Notion client
// Set these in .env.local:
//   NOTION_API_KEY=ntn_xxxx or secret_xxxx
//   NOTION_PROPERTIES_DB=database_id
//   NOTION_RESERVATIONS_DB=database_id
//   NOTION_EXPENSES_DB=database_id
//   NOTION_PAYOUT_CYCLES_DB=database_id
//   NOTION_REPORTS_DB=database_id

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export default notion;

// Database IDs from environment
export const DB = {
  properties: process.env.NOTION_PROPERTIES_DB || "",
  reservations: process.env.NOTION_RESERVATIONS_DB || "",
  expenses: process.env.NOTION_EXPENSES_DB || "",
  payoutCycles: process.env.NOTION_PAYOUT_CYCLES_DB || "",
  reports: process.env.NOTION_REPORTS_DB || "",
};

// ── Helper: Extract property value from Notion page ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProp(page: any, name: string): any {
  const prop = page.properties?.[name];
  if (!prop) return null;

  switch (prop.type) {
    case "title":
      return prop.title?.[0]?.plain_text || "";
    case "rich_text":
      return prop.rich_text?.[0]?.plain_text || "";
    case "number":
      return prop.number ?? 0;
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return prop.multi_select?.map((s: { name: string }) => s.name) || [];
    case "date":
      return prop.date?.start || "";
    case "checkbox":
      return prop.checkbox ?? false;
    case "url":
      return prop.url || "";
    case "email":
      return prop.email || "";
    case "phone_number":
      return prop.phone_number || "";
    case "formula":
      if (prop.formula.type === "string") return prop.formula.string || "";
      if (prop.formula.type === "number") return prop.formula.number ?? 0;
      if (prop.formula.type === "boolean") return prop.formula.boolean ?? false;
      if (prop.formula.type === "date") return prop.formula.date?.start || "";
      return null;
    case "rollup":
      if (prop.rollup.type === "number") return prop.rollup.number ?? 0;
      if (prop.rollup.type === "array") return prop.rollup.array || [];
      return null;
    case "relation":
      return prop.relation?.map((r: { id: string }) => r.id) || [];
    case "status":
      return prop.status?.name || "";
    case "files":
      return prop.files?.map((f: { file?: { url: string }; external?: { url: string } }) =>
        f.file?.url || f.external?.url || ""
      ) || [];
    default:
      return null;
  }
}

// ── Query a database ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryDatabase(databaseId: string, filter?: any, sorts?: any[]) {
  if (!databaseId) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = { database_id: databaseId };
    if (filter) params.filter = filter;
    if (sorts) params.sorts = sorts;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (notion as any).databases.query({
        ...params,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });
      allResults = allResults.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    return allResults;
  } catch (error) {
    console.error(`Error querying database ${databaseId}:`, error);
    return [];
  }
}
