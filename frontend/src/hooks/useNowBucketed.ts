"use client";

import { useState, useEffect } from "react";

const BUCKET_MS = 60_000; // 60 seconds

function bucket(): number {
  return Math.floor(Date.now() / BUCKET_MS) * 60;
}

/**
 * Returns a unix timestamp (seconds) bucketed to 60s intervals.
 * Automatically refreshes when the bucket changes so GraphQL queries
 * that filter by `now` don't serve stale expired-offer data.
 */
export function useNowBucketed(): number {
  const [now, setNow] = useState(bucket);

  useEffect(() => {
    const id = setInterval(() => {
      const next = bucket();
      setNow((prev) => (prev !== next ? next : prev));
    }, BUCKET_MS);
    return () => clearInterval(id);
  }, []);

  return now;
}
