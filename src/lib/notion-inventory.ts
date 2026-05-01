/* eslint-disable @typescript-eslint/no-explicit-any */
import notion, { DB } from "./notion";

// Note: The Notion database defines the Minimum Level column with a LEADING SPACE:
//   " Minimum Level". We preserve the exact name for Notion API calls. Renaming
//   the column in Notion would be cleaner, but we don't want to touch the user's
//   existing database schema.
const MIN_LEVEL_KEY = " Minimum Level";

export type InventoryKind = "stock" | "asset";
// "Missing" kept as an accepted value so legacy records still parse, but
// the UI surfaces the new three-state vocabulary: Working / Damaged / Broken.
export type AssetCondition = "Working" | "Damaged" | "Broken" | "Missing";

export interface AssetPhotoEntry {
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
  condition?: AssetCondition;
  note?: string;
}

export interface InventoryItem {
  id: string;                 // Notion page id
  propertyId: string;
  kind: InventoryKind;
  category: string;
  name: string;
  currentLevel: number;
  minimumLevel: number;
  status?: "OK" | "Low" | "Out" | "Missing" | "Damaged";
  present?: boolean;
  condition?: AssetCondition;
  photo?: string;
  photoHistory?: AssetPhotoEntry[];
  lastCheckedAt?: string;
  updatedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const txt = (s?: string) => s ? [{ type: "text" as const, text: { content: s.slice(0, 2000) } }] : [];

// Rich_text can hold a long string via multiple text blocks. For the photo-history
// JSON we pack everything into a single block but truncate to the per-block limit.
// Notion's per-block string limit is 2000 chars; we keep only the last ~N entries.
const MAX_HISTORY_JSON_CHARS = 1800;
const txtJson = (value: unknown) => {
  try {
    let json = JSON.stringify(value);
    if (json.length > MAX_HISTORY_JSON_CHARS && Array.isArray(value)) {
      // Drop oldest entries until it fits
      const arr = [...value];
      while (json.length > MAX_HISTORY_JSON_CHARS && arr.length > 0) {
        arr.shift();
        json = JSON.stringify(arr);
      }
    }
    return json.length > 0 ? [{ type: "text" as const, text: { content: json.slice(0, 2000) } }] : [];
  } catch { return []; }
};

function computeStatus(current: number, minimum: number): "OK" | "Low" | "Out" {
  if (current <= 0) return "Out";
  if (current <= minimum) return "Low";
  return "OK";
}

function parsePhotoHistory(raw: string): AssetPhotoEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e && typeof e.url === "string");
  } catch { return []; }
}

export function pageToItem(page: any): InventoryItem {
  const props = page.properties || {};
  const rt = (p: any) => p?.rich_text?.[0]?.plain_text || "";
  const title = (p: any) => p?.title?.[0]?.plain_text || "";

  const kindRaw = props["Kind"]?.select?.name || "stock";
  const kind: InventoryKind = kindRaw === "asset" ? "asset" : "stock";
  const conditionRaw = rt(props["Condition"]);
  const validCondition: AssetCondition | undefined =
    conditionRaw === "Working" || conditionRaw === "Broken" || conditionRaw === "Missing" || conditionRaw === "Damaged"
      ? conditionRaw
      : undefined;
  const currentLevel = props["Current Level"]?.number ?? 0;
  const minimumLevel = props[MIN_LEVEL_KEY]?.number ?? 0;
  const historyRaw = rt(props["Photo History"]);

  return {
    id: page.id,
    propertyId: props["Property"]?.relation?.[0]?.id || "",
    kind,
    category: rt(props["Category"]) || "",
    name: title(props["Name"]) || "",
    currentLevel,
    minimumLevel,
    status: kind === "stock" ? computeStatus(currentLevel, minimumLevel) : "OK",
    present: props["Present"]?.checkbox !== false,
    condition: validCondition || (kind === "asset" ? "Working" : undefined),
    photo: props["Photo"]?.url || undefined,
    photoHistory: parsePhotoHistory(historyRaw),
    notes: rt(props["Notes"]) || undefined,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    lastCheckedAt: page.last_edited_time,
  };
}

export async function listInventory(propertyId?: string, kind?: InventoryKind) {
  if (!DB.inventory) return [];
  const filters: any[] = [];
  if (propertyId) filters.push({ property: "Property", relation: { contains: propertyId } });
  if (kind) filters.push({ property: "Kind", select: { equals: kind } });
  const filter = filters.length === 0 ? undefined :
    filters.length === 1 ? filters[0] : { and: filters };

  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (notion as any).databases.query({
      database_id: DB.inventory,
      ...(filter ? { filter } : {}),
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function createInventoryItem(data: Partial<InventoryItem> & {
  propertyId: string;
  kind: InventoryKind;
  category: string;
  name: string;
  updatedBy?: string;
}) {
  if (!DB.inventory) throw new Error("NOTION_INVENTORY_DB not configured");
  const properties: any = {
    "Name": { title: txt(data.name) },
    "Property": { relation: [{ id: data.propertyId }] },
    "Kind": { select: { name: data.kind } },
    "Category": { rich_text: txt(data.category) },
    "Current Level": { number: data.currentLevel ?? 0 },
    [MIN_LEVEL_KEY]: { number: data.minimumLevel ?? 0 },
  };
  if (data.present !== undefined) properties["Present"] = { checkbox: data.present };
  if (data.condition) properties["Condition"] = { rich_text: txt(data.condition) };
  if (data.photo) properties["Photo"] = { url: data.photo };
  if (data.notes) properties["Notes"] = { rich_text: txt(data.notes) };
  // Seed photo history with the initial photo + condition (assets only)
  if (data.kind === "asset" && data.photo) {
    const entry: AssetPhotoEntry = {
      url: data.photo,
      uploadedAt: new Date().toISOString(),
      uploadedBy: data.updatedBy,
      condition: data.condition,
    };
    properties["Photo History"] = { rich_text: txtJson([entry]) };
  }

  const page: any = await (notion as any).pages.create({
    parent: { database_id: DB.inventory },
    properties,
  });
  return page;
}

export async function updateInventoryItem(
  pageId: string,
  updates: Partial<InventoryItem> & { photoNote?: string; updatedBy?: string }
) {
  if (!DB.inventory) throw new Error("NOTION_INVENTORY_DB not configured");

  // Fetch existing page to (a) know the current condition/photo for history diffing
  // and (b) get the current photoHistory to append to.
  let existing: InventoryItem | null = null;
  try {
    const page: any = await (notion as any).pages.retrieve({ page_id: pageId });
    existing = pageToItem(page);
  } catch { /* fall through */ }

  const properties: any = {};
  if (updates.name !== undefined) properties["Name"] = { title: txt(updates.name) };
  if (updates.category !== undefined) properties["Category"] = { rich_text: txt(updates.category) };
  if (updates.currentLevel !== undefined) properties["Current Level"] = { number: updates.currentLevel };
  if (updates.minimumLevel !== undefined) properties[MIN_LEVEL_KEY] = { number: updates.minimumLevel };
  if (updates.present !== undefined) properties["Present"] = { checkbox: updates.present };
  if (updates.condition !== undefined) properties["Condition"] = { rich_text: txt(updates.condition) };
  if (updates.photo !== undefined) properties["Photo"] = updates.photo ? { url: updates.photo } : { url: null };
  if (updates.notes !== undefined) properties["Notes"] = { rich_text: txt(updates.notes) };
  if (updates.kind !== undefined) properties["Kind"] = { select: { name: updates.kind } };

  // Auto-append to photoHistory when condition or photo changes on an asset
  if (existing && existing.kind === "asset") {
    const conditionChanged = updates.condition !== undefined && updates.condition !== existing.condition;
    const photoChanged = updates.photo !== undefined && updates.photo && updates.photo !== existing.photo;
    if (conditionChanged || photoChanged) {
      const entry: AssetPhotoEntry = {
        url: (updates.photo as string) || existing.photo || "",
        uploadedAt: new Date().toISOString(),
        uploadedBy: updates.updatedBy,
        condition: (updates.condition as AssetCondition | undefined) || existing.condition,
        note: updates.photoNote,
      };
      const nextHistory = [...(existing.photoHistory || []), entry];
      properties["Photo History"] = { rich_text: txtJson(nextHistory) };
    }
  }

  if (Object.keys(properties).length === 0) return;
  await (notion as any).pages.update({ page_id: pageId, properties });
}

export async function deleteInventoryItem(pageId: string) {
  if (!DB.inventory) throw new Error("NOTION_INVENTORY_DB not configured");
  // Notion archives rather than hard-deletes
  await (notion as any).pages.update({ page_id: pageId, archived: true });
}
