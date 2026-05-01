"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import FilterDropdown from "./FilterDropdown";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type InventoryKind = "stock" | "asset";

export interface AssetPhotoEntry {
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
  condition?: "Working" | "Damaged" | "Broken" | "Missing";
  note?: string;
}

export interface InventoryItem {
  id: string;
  propertyId: string;
  kind: InventoryKind;
  category: string;
  name: string;
  currentLevel: number;
  minimumLevel: number;
  status?: "OK" | "Low" | "Out" | "Missing" | "Damaged";
  present?: boolean;
  condition?: "Working" | "Damaged" | "Broken" | "Missing";
  photo?: string;
  photoHistory?: AssetPhotoEntry[];
  lastCheckedAt?: string;
  updatedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type Property = any;

/* ------------------------------------------------------------------ */
/*  Default categories                                                 */
/* ------------------------------------------------------------------ */
const DEFAULT_STOCK_CATEGORIES = [
  "Cleaning Supplies",
  "Kitchen Supplies",
  "Bathroom Supplies",
  "Guest Supplies",
];

const DEFAULT_ASSET_CATEGORIES = [
  "Kitchen",
  "Living Room",
  "Bedroom",
  "Bathroom",
  "Hallway",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtRelativeTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (dayStart.getTime() === today.getTime()) return `Today at ${timeStr}`;
    if (dayStart.getTime() === yesterday.getTime()) return `Yesterday at ${timeStr}`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

/**
 * Strips emoji characters from a label for display. Admins sometimes paste
 * names like "🛁 Bathroom" or "🧪 Toilet Paper" into Notion. We render the
 * cleaned-up version everywhere on the inventory tab without mutating the
 * stored data — so any external integration that relied on the original
 * strings keeps working.
 *
 * Covers the common pictographic / dingbat / regional-flag / supplemental-symbols
 * Unicode blocks plus the variation-selector (FE0F) that follows them. Whitespace
 * runs are collapsed and trimmed so a leading-emoji name like "🍳 kitchen"
 * displays as "kitchen" rather than " kitchen".
 */
function stripEmojis(s: string): string {
  if (!s) return s;
  return s
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function conditionColor(c?: string): { bg: string; text: string; dot: string } {
  switch (c) {
    case "Working": return { bg: "#EAF3EF", text: "#2F6B57", dot: "#2F6B57" };
    case "Broken":  return { bg: "#F6EDED", text: "#B7484F", dot: "#B7484F" };
    case "Damaged": return { bg: "#FBF1E2", text: "#8A6A2E", dot: "#D4A843" };
    // Legacy value still rendered consistently with the warning palette.
    case "Missing": return { bg: "#FBF1E2", text: "#8A6A2E", dot: "#D4A843" };
    default:        return { bg: "#F1F1F1", text: "#666",    dot: "#bbb" };
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function InventoryView({ properties: initialProperties }: { properties: Property[] }) {
  // Keep properties in local state so we can update stockSubcategories without a full page reload
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  useEffect(() => { setProperties(initialProperties); }, [initialProperties]);

  const [subTab, setSubTab] = useState<"stock" | "assets">("stock");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProperty, setFilterProperty] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState<"checked" | "name" | "status">("checked");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<{ propertyId: string; category?: string } | null>(null);
  const [addCategoryFor, setAddCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [auditItem, setAuditItem] = useState<InventoryItem | null>(null);
  const [savingCats, setSavingCats] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory").then((r) => r.json());
      setItems(res?.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((i) => {
      if (i.kind !== (subTab === "stock" ? "stock" : "asset")) return false;
      if (filterProperty && i.propertyId !== filterProperty) return false;
      if (filterCategory && i.category !== filterCategory) return false;
      if (filterStatus) {
        if (subTab === "assets") {
          if ((i.condition || "Working") !== filterStatus) return false;
        } else if (i.status !== filterStatus) return false;
      }
      if (q) {
        const hay = `${i.name} ${i.category} ${i.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, subTab, search, filterProperty, filterCategory, filterStatus]);

  const stats = useMemo(() => {
    const stock = items.filter((i) => i.kind === "stock");
    const assets = items.filter((i) => i.kind === "asset");
    const lowSet = new Set<string>();
    const outSet = new Set<string>();
    let lowTotal = 0, outTotal = 0;
    for (const i of stock) {
      if (i.status === "Low") { lowTotal++; lowSet.add(i.propertyId); }
      if (i.status === "Out") { outTotal++; outSet.add(i.propertyId); }
    }
    const missingSet = new Set<string>();
    const brokenSet = new Set<string>();
    let missingTotal = 0, brokenTotal = 0;
    for (const a of assets) {
      const c = a.condition || "Working";
      // "Missing" amenities now come from the Present=No toggle (legacy
      // condition === "Missing" still counts so older records aren't lost).
      if (a.present === false || c === "Missing") { missingTotal++; missingSet.add(a.propertyId); }
      // "Broken" stat now also picks up the new "Damaged" state.
      if (c === "Broken" || c === "Damaged") { brokenTotal++; brokenSet.add(a.propertyId); }
    }
    return {
      low: { total: lowTotal, properties: lowSet.size },
      out: { total: outTotal, properties: outSet.size },
      missing: { total: missingTotal, properties: missingSet.size },
      damaged: { total: brokenTotal, properties: brokenSet.size },
    };
  }, [items]);

  const groupedByProperty = useMemo(() => {
    const byProp = new Map<string, InventoryItem[]>();
    for (const i of filtered) {
      const arr = byProp.get(i.propertyId) || [];
      arr.push(i);
      byProp.set(i.propertyId, arr);
    }
    return Array.from(byProp.entries()).map(([pid, list]) => {
      const prop = properties.find((p: Property) => p.id === pid);
      const byCat = new Map<string, InventoryItem[]>();
      for (const it of list) {
        const arr = byCat.get(it.category) || [];
        arr.push(it);
        byCat.set(it.category, arr);
      }
      return {
        propertyId: pid,
        propertyName: prop?.name || "Unknown property",
        propertyLocation: [prop?.city, prop?.country].filter(Boolean).join(", "),
        lastChecked: list.map((i) => i.lastCheckedAt || "").sort().pop() || "",
        categories: Array.from(byCat.entries()).map(([cat, its]) => ({ category: cat, items: its })),
      };
    });
  }, [filtered, properties]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.kind === (subTab === "stock" ? "stock" : "asset")) set.add(i.category);
    return Array.from(set).sort();
  }, [items, subTab]);

  const updateLevel = async (id: string, field: "currentLevel" | "minimumLevel", delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newValue = Math.max(0, (item[field] || 0) + delta);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: newValue } : i));
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: newValue }),
    });
    fetchItems();
  };

  const patchItem = async (id: string, updates: Partial<InventoryItem> & { photoNote?: string }) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updates } : i));
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    fetchItems();
  };

  const addItem = async (data: { propertyId: string; kind: InventoryKind; category: string; name: string; currentLevel: number; minimumLevel: number; condition?: string; present?: boolean; photo?: string }) => {
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Helper: current list of stock subcategories for a property (from Notion)
  const getSubcats = useCallback((propertyId: string): string[] => {
    const p = properties.find((pp: any) => pp.id === propertyId);
    return (p?.stockSubcategories as string[] | undefined) || [];
  }, [properties]);

  // Persist per-property stock subcategories via PATCH /api/properties
  const persistSubcats = async (propertyId: string, next: string[]) => {
    setSavingCats(true);
    try {
      // Optimistic local update
      setProperties((prev: Property[]) => prev.map((p: Property) => p.id === propertyId ? { ...p, stockSubcategories: next } : p));
      const res = await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: propertyId, stockSubcategories: next }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || `Failed to save (HTTP ${res.status})`);
        // Roll back on failure
        setProperties(initialProperties);
      }
    } catch (e) {
      console.error(e);
      setProperties(initialProperties);
    } finally { setSavingCats(false); }
  };

  const addCustomCategory = async (propertyId: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const current = getSubcats(propertyId);
    if (current.includes(clean)) { setAddCategoryFor(null); setNewCategoryName(""); return; }
    await persistSubcats(propertyId, [...current, clean]);
    setAddCategoryFor(null);
    setNewCategoryName("");
  };

  const removeCategory = async (propertyId: string, name: string) => {
    const itemsInCat = items.filter((i: InventoryItem) => i.propertyId === propertyId && i.kind === "stock" && i.category === name);
    if (itemsInCat.length > 0) {
      if (!confirm(`Remove "${name}" category? It still has ${itemsInCat.length} item${itemsInCat.length === 1 ? "" : "s"}. The items will stay but the category header won't appear unless you re-add it.`)) return;
    }
    const current = getSubcats(propertyId);
    await persistSubcats(propertyId, current.filter((c: string) => c !== name));
  };

  // Only "Live" properties with a real name are selectable in the Add item /
  // Add amenity modal. Draft / Suspended / Onboarding / Maintenance / In Review
  // are hidden. Empty-named properties are skipped (they cause blank rows in
  // the <select>).
  const cleaningProperties = useMemo(() => {
    return properties.filter((p: any) => {
      const hasName = typeof p.name === "string" && p.name.trim().length > 0;
      const isLive = p.status === "Live";
      return hasName && isLive;
    });
  }, [properties]);

  const propertyFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.kind === (subTab === "stock" ? "stock" : "asset")) set.add(i.propertyId);
    return properties.filter((p: any) => set.has(p.id));
  }, [items, properties, subTab]);

  const isAssets = subTab === "assets";
  const defaultCats = isAssets ? DEFAULT_ASSET_CATEGORIES : DEFAULT_STOCK_CATEGORIES;

  return (
    <div>
      {/* Top toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-[260px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory..."
            className="w-full h-[36px] pl-8 pr-3 border border-[#e2e2e2] rounded-lg text-[12px] text-[#333] placeholder:text-[#bbb] outline-none transition-colors bg-white"
          />
        </div>
        <FilterDropdown
          value={filterProperty}
          onChange={setFilterProperty}
          placeholder="All properties"
          searchable
          options={propertyFilterOptions.map((p: Property) => ({ value: p.id, label: stripEmojis(p.name || "") }))}
        />
        <FilterDropdown
          value={filterCategory}
          onChange={setFilterCategory}
          placeholder="All categories"
          options={allCategories.map((c) => ({ value: c, label: stripEmojis(c) }))}
        />
        <FilterDropdown
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder={isAssets ? "All conditions" : "All statuses"}
          options={!isAssets
            ? [
              { value: "OK", label: "OK" },
              { value: "Low", label: "Low" },
              { value: "Out", label: "Out of stock" },
            ]
            : [
              { value: "Working", label: "Working" },
              { value: "Damaged", label: "Damaged" },
              { value: "Broken", label: "Broken" },
            ]
          }
        />
        <FilterDropdown
          value={sort}
          onChange={(v) => setSort((v as "checked" | "name" | "status") || "checked")}
          placeholder="Sort by last checked"
          options={[
            { value: "checked", label: "Sort by last checked" },
            { value: "name", label: "Sort by name" },
            { value: "status", label: isAssets ? "Sort by condition" : "Sort by status" },
          ]}
        />
        <button onClick={() => setAddingFor({ propertyId: cleaningProperties[0]?.id || "" })}
          className="ml-auto flex items-center gap-1.5 h-[36px] px-3 rounded-lg border border-[#e2e2e2] bg-white text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] transition-all">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {isAssets ? "Add amenity" : "Add item"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard bg="#FBF1E2" border="#E8DDC7" textColor="#8A6A2E" icon="arrow-down" title="Low stock items" total={stats.low.total} propertiesCount={stats.low.properties} />
        <StatCard bg="#F6EDED" border="#E8D8D8" textColor="#B7484F" icon="ban" title="Out of stock" total={stats.out.total} propertiesCount={stats.out.properties} />
        <StatCard bg="#FBF1E2" border="#E8DDC7" textColor="#8A6A2E" icon="alert" title="Missing amenities" total={stats.missing.total} propertiesCount={stats.missing.properties} />
        <StatCard bg="#F6EDED" border="#E8D8D8" textColor="#B7484F" icon="x" title="Broken amenities" total={stats.damaged.total} propertiesCount={stats.damaged.properties} />
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0 border-b border-[#eaeaea] mb-4">
        {([{ key: "stock" as const, label: "Stock" }, { key: "assets" as const, label: "Amenities" }]).map((t) => (
          <button key={t.key} onClick={() => { setSubTab(t.key); setFilterStatus(""); setFilterCategory(""); }}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${subTab === t.key ? "text-[#80020E] border-[#80020E]" : "text-[#999] border-transparent hover:text-[#555]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-[#999] text-sm">Loading inventory...</div>
      ) : groupedByProperty.length === 0 ? (
        <div className="bg-white border border-[#eaeaea] rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/></svg>
          </div>
          <div className="text-[15px] font-semibold text-[#111] mb-1">No {isAssets ? "amenities" : "stock items"} yet</div>
          <div className="text-[13px] text-[#888] max-w-[380px] mx-auto">Click <strong>{isAssets ? "Add amenity" : "Add item"}</strong> to start tracking {isAssets ? "amenities" : "inventory"} for a property.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByProperty.map((group) => {
            // Stock: source category list from Notion's "Stock Subcategories" multi-select per property
            const propertySubcats = !isAssets ? getSubcats(group.propertyId) : [];
            const categoryOrder = isAssets ? defaultCats : propertySubcats;
            // Merge: include any category that either (a) appears in the Notion subcategory list,
            // or (b) is used by at least one existing item (so we don't orphan items).
            const existingWithItems = group.categories.map((c: { category: string; items: InventoryItem[] }) => c.category);
            const allCategoryNames = Array.from(new Set([...categoryOrder, ...existingWithItems]));
            const virtualCategories = allCategoryNames.map((catName: string) => {
              const found = group.categories.find((c: { category: string; items: InventoryItem[] }) => c.category === catName);
              return found || { category: catName, items: [] as InventoryItem[] };
            });
            const sortedCategories = virtualCategories.sort((a, b) => {
              const ai = categoryOrder.indexOf(a.category);
              const bi = categoryOrder.indexOf(b.category);
              if (ai === -1 && bi === -1) return a.category.localeCompare(b.category);
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            });

            return (
              <div key={group.propertyId} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
                  <div>
                    <div className="text-[14px] font-bold text-[#111]">{group.propertyName}</div>
                    {group.propertyLocation && <div className="text-[11px] text-[#888]">{group.propertyLocation}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    {group.lastChecked && <span className="text-[11px] text-[#888]">Last checked, <span className="font-medium text-[#555]">{fmtRelativeTime(group.lastChecked)}</span></span>}
                    <div className="flex items-center gap-1">
                      <button onClick={() => setAddCategoryFor(group.propertyId)}
                        title={isAssets ? "Add room" : "Add category"}
                        className="w-7 h-7 flex items-center justify-center rounded border border-[#e2e2e2] text-[#666] hover:border-[#80020E] hover:text-[#80020E] transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                {addCategoryFor === group.propertyId && (
                  <div className="px-5 py-3 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addCustomCategory(group.propertyId, newCategoryName); if (e.key === "Escape") { setAddCategoryFor(null); setNewCategoryName(""); } }}
                      placeholder={isAssets ? "New room (e.g. Bedroom 2)" : "New category name"}
                      autoFocus
                      className="flex-1 h-[32px] px-3 border border-[#e2e2e2] rounded-md text-[12px] outline-none focus:border-[#80020E] transition-colors bg-white"
                    />
                    <button onClick={() => addCustomCategory(group.propertyId, newCategoryName)} className="h-[32px] px-3 rounded-md bg-[#80020E] text-white text-[11px] font-semibold">Add</button>
                    <button onClick={() => { setAddCategoryFor(null); setNewCategoryName(""); }} className="h-[32px] px-3 text-[11px] text-[#666]">Cancel</button>
                  </div>
                )}

                <div className="divide-y divide-[#f3f3f3]">
                  {sortedCategories.map((cat) => {
                    const groupKey = `${group.propertyId}__${cat.category}`;
                    const isCollapsed = collapsedGroups[groupKey];
                    const sortedItems = [...cat.items].sort((a, b) => {
                      if (sort === "name") return a.name.localeCompare(b.name);
                      if (sort === "status") {
                        if (isAssets) {
                          const order = { "Broken": 0, "Damaged": 1, "Missing": 2, "Working": 3 } as Record<string, number>;
                          return (order[a.condition || "Working"] ?? 9) - (order[b.condition || "Working"] ?? 9);
                        }
                        const order = { "Out": 0, "Low": 1, "Missing": 2, "Damaged": 3, "OK": 4 } as Record<string, number>;
                        return (order[a.status || "OK"] ?? 9) - (order[b.status || "OK"] ?? 9);
                      }
                      return (b.lastCheckedAt || "").localeCompare(a.lastCheckedAt || "");
                    });

                    return (
                      <div key={cat.category}>
                        {/* Header row */}
                        {isAssets ? (
                          <div className="grid grid-cols-[64px_minmax(180px,2fr)_90px_140px_130px_110px_60px] gap-3 items-center px-5 py-2.5 bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                            <button onClick={() => setCollapsedGroups((p) => ({ ...p, [groupKey]: !p[groupKey] }))}
                              className="flex items-center gap-1 text-[12px] font-bold text-[#111] normal-case tracking-normal hover:text-[#80020E] transition-colors">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <span className="text-[12px] font-bold text-[#111] normal-case tracking-normal">{stripEmojis(cat.category)}</span>
                            <span>Present</span>
                            <span>Condition</span>
                            <span>Last checked</span>
                            <span>Updated by</span>
                            <span className="text-right">Actions</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-[minmax(200px,2fr)_120px_160px_120px_140px_120px_60px] gap-3 items-center px-5 py-2.5 bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setCollapsedGroups((p) => ({ ...p, [groupKey]: !p[groupKey] }))}
                                className="flex items-center gap-1.5 text-[12px] font-bold text-[#111] normal-case tracking-normal hover:text-[#80020E] transition-colors">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                                {stripEmojis(cat.category)}
                              </button>
                              {propertySubcats.includes(cat.category) && (
                                <button onClick={() => removeCategory(group.propertyId, cat.category)}
                                  disabled={savingCats}
                                  title="Remove category"
                                  className="w-4 h-4 flex items-center justify-center rounded text-[#bbb] hover:text-[#B7484F] hover:bg-[#F6EDED] transition-colors disabled:opacity-40">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              )}
                            </div>
                            <span>Category</span>
                            <span>Current level</span>
                            <span>Minimum level</span>
                            <span>Status</span>
                            <span>Last checked</span>
                            <span className="text-right">Updated by</span>
                          </div>
                        )}

                        {!isCollapsed && (
                          <>
                            {sortedItems.map((item) => (
                              isAssets ? (
                                <AssetRow
                                  key={item.id}
                                  item={item}
                                  onPatch={patchItem}
                                  onDelete={() => deleteItem(item.id)}
                                  onViewAudit={() => setAuditItem(item)}
                                />
                              ) : (
                                <InventoryRow
                                  key={item.id}
                                  item={item}
                                  onUpdateLevel={updateLevel}
                                  onDelete={() => deleteItem(item.id)}
                                />
                              )
                            ))}
                            <div className="px-5 py-2 bg-white">
                              <button onClick={() => setAddingFor({ propertyId: group.propertyId, category: cat.category })}
                                className="text-[11px] text-[#80020E] hover:underline font-medium">+ Add {isAssets ? "amenity" : "item"} to {stripEmojis(cat.category)}</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {group.categories.length === 0 && (
                    <div className="p-5 text-center text-[12px] text-[#999]">No items tracked yet for this property.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addingFor && (
        <AddItemModal
          properties={cleaningProperties}
          defaultPropertyId={addingFor.propertyId}
          defaultCategory={addingFor.category}
          kind={isAssets ? "asset" : "stock"}
          onClose={() => setAddingFor(null)}
          onSave={async (data) => {
            await addItem(data);
            setAddingFor(null);
          }}
          getSubcats={getSubcats}
        />
      )}

      {auditItem && (
        <AssetAuditModal item={auditItem} onClose={() => setAuditItem(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({ title, total, propertiesCount, bg, border, textColor, icon }: {
  title: string;
  total: number;
  propertiesCount: number;
  bg: string;
  border: string;
  textColor: string;
  icon: "arrow-down" | "ban" | "alert" | "x";
}) {
  const iconPath = {
    "arrow-down": <path d="M12 5v14M19 12l-7 7-7-7"/>,
    "ban": <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>,
    "alert": <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    "x": <><path d="M12 22s8-6 8-12V5l-8-3-8 3v5c0 6 8 12 8 12z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></>,
  }[icon];
  return (
    <div className="rounded-xl p-3.5 border" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center gap-2 mb-0.5" style={{ color: textColor }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconPath}</svg>
        <span className="text-[12px] font-semibold">{title}</span>
      </div>
      <div className="text-[14px] font-semibold" style={{ color: textColor }}>
        {total} in total <span className="font-normal opacity-80">({propertiesCount} {propertiesCount === 1 ? "property" : "properties"})</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stock row                                                          */
/* ------------------------------------------------------------------ */
function InventoryRow({ item, onUpdateLevel, onDelete }: {
  item: InventoryItem;
  onUpdateLevel: (id: string, field: "currentLevel" | "minimumLevel", delta: number) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = item.status || (item.currentLevel <= 0 ? "Out" : item.currentLevel <= item.minimumLevel ? "Low" : "OK");
  const statusCls = status === "OK" ? "text-[#2F6B57] bg-[#EAF3EF]" : status === "Low" ? "text-[#8A6A2E] bg-[#FBF1E2]" : "text-[#B7484F] bg-[#F6EDED]";
  const statusDot = status === "OK" ? "#2F6B57" : status === "Low" ? "#D4A843" : "#B7484F";
  return (
    <div className="grid grid-cols-[minmax(200px,2fr)_120px_160px_120px_140px_120px_60px] gap-3 items-center px-5 py-2.5 text-[12px] hover:bg-[#fafafa] transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-[#111] truncate">{stripEmojis(item.name)}</span>
      </div>
      <span className="text-[#666]">{stripEmojis(item.category)}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onUpdateLevel(item.id, "currentLevel", -1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#e2e2e2] text-[#666] hover:border-[#80020E] hover:text-[#80020E] transition-colors">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span className="w-8 text-center tabular-nums font-semibold text-[#111]">{item.currentLevel}</span>
        <button onClick={() => onUpdateLevel(item.id, "currentLevel", 1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#e2e2e2] text-[#666] hover:border-[#80020E] hover:text-[#80020E] transition-colors">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <span className="tabular-nums text-[#666]">{item.minimumLevel}</span>
      <div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCls}`}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusDot }} />
          {status}
        </span>
      </div>
      <span className="text-[11px] text-[#888]">{fmtRelativeTime(item.lastCheckedAt)}</span>
      <div className="text-right relative">
        <span className="text-[11px] text-[#888] mr-1">{item.updatedBy ? item.updatedBy.split("@")[0] : "—"}</span>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-[14px] text-[#bbb] hover:text-[#555] px-1.5">⋯</button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white border border-[#eaeaea] rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full text-left px-3 py-1.5 text-[11px] text-[#B7484F] hover:bg-[#F6EDED] transition-colors">Delete item</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset row                                                          */
/* ------------------------------------------------------------------ */
function AssetRow({ item, onPatch, onDelete, onViewAudit }: {
  item: InventoryItem;
  onPatch: (id: string, updates: Partial<InventoryItem> & { photoNote?: string }) => void;
  onDelete: () => void;
  onViewAudit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const conditionRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const condition = item.condition || "Working";
  const present = item.present !== false;
  const cCol = conditionColor(condition);
  const historyCount = (item.photoHistory || []).length;

  // Close the inline condition popover when clicking outside.
  useEffect(() => {
    if (!conditionOpen) return;
    const handler = (e: MouseEvent) => {
      if (conditionRef.current && !conditionRef.current.contains(e.target as Node)) {
        setConditionOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [conditionOpen]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/inventory/upload", { method: "POST", body: fd }).then((r) => r.json());
      if (res?.ok && res.url) {
        onPatch(item.id, { photo: res.url });
      } else {
        alert(res?.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid grid-cols-[64px_minmax(180px,2fr)_90px_140px_130px_110px_60px] gap-3 items-center px-5 py-2.5 text-[12px] hover:bg-[#fafafa] transition-colors">
      {/* Photo thumbnail */}
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-12 h-12 rounded-lg border border-[#eaeaea] bg-[#fafafa] overflow-hidden relative group hover:border-[#80020E] transition-colors"
          title={item.photo ? "Replace photo" : "Upload photo"}
        >
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#bbb]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>
      </div>

      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-[#111] truncate">{stripEmojis(item.name)}</span>
        {historyCount > 0 && (
          <button onClick={onViewAudit}
            title={`${historyCount} photo ${historyCount === 1 ? "entry" : "entries"} in audit trail`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F1F1F1] text-[#666] text-[9px] font-semibold hover:bg-[#e4e4e4] transition-colors">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {historyCount}
          </button>
        )}
      </div>

      {/* Present toggle */}
      <div>
        <button
          onClick={() => onPatch(item.id, { present: !present })}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${present ? "bg-[#EAF3EF] text-[#2F6B57]" : "bg-[#F6EDED] text-[#B7484F]"}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: present ? "#2F6B57" : "#B7484F" }} />
          {present ? "Yes" : "No"}
        </button>
      </div>

      {/* Condition dropdown — custom inline popover (instead of native `<select>`)
          so the menu is always rendered with a white background and matches the
          rest of the app, regardless of the user's OS dark-mode preference. */}
      <div ref={conditionRef} className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setConditionOpen((o) => !o)}
          className="h-[28px] pl-6 pr-7 rounded-md border border-[#e2e2e2] bg-white text-[11px] font-semibold cursor-pointer relative flex items-center hover:border-[#bbb] transition-colors"
          style={{ color: cCol.text }}
          aria-haspopup="listbox"
          aria-expanded={conditionOpen}
        >
          <span className="absolute left-2.5 w-1.5 h-1.5 rounded-full pointer-events-none" style={{ backgroundColor: cCol.dot }} />
          {condition}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" className="absolute right-2 pointer-events-none">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {conditionOpen && (
          <div
            className="absolute top-full mt-1 left-0 z-50 min-w-[140px] bg-white border border-[#e2e2e2] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.08)] py-1"
            role="listbox"
          >
            {(["Working", "Damaged", "Broken"] as const).map((c) => {
              const oc = conditionColor(c);
              const selected = c === condition;
              return (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onPatch(item.id, { condition: c });
                    setConditionOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-left transition-colors ${selected ? "bg-[#fafafa]" : "hover:bg-[#f5f5f5]"}`}
                  style={{ color: oc.text }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: oc.dot }} />
                  <span className="flex-1">{c}</span>
                  {selected && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="flex-shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Last checked */}
      <span className="text-[11px] text-[#888]">{fmtRelativeTime(item.lastCheckedAt)}</span>

      {/* Updated by */}
      <span className="text-[11px] text-[#888] truncate">{item.updatedBy ? item.updatedBy.split("@")[0] : "—"}</span>

      {/* Actions */}
      <div className="text-right relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-[14px] text-[#bbb] hover:text-[#555] px-1.5">⋯</button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white border border-[#eaeaea] rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
              <button onClick={() => { setMenuOpen(false); onViewAudit(); }} className="w-full text-left px-3 py-1.5 text-[11px] text-[#333] hover:bg-[#f5f5f5] transition-colors">View photo trail</button>
              <button onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} className="w-full text-left px-3 py-1.5 text-[11px] text-[#333] hover:bg-[#f5f5f5] transition-colors">{item.photo ? "Replace photo" : "Upload photo"}</button>
              <div className="h-px bg-[#eee] my-1" />
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full text-left px-3 py-1.5 text-[11px] text-[#B7484F] hover:bg-[#F6EDED] transition-colors">Delete amenity</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset audit modal                                                  */
/* ------------------------------------------------------------------ */
function AssetAuditModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const history = [...(item.photoHistory || [])].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl w-[92vw] max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-[#111]">Photo trail · {stripEmojis(item.name)}</div>
            <div className="text-[11px] text-[#888] mt-0.5">{stripEmojis(item.category)}</div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-[#999]">No photo history yet. Upload a photo to start tracking.</div>
          ) : (
            history.map((e, i) => {
              const cCol = conditionColor(e.condition);
              return (
                <div key={i} className="flex gap-3 p-3 rounded-xl border border-[#eee] bg-[#fafafa]">
                  {e.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={e.url} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={e.url} alt="" className="w-20 h-20 rounded-lg object-cover border border-[#eaeaea]" />
                    </a>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-[#f0f0f0] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.condition && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: cCol.bg, color: cCol.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cCol.dot }} />
                          {e.condition}
                        </span>
                      )}
                      <span className="text-[11px] text-[#555]">{fmtRelativeTime(e.uploadedAt)}</span>
                    </div>
                    {e.uploadedBy && <div className="text-[11px] text-[#888] mt-1">by {e.uploadedBy}</div>}
                    {e.note && <div className="text-[12px] text-[#333] mt-1">{e.note}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Add item modal                                                     */
/* ------------------------------------------------------------------ */
function AddItemModal({ properties, defaultPropertyId, defaultCategory, kind, onClose, onSave, getSubcats }: {
  properties: Property[];
  defaultPropertyId?: string;
  defaultCategory?: string;
  kind: InventoryKind;
  onClose: () => void;
  onSave: (data: { propertyId: string; kind: InventoryKind; category: string; name: string; currentLevel: number; minimumLevel: number; condition?: string; present?: boolean; photo?: string }) => void;
  getSubcats: (propertyId: string) => string[];
}) {
  const isAsset = kind === "asset";
  const defaultCats = isAsset ? DEFAULT_ASSET_CATEGORIES : DEFAULT_STOCK_CATEGORIES;
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [category, setCategory] = useState(defaultCategory || defaultCats[0]);
  const [name, setName] = useState("");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [minimumLevel, setMinimumLevel] = useState(1);
  const [condition, setCondition] = useState<"Working" | "Damaged" | "Broken">("Working");
  const [present, setPresent] = useState(true);
  const [photo, setPhoto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // For stock: source from the property's Notion "Stock Subcategories" list.
  // For assets: derive from the property's Main Spaces config (bedrooms, bathrooms,
  // Living Room, Balcony, Hallway) so admins only see rooms that actually exist.
  const selectedProperty = properties.find((p: any) => p.id === propertyId);
  const assetRoomsForProperty = useMemo<string[]>(() => {
    if (!isAsset || !selectedProperty) return isAsset ? defaultCats : [];
    const rooms: string[] = ["Kitchen"];
    if (selectedProperty.livingRoom !== false) rooms.push("Living Room");
    const bedCount = Math.max(1, Number(selectedProperty.bedrooms) || 1);
    if (bedCount === 1) rooms.push("Bedroom");
    else for (let i = 1; i <= bedCount; i++) rooms.push(`Bedroom ${i}`);
    const bathCount = Math.max(1, Number(selectedProperty.bathrooms) || 1);
    if (bathCount === 1) rooms.push("Bathroom");
    else for (let i = 1; i <= bathCount; i++) rooms.push(`Bathroom ${i}`);
    if (selectedProperty.balcony) rooms.push("Balcony");
    if (selectedProperty.hallway !== false) rooms.push("Hallway");
    return rooms;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAsset, selectedProperty?.id, selectedProperty?.livingRoom, selectedProperty?.balcony, selectedProperty?.hallway, selectedProperty?.bedrooms, selectedProperty?.bathrooms]);
  const propertySubcats = isAsset ? [] : getSubcats(propertyId);
  const categoryOptions = isAsset
    ? Array.from(new Set(assetRoomsForProperty))
    : Array.from(new Set(propertySubcats));
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/inventory/upload", { method: "POST", body: fd }).then((r) => r.json());
      if (res?.ok && res.url) setPhoto(res.url);
      else alert(res?.error || "Upload failed");
    } catch { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!propertyId || !category || !name.trim()) return;
    setSaving(true);
    await onSave({
      propertyId, kind, category, name: name.trim(), currentLevel, minimumLevel,
      ...(isAsset ? { condition, present, photo: photo || undefined } : {}),
    });
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[460px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-center justify-between">
          <div className="text-[15px] font-bold text-[#111]">Add {isAsset ? "amenity" : "stock item"}</div>
          <button onClick={onClose} className="p-1.5 text-[#999] hover:text-[#555]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
              <option value="">Select property</option>
              {properties.map((p: Property) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">{isAsset ? "Room" : "Category"}</label>
            {showCustomCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => { setCustomCategory(e.target.value); setCategory(e.target.value); }}
                  placeholder={isAsset ? "New room name" : "New category name"}
                  autoFocus
                  className="flex-1 h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]"
                />
                <button type="button"
                  onClick={() => { setShowCustomCategory(false); setCustomCategory(""); setCategory(categoryOptions[0] || ""); }}
                  className="h-[40px] px-3 text-[12px] text-[#666] border border-[#e2e2e2] rounded-lg hover:border-[#80020E]">Cancel</button>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setShowCustomCategory(true);
                    setCustomCategory("");
                    setCategory("");
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]"
              >
                <option value="">Select {isAsset ? "room" : "category"}</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Add new {isAsset ? "room" : "category"}...</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">{isAsset ? "Amenity name" : "Item name"}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAsset ? "e.g. Kettle" : "e.g. Dish soap"}
              className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]"
            />
          </div>
          {isAsset ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#555] mb-1.5">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none">
                    <option value="Working">Working</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#555] mb-1.5">Present</label>
                  <select value={present ? "yes" : "no"} onChange={(e) => setPresent(e.target.value === "yes")}
                    className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] bg-white outline-none focus:border-[#80020E]">
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#555] mb-1.5">Photo (optional)</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {photo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#eaeaea]" />
                    <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] text-[#80020E] font-medium hover:underline">Replace</button>
                    <button type="button" onClick={() => setPhoto("")} className="text-[12px] text-[#999] hover:text-[#B7484F]">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full h-[80px] border-2 border-dashed border-[#e2e2e2] rounded-lg text-[12px] text-[#888] hover:border-[#80020E] hover:text-[#80020E] transition-colors">
                    {uploading ? "Uploading..." : "Click to upload photo"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#555] mb-1.5">Current level</label>
                <input type="number" min={0} value={currentLevel} onChange={(e) => setCurrentLevel(Number(e.target.value))}
                  className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#555] mb-1.5">Minimum level</label>
                <input type="number" min={0} value={minimumLevel} onChange={(e) => setMinimumLevel(Number(e.target.value))}
                  className="w-full h-[40px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] outline-none focus:border-[#80020E]" />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] flex justify-end gap-2">
          <button onClick={onClose} className="h-[36px] px-4 text-[12px] font-medium text-[#666] hover:text-[#111] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!propertyId || !category || !name.trim() || saving}
            className="h-[36px] px-4 rounded-lg bg-[#80020E] text-white text-[12px] font-semibold hover:bg-[#6b010c] transition-colors disabled:opacity-50">
            {saving ? "Adding..." : `Add ${isAsset ? "amenity" : "item"}`}
          </button>
        </div>
      </div>
    </>
  );
}
