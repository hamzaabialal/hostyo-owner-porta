/**
 * In-memory cache for Notion API responses.
 * Uses globalThis to survive Next.js dev-mode hot reloads.
 * Stale entries are ALWAYS served instantly — background refresh happens silently.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  refreshing: boolean;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Persist cache across Next.js dev hot reloads
const globalForCache = globalThis as unknown as { __notionCache?: Map<string, CacheEntry<unknown>> };
if (!globalForCache.__notionCache) {
  globalForCache.__notionCache = new Map();
}
const store = globalForCache.__notionCache;

export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  // Fresh cache hit — return immediately
  if (entry && now - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }

  // Stale cache exists — ALWAYS return stale data instantly
  if (entry) {
    // Kick off background refresh if not already running
    if (!entry.refreshing) {
      entry.refreshing = true;
      fetcher()
        .then((data) => {
          store.set(key, { data, timestamp: Date.now(), refreshing: false });
        })
        .catch(() => {
          entry.refreshing = false;
        });
    }
    return entry.data;
  }

  // No cache at all — must wait for first fetch
  const data = await fetcher();
  store.set(key, { data, timestamp: now, refreshing: false });
  return data;
}

/** Force-invalidate a cache key (e.g. after a POST/write) */
export function invalidate(key: string) {
  store.delete(key);
}
