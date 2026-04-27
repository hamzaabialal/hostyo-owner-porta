// Per-user client-side notification/activity log store.
//
// Notifications are scoped to a "owner" — the email of the currently effective
// user (impersonated user when an admin is impersonating, otherwise the real
// signed-in user). This means an owner only ever sees notifications about
// properties / payouts / expenses they have access to, and switching users on
// the same browser does not leak the previous user's notifications.
//
// Storage layout:
//   localStorage[`hostyo_notifications:${ownerEmail}`] = AppNotification[]
// Plus a single legacy key (`hostyo_notifications`) which is migrated/cleared
// the first time we know the owner.

export interface AppNotification {
  id: string;
  type: "reservation" | "expense" | "payout" | "property" | "system" | "document" | "message";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  href?: string;
  /** Email (lowercased) of the user this notification belongs to. */
  owner: string;
  /**
   * Stable identity of the underlying event. When set, addNotification will
   * skip the entry if the same fingerprint already exists for the owner.
   * Lets us re-seed from the API on every load without spawning duplicates.
   */
  fingerprint?: string;
}

/** Result of a diffAndMarkSeen call. */
export interface SeenDiff {
  /** True if this is the first time we're tracking this category for the
   *  current owner. Callers should NOT raise notifications on a first run —
   *  the user has just signed in and we don't want to dump every existing
   *  reservation / payout / expense into their feed. */
  firstRun: boolean;
  /** IDs that are present today but were not in the seen set. Empty on first run. */
  newIds: string[];
}

const LEGACY_STORAGE_KEY = "hostyo_notifications";
const STORAGE_PREFIX = "hostyo_notifications:";
const ANON_OWNER = "_anon";
const MAX_NOTIFICATIONS = 80;

let currentOwner: string = ANON_OWNER;

function normaliseOwner(email: string | null | undefined): string {
  const v = (email || "").trim().toLowerCase();
  return v || ANON_OWNER;
}

function storageKey(owner = currentOwner): string {
  return `${STORAGE_PREFIX}${owner}`;
}

function dispatchUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hostyo:notification"));
}

/**
 * Set the user that subsequent reads/writes apply to. Should be called as
 * early as possible after the effective session is known (handled in AppShell).
 *
 * Returns true when the owner actually changed, so callers can react (e.g. by
 * re-seeding notifications from the API).
 */
export function setNotificationOwner(email: string | null | undefined): boolean {
  const next = normaliseOwner(email);
  if (next === currentOwner) return false;
  currentOwner = next;
  // One-time cleanup: drop the unowned legacy bucket. We can't safely attribute
  // those entries to any user, and keeping them around would leak whichever
  // user happened to seed them first.
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
  }
  dispatchUpdate();
  return true;
}

export function getNotificationOwner(): string {
  return currentOwner;
}

function getIcon(type: AppNotification["type"]): string {
  switch (type) {
    case "reservation": return "calendar";
    case "expense": return "receipt";
    case "payout": return "check";
    case "property": return "home";
    case "document": return "file";
    case "message": return "message";
    case "system": return "info";
    default: return "info";
  }
}

export { getIcon };

export function getNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const list = JSON.parse(raw) as AppNotification[];
    // Defensive filter: even if older entries lack `owner`, only return ones
    // matching the current owner (or with no owner — which only happens for
    // pre-migration entries we keep showing in their original bucket).
    return Array.isArray(list)
      ? list.filter((n) => !n.owner || n.owner === currentOwner)
      : [];
  } catch {
    return [];
  }
}

function persist(notifications: AppNotification[]) {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
    );
  } catch { /* quota or disabled — ignore */ }
}

export function addNotification(
  n: Omit<AppNotification, "id" | "timestamp" | "read" | "owner"> & { fingerprint?: string }
): AppNotification | null {
  if (typeof window === "undefined") return null;
  // Anonymous bucket should never accumulate — ignore writes before we know
  // who the user is. The owner is set during AppShell mount, so the only way
  // to land here is server-rendered code paths or a race; either way dropping
  // the write is safer than mis-attributing it.
  if (currentOwner === ANON_OWNER) return null;

  const notifications = getNotifications();
  if (n.fingerprint && notifications.some((x) => x.fingerprint === n.fingerprint)) {
    return null;
  }
  const newNotif: AppNotification = {
    ...n,
    owner: currentOwner,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(newNotif);
  persist(notifications);
  dispatchUpdate();
  return newNotif;
}

export function markAllRead() {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().map((n) => ({ ...n, read: true }));
  persist(notifications);
  dispatchUpdate();
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function markAsRead(id: string) {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  persist(notifications);
  dispatchUpdate();
}

export function dismissNotification(id: string) {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().filter((n) => n.id !== id);
  persist(notifications);
  dispatchUpdate();
}

export function clearAllNotifications() {
  if (typeof window === "undefined") return;
  persist([]);
  dispatchUpdate();
}

/**
 * One-time migration of stored notifications: rename or drop entries from
 * older app versions so the feed stays in sync with the current set of
 * notification types. Idempotent — safe to call on every page load.
 */
export function pruneObsoleteNotifications() {
  if (typeof window === "undefined" || currentOwner === ANON_OWNER) return;
  const notifications = getNotifications();

  // Rename in place so users keep their payout history under the new label.
  const titleMigrations: Record<string, string> = {
    "Payout completed": "Payout Sent",
  };
  // Drop entirely — these notification types are no longer produced.
  const obsoleteTitles = new Set<string>([
    "Payout pending",
    "Check-in today",
    "Check-out today",
    "Upcoming reservation",
    "Reservation completed",
    "New document uploaded",
  ]);

  let changed = false;
  const next: AppNotification[] = [];
  for (const n of notifications) {
    if (obsoleteTitles.has(n.title)) { changed = true; continue; }
    const renamed = titleMigrations[n.title];
    if (renamed) { next.push({ ...n, title: renamed }); changed = true; continue; }
    next.push(n);
  }
  if (!changed) return;
  persist(next);
  dispatchUpdate();
}

/**
 * Tracks which IDs we've already processed for a given category (e.g.
 * "reservations_new", "tickets_admin_replies") so we can emit notifications
 * only for genuinely new events without flooding the feed on first sign-in.
 *
 * Behaviour:
 *   - First call ever for a (owner, category) pair returns
 *     `{ firstRun: true, newIds: [] }` and silently records the current IDs.
 *   - Subsequent calls return the IDs not present in the previous seen set,
 *     and update the seen set to the union of past + present.
 *
 * Callers should suppress notifications when `firstRun` is true.
 */
export function diffAndMarkSeen(category: string, currentIds: string[]): SeenDiff {
  if (typeof window === "undefined" || currentOwner === ANON_OWNER) {
    return { firstRun: true, newIds: [] };
  }
  const key = `hostyo_notif_seen:${category}:${currentOwner}`;
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* ignore */ }

  // raw === null means we have never tracked this category for this user;
  // raw === "[]" means we tracked it but the set is currently empty.
  const firstRun = raw === null;
  const seenIds = new Set<string>(raw ? safeParseArray(raw) : []);
  const newIds = firstRun ? [] : currentIds.filter((id) => !seenIds.has(id));

  for (const id of currentIds) seenIds.add(id);
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(seenIds)));
  } catch { /* quota — ignore */ }

  return { firstRun, newIds };
}

function safeParseArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch { return []; }
}
