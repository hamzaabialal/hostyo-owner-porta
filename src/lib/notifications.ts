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
  type: "reservation" | "expense" | "payout" | "property" | "system" | "document";
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
    case "payout": return "dollar";
    case "property": return "home";
    case "document": return "file";
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
