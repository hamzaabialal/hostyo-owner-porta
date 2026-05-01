/* eslint-disable @typescript-eslint/no-explicit-any */
import notion, { DB } from "./notion";

export type IssueStatus = "Pending" | "In Progress" | "Resolved";

export interface IssueRecord {
  id: string;                 // Notion page id
  turnoverPageId: string;     // Relation target (Turnovers DB page)
  departureDate: string;
  category?: string;
  title?: string;
  description: string;
  severity?: "Low" | "Medium" | "High";
  photoUrl?: string;
  resolved: boolean;          // Kept for backward compatibility (mirrors status === "Resolved")
  status: IssueStatus;
  createdAt: string;
}

const txt = (s?: string) => s ? [{ type: "text" as const, text: { content: s.slice(0, 2000) } }] : [];

export function pageToIssue(page: any): IssueRecord {
  const props = page.properties || {};
  const rt = (p: any) => p?.rich_text?.[0]?.plain_text || "";
  const title = (p: any) => p?.title?.[0]?.plain_text || "";
  const date = (p: any) => p?.date?.start || "";
  const select = (p: any) => p?.select?.name || "";

  const sev = select(props["Severity"]);
  const severity: IssueRecord["severity"] | undefined =
    sev === "High" || sev === "Medium" || sev === "Low" ? sev : undefined;

  const resolved = props["Resolved"]?.checkbox === true;
  // Status: prefer an explicit Notion "Status" select/rich_text if the DB has
  // one (lets admins move issues to "In Progress"); otherwise derive from the
  // Resolved checkbox so older records still show a sensible value.
  const statusRaw = select(props["Status"]) || rt(props["Status"]);
  let status: IssueStatus;
  if (resolved) status = "Resolved";
  else if (statusRaw === "In Progress") status = "In Progress";
  else if (statusRaw === "Resolved") status = "Resolved";
  else status = "Pending";

  return {
    id: page.id,
    turnoverPageId: props["Turnover"]?.relation?.[0]?.id || "",
    departureDate: date(props["Departure Date"]),
    category: rt(props["Category"]) || undefined,
    title: title(props["Name"]) || rt(props["Title"]) || undefined,
    description: rt(props["Description"]) || "",
    severity,
    photoUrl: props["Photo URL"]?.url || undefined,
    resolved,
    status,
    createdAt: date(props["Created"]) || page.created_time,
  };
}

export async function listIssuesForTurnover(turnoverPageId: string) {
  if (!DB.issues || !turnoverPageId) return [];
  const res: any = await (notion as any).databases.query({
    database_id: DB.issues,
    filter: { property: "Turnover", relation: { contains: turnoverPageId } },
    page_size: 100,
  });
  return res.results as any[];
}

export async function listAllIssues() {
  if (!DB.issues) return [];
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (notion as any).databases.query({
      database_id: DB.issues,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function createIssue(data: {
  turnoverPageId: string;
  departureDate: string;
  category?: string;
  title?: string;
  description: string;
  severity?: "Low" | "Medium" | "High";
  photoUrl?: string;
}) {
  if (!DB.issues) throw new Error("NOTION_ISSUES_DB not configured");
  const displayTitle = data.title?.trim() || data.description.slice(0, 80);
  const properties: any = {
    "Name": { title: txt(displayTitle) },
    "Turnover": { relation: [{ id: data.turnoverPageId }] },
    "Departure Date": { date: { start: data.departureDate } },
    "Description": { rich_text: txt(data.description) },
    "Resolved": { checkbox: false },
    "Created": { date: { start: new Date().toISOString() } },
  };
  if (data.category) properties["Category"] = { rich_text: txt(data.category) };
  if (data.title) properties["Title"] = { rich_text: txt(data.title) };
  if (data.severity) properties["Severity"] = { select: { name: data.severity } };
  if (data.photoUrl) properties["Photo URL"] = { url: data.photoUrl };

  const page: any = await (notion as any).pages.create({
    parent: { database_id: DB.issues },
    properties,
  });
  return page;
}

export async function setIssueResolved(pageId: string, resolved: boolean) {
  if (!DB.issues) throw new Error("NOTION_ISSUES_DB not configured");
  await (notion as any).pages.update({
    page_id: pageId,
    properties: { "Resolved": { checkbox: resolved } },
  });
}

/**
 * Set an issue's status. Always writes the Resolved checkbox (so existing
 * dashboards keep working) and tries to also write a Status property —
 * either as a select or a rich_text field. The Status write is best-effort:
 * if the Notion DB doesn't have a Status property the API call throws and
 * we fall back to just the checkbox, so this stays safe to call regardless
 * of schema.
 */
export async function setIssueStatus(pageId: string, status: IssueStatus) {
  if (!DB.issues) throw new Error("NOTION_ISSUES_DB not configured");
  const resolved = status === "Resolved";
  // Try writing both Status (as select) and Resolved together first.
  try {
    await (notion as any).pages.update({
      page_id: pageId,
      properties: {
        "Resolved": { checkbox: resolved },
        "Status": { select: { name: status } },
      },
    });
    return;
  } catch { /* fall through */ }
  // Retry as rich_text in case the Notion property type is different.
  try {
    await (notion as any).pages.update({
      page_id: pageId,
      properties: {
        "Resolved": { checkbox: resolved },
        "Status": { rich_text: txt(status) },
      },
    });
    return;
  } catch { /* fall through */ }
  // Last-resort: just the checkbox so resolve/unresolve still works.
  await (notion as any).pages.update({
    page_id: pageId,
    properties: { "Resolved": { checkbox: resolved } },
  });
}
