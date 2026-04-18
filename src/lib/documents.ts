import { addNotification } from "@/lib/notifications";

// Property document management — backed by server API (Vercel Blob)
// Documents are shared across all users (admin uploads, owners can view)

const LAST_SEEN_KEY = "hostyo_docs_last_seen";

function getLastSeen(propertyId: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[propertyId] || "";
  } catch { return ""; }
}

function setLastSeen(propertyId: string, timestamp: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[propertyId] = timestamp;
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  propertyName?: string;
  name: string;
  url: string;
  size: string;
  type: "report" | "document";
  source: "System" | "Admin";
  createdAt: string;
  isNew?: boolean;
}

/**
 * Fetch documents for a property from the server.
 * Detects new documents since the last fetch and triggers a notification.
 * Falls back to localStorage for offline/migration support.
 */
export async function fetchDocuments(propertyId: string, propertyName?: string): Promise<PropertyDocument[]> {
  try {
    const params = new URLSearchParams({ propertyId });
    if (propertyName) params.set("propertyName", propertyName);
    const res = await fetch(`/api/documents?${params.toString()}`);
    const data = await res.json();
    if (data.ok && data.data) {
      // Check for new documents since last seen and notify
      detectNewDocuments(propertyId, propertyName || "", data.data);
      return data.data;
    }
  } catch { /* fallback below */ }

  return getDocumentsLocal(propertyId);
}

/**
 * Compares fetched documents to the last-seen timestamp and raises notifications
 * for any new "Admin" uploads. Updates the last-seen timestamp afterwards.
 */
function detectNewDocuments(propertyId: string, propertyName: string, docs: PropertyDocument[]) {
  if (typeof window === "undefined" || !propertyId) return;
  const lastSeen = getLastSeen(propertyId);
  // First-ever fetch — don't notify for all existing docs, just mark the latest as seen
  if (!lastSeen && docs.length > 0) {
    setLastSeen(propertyId, docs[0].createdAt);
    return;
  }
  if (!lastSeen) return;

  const newDocs = docs.filter((d) => d.source === "Admin" && d.createdAt > lastSeen);
  if (newDocs.length === 0) return;

  // Raise one notification per new document (up to 3 to avoid spam)
  for (const doc of newDocs.slice(0, 3)) {
    addNotification({
      type: "document",
      title: "New document uploaded",
      description: `${doc.name} was added to ${propertyName || "your property"}.`,
      href: `/properties/${propertyId}?tab=documents`,
    });
  }

  // Update last-seen to the newest doc's timestamp
  setLastSeen(propertyId, docs[0].createdAt);
}

/**
 * Add a document via the server API.
 * Falls back to localStorage if the API is unavailable.
 */
export async function addDocument(doc: Omit<PropertyDocument, "id" | "createdAt">): Promise<PropertyDocument | null> {
  try {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
    const data = await res.json();
    if (data.ok && data.document) return data.document;
  } catch { /* fallback below */ }

  // Fallback: store locally
  return addDocumentLocal(doc);
}

/**
 * Remove a document via the server API.
 */
export async function removeDocument(id: string): Promise<void> {
  try {
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch { /* ignore */ }

  // Also remove from localStorage if present
  removeDocumentLocal(id);
}

// ── Legacy localStorage functions (for migration + offline fallback) ──

const STORAGE_KEY = "hostyo_documents";

function getDocumentsLocal(propertyId: string): PropertyDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: PropertyDocument[] = raw ? JSON.parse(raw) : [];
    return all.filter((d) => d.propertyId === propertyId);
  } catch { return []; }
}

// Keep the synchronous version for backward compatibility with existing code
export function getDocuments(propertyId: string): PropertyDocument[] {
  return getDocumentsLocal(propertyId);
}

function addDocumentLocal(doc: Omit<PropertyDocument, "id" | "createdAt">): PropertyDocument {
  if (typeof window === "undefined") return { ...doc, id: "", createdAt: "" };
  const all = getAllLocal();
  const newDoc: PropertyDocument = {
    ...doc,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };
  all.unshift(newDoc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return newDoc;
}

function removeDocumentLocal(id: string) {
  if (typeof window === "undefined") return;
  const all = getAllLocal().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function getAllLocal(): PropertyDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
