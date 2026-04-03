// Simple client-side notification/activity log store
export interface AppNotification {
  id: string;
  type: "reservation" | "expense" | "payout" | "property" | "system";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = "hostyo_notifications";
const MAX_NOTIFICATIONS = 50;

function getIcon(type: AppNotification["type"]): string {
  switch (type) {
    case "reservation": return "calendar";
    case "expense": return "receipt";
    case "payout": return "dollar";
    case "property": return "home";
    case "system": return "info";
  }
}

export { getIcon };

export function getNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addNotification(n: Omit<AppNotification, "id" | "timestamp" | "read">) {
  if (typeof window === "undefined") return;
  const notifications = getNotifications();
  const newNotif: AppNotification = {
    ...n,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(newNotif);
  // Keep only the latest
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  // Dispatch event so TopBar can update
  window.dispatchEvent(new CustomEvent("hostyo:notification"));
}

export function markAllRead() {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent("hostyo:notification"));
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function dismissNotification(id: string) {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent("hostyo:notification"));
}

export function clearAllNotifications() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new CustomEvent("hostyo:notification"));
}
