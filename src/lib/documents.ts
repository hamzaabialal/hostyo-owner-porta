// Client-side document storage for property files
export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  url: string;
  size: string;
  type: "report" | "document";
  source: "System" | "Admin";
  createdAt: string;
  isNew?: boolean;
}

const STORAGE_KEY = "hostyo_documents";

export function getDocuments(propertyId: string): PropertyDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: PropertyDocument[] = raw ? JSON.parse(raw) : [];
    return all.filter((d) => d.propertyId === propertyId);
  } catch {
    return [];
  }
}

export function addDocument(doc: Omit<PropertyDocument, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  const all = getAllDocuments();
  const newDoc: PropertyDocument = {
    ...doc,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };
  all.unshift(newDoc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return newDoc;
}

export function removeDocument(id: string) {
  if (typeof window === "undefined") return;
  const all = getAllDocuments().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function getAllDocuments(): PropertyDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
