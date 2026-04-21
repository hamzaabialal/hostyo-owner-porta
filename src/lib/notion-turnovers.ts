/* eslint-disable @typescript-eslint/no-explicit-any */
import notion, { DB } from "./notion";

export interface TurnoverPhoto {
  url: string;
  uploadedAt: string;
  exifDateTime?: string;
  deviceModel?: string;
  latitude?: number;
  longitude?: number;
  size?: number;
  name?: string;
}

export interface TimerSession {
  cleanerName?: string;
  startedAt?: string;
  stoppedAt?: string;
  durationSec?: number;
  /** When the session was closed (either stopped or archived on regenerate) */
  archivedAt: string;
}

export interface TurnoverRecord {
  id: string;                 // Notion page id
  compositeId: string;        // `${propertyId}__${departureDate}` (legacy; used by routes)
  propertyId: string;
  propertyName?: string;
  propertyBedrooms?: number;
  propertyBathrooms?: number;
  propertyLocation?: string;
  propertyCoverUrl?: string;
  departureDate: string;
  status: "Pending" | "In progress" | "Submitted" | "Completed";
  items: Record<string, TurnoverPhoto[]>;
  issues: any[];              // denormalised from Issues DB (see notion-issues.ts)
  notes?: string;
  cleanerName?: string;
  cleanerToken?: string;
  cleanerLinkExpired?: boolean;
  timerStartedAt?: string;
  timerStoppedAt?: string;
  timerDurationSec?: number;
  /** Previous timer sessions (archived when admin regenerates the link for a new cleaner). */
  timerLog: TimerSession[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
}

const txt = (s?: string) => s ? [{ type: "text" as const, text: { content: s.slice(0, 2000) } }] : [];

const MAX_TIMER_LOG_JSON_CHARS = 1800;
const txtJson = (value: unknown) => {
  try {
    let json = JSON.stringify(value);
    if (json.length > MAX_TIMER_LOG_JSON_CHARS && Array.isArray(value)) {
      const arr = [...value];
      while (json.length > MAX_TIMER_LOG_JSON_CHARS && arr.length > 0) {
        arr.shift();
        json = JSON.stringify(arr);
      }
    }
    return json.length > 0 ? [{ type: "text" as const, text: { content: json.slice(0, 2000) } }] : [];
  } catch { return []; }
};

function parseTimerLog(raw: string): TimerSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s: any) => s && typeof s === "object");
  } catch { return []; }
}

export function pageToTurnover(page: any, issues: any[] = []): TurnoverRecord {
  const props = page.properties || {};
  const rt = (p: any) => p?.rich_text?.[0]?.plain_text || "";
  const title = (p: any) => p?.title?.[0]?.plain_text || "";
  const date = (p: any) => p?.date?.start || "";
  const status = (p: any) => p?.status?.name || "Pending";

  const propertyId = props["Property"]?.relation?.[0]?.id || "";
  const departureDate = date(props["Departure Date"]);

  // Parse Items JSON
  let items: Record<string, TurnoverPhoto[]> = {};
  try {
    const raw = rt(props["Items JSON"]);
    if (raw) items = JSON.parse(raw);
  } catch { /* ignore */ }

  // Parse timer durations
  const timerStartedAt = date(props["Timer Started"]);
  const timerStoppedAt = date(props["Timer Stopped"]);
  let timerDurationSec: number | undefined;
  if (timerStartedAt && timerStoppedAt) {
    const ms = new Date(timerStoppedAt).getTime() - new Date(timerStartedAt).getTime();
    timerDurationSec = Math.max(0, Math.round(ms / 1000));
  }

  const statusVal = status(props["Status"]);
  const normStatus: TurnoverRecord["status"] =
    statusVal === "Completed" ? "Completed" :
    statusVal === "Submitted" ? "Submitted" :
    statusVal === "In progress" ? "In progress" : "Pending";

  const timerLog = parseTimerLog(rt(props["Timer Log"]));

  return {
    id: page.id,
    compositeId: `${propertyId}__${departureDate}`,
    propertyId,
    departureDate,
    status: normStatus,
    items,
    issues,
    notes: rt(props["Notes"]) || undefined,
    cleanerName: rt(props["Cleaner Name"]) || undefined,
    cleanerToken: rt(props["Cleaner Token"]) || undefined,
    cleanerLinkExpired: false, // expired state represented by clearing the token
    timerStartedAt: timerStartedAt || undefined,
    timerStoppedAt: timerStoppedAt || undefined,
    timerDurationSec,
    timerLog,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    // Property metadata denormalised fields aren't stored in Notion — populated
    // by the routes at read-time from the Properties DB.
    propertyName: title(props["Name"]) || undefined,
  };
}

/** Find a turnover by propertyId + departureDate. Returns null if not found. */
export async function findTurnover(propertyId: string, departureDate: string) {
  if (!DB.turnovers || !propertyId || !departureDate) return null;
  const res: any = await (notion as any).databases.query({
    database_id: DB.turnovers,
    filter: {
      and: [
        { property: "Property", relation: { contains: propertyId } },
        { property: "Departure Date", date: { equals: departureDate } },
      ],
    },
    page_size: 1,
  });
  return res.results?.[0] || null;
}

export async function findTurnoverById(pageId: string) {
  if (!DB.turnovers || !pageId) return null;
  try {
    const res: any = await (notion as any).pages.retrieve({ page_id: pageId });
    return res;
  } catch { return null; }
}

export async function findTurnoverByToken(token: string) {
  if (!DB.turnovers || !token) return null;
  const res: any = await (notion as any).databases.query({
    database_id: DB.turnovers,
    filter: { property: "Cleaner Token", rich_text: { equals: token } },
    page_size: 1,
  });
  return res.results?.[0] || null;
}

export async function listTurnovers(propertyId?: string) {
  if (!DB.turnovers) return [];
  const filter = propertyId
    ? { property: "Property", relation: { contains: propertyId } }
    : undefined;
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (notion as any).databases.query({
      database_id: DB.turnovers,
      ...(filter ? { filter } : {}),
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function createTurnover(data: Partial<TurnoverRecord>) {
  if (!DB.turnovers) throw new Error("NOTION_TURNOVERS_DB not configured");
  const name = `${data.propertyName || "Property"} — ${data.departureDate || ""}`;
  const properties: any = {
    "Name": { title: txt(name) },
    ...(data.propertyId ? { "Property": { relation: [{ id: data.propertyId }] } } : {}),
    ...(data.departureDate ? { "Departure Date": { date: { start: data.departureDate } } } : {}),
    "Status": { status: { name: data.status || "Pending" } },
  };
  if (data.cleanerName !== undefined) properties["Cleaner Name"] = { rich_text: txt(data.cleanerName) };
  if (data.cleanerToken !== undefined) properties["Cleaner Token"] = { rich_text: txt(data.cleanerToken) };
  if (data.notes !== undefined) properties["Notes"] = { rich_text: txt(data.notes) };
  if (data.items !== undefined) properties["Items JSON"] = { rich_text: txt(JSON.stringify(data.items || {})) };
  if (data.timerStartedAt) properties["Timer Started"] = { date: { start: data.timerStartedAt } };
  if (data.timerStoppedAt) properties["Timer Stopped"] = { date: { start: data.timerStoppedAt } };

  const page: any = await (notion as any).pages.create({
    parent: { database_id: DB.turnovers },
    properties,
  });
  return page;
}

export async function updateTurnover(pageId: string, updates: Partial<TurnoverRecord>) {
  if (!DB.turnovers) throw new Error("NOTION_TURNOVERS_DB not configured");
  const properties: any = {};
  if (updates.status) properties["Status"] = { status: { name: updates.status } };
  if (updates.cleanerName !== undefined) properties["Cleaner Name"] = { rich_text: txt(updates.cleanerName) };
  if (updates.cleanerToken !== undefined) properties["Cleaner Token"] = { rich_text: txt(updates.cleanerToken) };
  if (updates.notes !== undefined) properties["Notes"] = { rich_text: txt(updates.notes) };
  if (updates.items !== undefined) properties["Items JSON"] = { rich_text: txt(JSON.stringify(updates.items || {})) };
  if (updates.timerStartedAt !== undefined) properties["Timer Started"] = updates.timerStartedAt ? { date: { start: updates.timerStartedAt } } : { date: null };
  if (updates.timerStoppedAt !== undefined) properties["Timer Stopped"] = updates.timerStoppedAt ? { date: { start: updates.timerStoppedAt } } : { date: null };
  if (updates.timerLog !== undefined) properties["Timer Log"] = { rich_text: txtJson(updates.timerLog) };

  if (Object.keys(properties).length === 0) return null;
  await (notion as any).pages.update({ page_id: pageId, properties });
  return pageId;
}
