"use client";
import { createContext, useContext, useRef, useCallback, ReactNode, useState } from "react";

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

interface DataContextType {
  fetchData: (key: string, url: string) => Promise<unknown>;
  invalidate: (key: string) => void;
}

const Ctx = createContext<DataContextType | null>(null);

const CLIENT_TTL = 2 * 60 * 1000; // 2 minutes

export function DataProvider({ children }: { children: ReactNode }) {
  // Use ref so cache is always up-to-date (no stale closures)
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const inflight = useRef<Map<string, Promise<unknown>>>(new Map());
  // Force re-render when data arrives (for components that need it)
  const [, setTick] = useState(0);

  const fetchData = useCallback(async (key: string, url: string): Promise<unknown> => {
    // Return cached if fresh
    const entry = cache.current.get(key);
    if (entry && Date.now() - entry.timestamp < CLIENT_TTL) {
      return entry.data;
    }

    // Dedupe in-flight requests
    const existing = inflight.current.get(key);
    if (existing) return existing;

    const promise = fetch(url)
      .then((r) => r.json())
      .then((data) => {
        cache.current.set(key, { data, timestamp: Date.now() });
        inflight.current.delete(key);
        setTick((t) => t + 1);
        return data;
      })
      .catch((err) => {
        inflight.current.delete(key);
        throw err;
      });

    inflight.current.set(key, promise);
    return promise;
  }, []);

  const invalidate = useCallback((key: string) => {
    cache.current.delete(key);
  }, []);

  return (
    <Ctx.Provider value={{ fetchData, invalidate }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
