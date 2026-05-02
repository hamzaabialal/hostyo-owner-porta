"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import {
  buildChecklist,
  applyChecklistOverrides,
  countChecklistItems,
  parseChecklistOverrides,
  itemKey,
  type ChecklistCategory,
  type ChecklistOverrides,
} from "@/lib/turnover-checklist";

/**
 * Admin editor for the per-property turnover checklist.
 *
 * Shows the curated default checklist (computed by `buildChecklist` from the
 * property's bedrooms/bathrooms/amenities/etc.) and lets the admin:
 *
 *   - Toggle any default item on/off. Disabled items disappear from the
 *     cleaner's view AND the admin's progress denominator on the next reload.
 *   - Add custom items inline at the end of any subcategory. Custom items
 *     are namespaced (`custom-<id>`) so they survive label edits without
 *     orphaning their photo state.
 *
 * Both operations are stored in a single `Checklist Overrides` JSON blob on
 * the property record. The component edits a draft locally and only writes
 * to Notion when the user clicks "Save changes".
 */

interface Property {
  id: string;
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingRoom?: boolean;
  balcony?: boolean;
  hallway?: boolean;
  amenities?: string[];
  checklistOverrides?: string | null;
}

export default function PropertyChecklistEditor({
  property,
  onSaved,
}: {
  property: Property;
  onSaved?: (updated: Property) => void;
}) {
  // The curated default — computed without overrides so we always see the
  // base item list even if `disabled` already strips some of them.
  const defaults = useMemo<ChecklistCategory[]>(
    () => buildChecklist({
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      livingRoom: property.livingRoom,
      balcony: property.balcony,
      hallway: property.hallway,
      amenities: property.amenities,
      // Deliberately omit overrides — we want the full default surface.
    }),
    [property.bedrooms, property.bathrooms, property.livingRoom, property.balcony, property.hallway, property.amenities],
  );

  const [draft, setDraft] = useState<ChecklistOverrides>(() => parseChecklistOverrides(property.checklistOverrides));
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => stableStringify(parseChecklistOverrides(property.checklistOverrides)));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null); // `${catId}__${subId}` while inline-adding
  const [newItemLabel, setNewItemLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = stableStringify(draft) !== savedSnapshot;

  // Apply the draft to compute the resolved (cleaner-visible) checklist —
  // used only for the live total at the top of each section.
  const resolved = useMemo(() => applyChecklistOverrides(defaults, draft), [defaults, draft]);
  const resolvedTotal = countChecklistItems(resolved);
  const defaultTotal = countChecklistItems(defaults);

  const disabledSet = new Set(draft.disabled || []);
  const addedByKey = new Map<string, { id: string; label: string }[]>();
  for (const a of draft.added || []) {
    const k = `${a.categoryId}__${a.subcategoryId}`;
    const list = addedByKey.get(k) || [];
    list.push({ id: a.id, label: a.label });
    addedByKey.set(k, list);
  }

  const toggleItem = (catId: string, subId: string, itId: string) => {
    const key = itemKey(catId, subId, itId);
    setDraft((prev) => {
      const next = { ...prev, disabled: [...(prev.disabled || [])] };
      const idx = next.disabled.indexOf(key);
      if (idx >= 0) next.disabled.splice(idx, 1);
      else next.disabled.push(key);
      return next;
    });
  };

  const addCustomItem = (catId: string, subId: string) => {
    const label = newItemLabel.trim();
    if (!label) return;
    setDraft((prev) => ({
      ...prev,
      added: [
        ...(prev.added || []),
        {
          categoryId: catId,
          subcategoryId: subId,
          // Stable per-property id; "custom-" prefix prevents collisions with
          // the slug-based default IDs in turnover-checklist.ts.
          id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          label,
        },
      ],
    }));
    setNewItemLabel("");
    setAdding(null);
  };

  const removeCustomItem = (catId: string, subId: string, itId: string) => {
    setDraft((prev) => ({
      ...prev,
      added: (prev.added || []).filter((a) => !(a.categoryId === catId && a.subcategoryId === subId && a.id === itId)),
    }));
  };

  const reset = () => {
    const fresh = parseChecklistOverrides(property.checklistOverrides);
    setDraft(fresh);
    setSavedSnapshot(stableStringify(fresh));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = JSON.stringify({
        // Only persist non-empty arrays so the field doesn't accumulate noise.
        ...(draft.disabled?.length ? { disabled: draft.disabled } : {}),
        ...(draft.added?.length ? { added: draft.added } : {}),
      });
      const res = await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: property.id, checklistOverrides: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to save checklist overrides.");
        return;
      }
      setSavedSnapshot(stableStringify(draft));
      onSaved?.(data.property as Property);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with totals + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#eaeaea] rounded-xl px-5 py-4">
        <div>
          <div className="text-[14px] font-semibold text-[#111]">Turnover checklist</div>
          <div className="text-[12px] text-[#888] mt-0.5">
            {resolvedTotal} item{resolvedTotal === 1 ? "" : "s"} active
            {defaultTotal !== resolvedTotal && (
              <span className="text-[#999]"> · {defaultTotal - resolvedTotal} disabled</span>
            )}
            {draft.added?.length ? (
              <span className="text-[#999]"> · {draft.added.length} custom</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="h-[36px] px-3 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#999] transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="h-[36px] px-4 rounded-lg border border-[#80020E] text-[12px] font-semibold text-[#80020E] bg-transparent hover:bg-[#80020E]/5 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#F6EDED] border border-[#E8D8D8] rounded-xl px-4 py-3 text-[12px] text-[#7A5252]">{error}</div>
      )}

      {/* Categories */}
      {defaults.map((cat) => {
        const catCollapsed = collapsed[cat.id];
        // Live count for this category after disable + custom merging.
        const liveCat = resolved.find((c) => c.id === cat.id);
        const liveCount = liveCat ? liveCat.subcategories.reduce((s, sub) => s + sub.items.length, 0) : 0;
        const baseCount = cat.subcategories.reduce((s, sub) => s + sub.items.length, 0);

        return (
          <div key={cat.id} className="bg-white border border-[#eaeaea] rounded-xl">
            <button
              type="button"
              onClick={() => setCollapsed((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#fafafa] transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: catCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                <span className="text-[14px] font-semibold text-[#111]">{cat.label}</span>
              </div>
              <span className="text-[11px] text-[#888]">{liveCount} / {baseCount}</span>
            </button>

            {!catCollapsed && (
              <div className="px-5 pb-5 space-y-5 border-t border-[#f0f0f0]">
                {cat.subcategories.map((sub) => {
                  const k = `${cat.id}__${sub.id}`;
                  const customItems = addedByKey.get(k) || [];
                  return (
                    <div key={sub.id}>
                      <div className="text-[12px] font-semibold text-[#111] uppercase tracking-wider mt-4 mb-2">
                        {sub.label}
                      </div>
                      <div className="space-y-1">
                        {/* Default items (toggleable) */}
                        {sub.items.map((it) => {
                          const key = itemKey(cat.id, sub.id, it.id);
                          const isDisabled = disabledSet.has(key);
                          return (
                            <label
                              key={it.id}
                              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isDisabled ? "opacity-50" : "hover:bg-[#fafafa]"}`}
                            >
                              <input
                                type="checkbox"
                                checked={!isDisabled}
                                onChange={() => toggleItem(cat.id, sub.id, it.id)}
                                className="w-[14px] h-[14px] accent-[#80020E] flex-shrink-0"
                              />
                              <span className={`text-[13px] ${isDisabled ? "text-[#888] line-through" : "text-[#333]"}`}>
                                {it.label}
                              </span>
                            </label>
                          );
                        })}

                        {/* Custom items (always on; can be removed) */}
                        {customItems.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-[#FBF6F6]"
                          >
                            <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-sm bg-[#80020E] flex-shrink-0">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            <span className="text-[13px] text-[#333]">{it.label}</span>
                            <span className="text-[10px] font-semibold text-[#80020E] bg-[#80020E]/10 px-1.5 py-0.5 rounded">Custom</span>
                            <button
                              type="button"
                              onClick={() => removeCustomItem(cat.id, sub.id, it.id)}
                              className="ml-auto text-[#999] hover:text-[#B7484F] transition-colors"
                              aria-label={`Remove ${it.label}`}
                              title="Remove custom item"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}

                        {/* Add custom item */}
                        {adding === k ? (
                          <div className="flex items-center gap-2 px-2 mt-1">
                            <input
                              autoFocus
                              type="text"
                              value={newItemLabel}
                              onChange={(e) => setNewItemLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addCustomItem(cat.id, sub.id);
                                if (e.key === "Escape") { setAdding(null); setNewItemLabel(""); }
                              }}
                              placeholder="Custom photo check (e.g. Pool filter)"
                              className="flex-1 h-[32px] px-3 border border-[#e2e2e2] rounded-md text-[12px] outline-none focus:border-[#80020E] transition-colors bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => addCustomItem(cat.id, sub.id)}
                              disabled={!newItemLabel.trim()}
                              className="h-[32px] px-3 rounded-md bg-[#80020E] text-white text-[11px] font-semibold disabled:opacity-40"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAdding(null); setNewItemLabel(""); }}
                              className="h-[32px] px-3 text-[11px] text-[#666] hover:text-[#111] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setAdding(k); setNewItemLabel(""); }}
                            className="text-[11px] font-medium text-[#80020E] hover:underline px-2 mt-1"
                          >
                            + Add custom item to {sub.label.toLowerCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[11px] text-[#999] text-center px-4 py-2">
        Changes apply to all future turnovers for this property. Photos already taken stay associated with their items
        even if you disable them — re-enable to surface them again.
      </div>
    </div>
  );
}

/**
 * Stable string serialisation for dirty-tracking — JSON.stringify's key order
 * for objects is insertion-defined, but our overrides only have two top-level
 * keys (`disabled`, `added`), so a plain stringify is good enough as long as
 * we sort the disabled list. We don't sort `added` because order matters: a
 * later edit to a custom item's label shouldn't break dirty-tracking.
 */
function stableStringify(o: ChecklistOverrides): string {
  return JSON.stringify({
    disabled: [...(o.disabled || [])].sort(),
    added: o.added || [],
  });
}
