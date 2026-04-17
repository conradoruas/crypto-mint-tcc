import { useSyncExternalStore } from "react";

// Module-scoped registry: one real interval per intervalMs value, shared
// across all component instances. Components subscribe via useSyncExternalStore,
// so only those subscribed re-render on each tick.

type Listener = () => void;

interface ClockEntry {
  now: number;
  listeners: Set<Listener>;
  intervalId: ReturnType<typeof setInterval>;
}

const registry = new Map<number, ClockEntry>();

function getOrCreate(intervalMs: number): ClockEntry {
  const existing = registry.get(intervalMs);
  if (existing) return existing;

  const entry: ClockEntry = {
    now: Date.now(),
    listeners: new Set(),
    intervalId: setInterval(() => {
      entry.now = Date.now();
      for (const l of entry.listeners) l();
    }, intervalMs),
  };
  registry.set(intervalMs, entry);
  return entry;
}

function subscribe(intervalMs: number, listener: Listener): () => void {
  const entry = getOrCreate(intervalMs);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      clearInterval(entry.intervalId);
      registry.delete(intervalMs);
    }
  };
}

function getSnapshot(intervalMs: number): number {
  return registry.get(intervalMs)?.now ?? Date.now();
}

export function useClock(intervalMs: number): number {
  return useSyncExternalStore(
    (listener) => subscribe(intervalMs, listener),
    () => getSnapshot(intervalMs),
    () => getSnapshot(intervalMs),
  );
}
