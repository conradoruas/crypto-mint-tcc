"use client";

import { useSyncExternalStore } from "react";

const BUCKET_MS = 60_000;

function bucket(now: number): number {
  return Math.floor(now / BUCKET_MS) * 60;
}

function syncCurrentBucket(): number {
  const next = bucket(Date.now());
  if (next !== currentBucket) {
    currentBucket = next;
  }
  return currentBucket;
}

// Module-level singleton — shared across every component that calls
// useNowBucketed(), so only one interval fires regardless of usage count.
let currentBucket = bucket(Date.now());
const listeners = new Set<() => void>();

const intervalId = setInterval(() => {
  const previous = currentBucket;
  const next = syncCurrentBucket();
  if (next !== previous) {
    for (const l of listeners) l();
  }
}, BUCKET_MS);

// Prevent the interval from blocking Node.js exit in test environments.
if (typeof intervalId === "object" && intervalId !== null && "unref" in intervalId) {
  (intervalId as { unref(): void }).unref();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns a unix timestamp (seconds) bucketed to 60s intervals.
 * Shares a single module-level interval across all consumers.
 */
export function useNowBucketed(): number {
  return useSyncExternalStore(
    subscribe,
    syncCurrentBucket,
    syncCurrentBucket,
  );
}
