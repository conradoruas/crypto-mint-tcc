/**
 * Server-side subgraph proxy with in-memory cache and 429 circuit breaker.
 *
 * Why this exists:
 *   The Graph Studio endpoint enforces a ~3,000 queries/day budget shared
 *   across all visitors. Without dedup and caching, a single open homepage
 *   tab exhausts the budget within hours. This module sits between the
 *   Next.js route handler and Studio, deduping identical queries via an
 *   in-memory LRU and serving last-known-good data when Studio rate-limits.
 *
 * Design:
 *   - Pure logic, no Next.js imports — directly unit-testable.
 *   - Factory `createSubgraphProxy()` returns its own state, so tests can
 *     spin up isolated instances. Production uses `getDefaultProxy()`.
 *   - Cache key is the normalized triple (operationName, query, variables).
 *   - Per-operation TTLs in OPERATION_TTL_MS; unknown ops fall back to default.
 *   - Circuit breaker: closed → open (on 429) → half-open (after expiry).
 *     While open, the proxy serves stale cache up to STALE_GRACE_MULT * ttl
 *     and skips Studio entirely. Half-open allows one trial; success closes,
 *     failure re-opens.
 */

import {
  is429,
  isRateLimitedBody,
  rateLimitedEnvelope,
  type SubgraphState,
} from "./subgraphErrors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphQLRequest {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
}

export type Verdict =
  | { kind: "fresh"; status: 200; body: unknown; subgraphState: SubgraphState }
  | {
      kind: "stale";
      status: 200;
      body: unknown;
      subgraphState: SubgraphState;
      reason: "rate_limited" | "network" | "http_error";
    }
  | { kind: "error"; status: number; body: unknown; subgraphState: SubgraphState };

interface CacheEntry {
  body: unknown;
  storedAt: number;
  ttlMs: number;
}

type BreakerState =
  | { kind: "closed" }
  | { kind: "open"; until: number }
  | { kind: "half-open" };

export interface SubgraphProxyOptions {
  upstreamUrl: string;
  fetcher?: typeof fetch;
  now?: () => number;
  cacheCapacity?: number;
  breakerOpenMs?: number;
}

// ─── Tunables ─────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 60_000;
const STALE_GRACE_MULT = 6;
const DEFAULT_CACHE_CAP = 256;
const DEFAULT_BREAKER_OPEN_MS = 5 * 60_000;

const OPERATION_TTL_MS: Readonly<Record<string, number>> = {
  GET_MARKETPLACE_STATS: 5 * 60_000,
  GET_COLLECTION_STATS_RANKED: 10 * 60_000,
  GET_TOP_OFFERS_BY_COLLECTION: 10 * 60_000,
  GET_ACTIVITY_FEED_ALL: 60_000,
  GET_ACTIVITY_FEED: 60_000,
  GET_COLLECTIONS: 5 * 60_000,
  GET_COLLECTIONS_BY_CREATOR: 5 * 60_000,
  GET_COLLECTION: 10 * 60_000,
  GET_COLLECTION_TRAIT_SCHEMA: 60 * 60_000,
  GET_NFTS_FOR_CONTRACT: 90_000,
  GET_ALL_NFTS: 90_000,
  GET_NFTS_FOR_OWNER: 30_000,
  GET_NFTS_FOR_OWNER_IN_COLLECTION: 30_000,
  GET_LISTING: 15_000,
  GET_OFFERS_FOR_NFT: 15_000,
  GET_MY_OFFER: 15_000,
  GET_NFT_ATTRIBUTES: 60 * 60_000,
  GET_SEARCH_SUGGESTIONS: 5 * 60_000,
};

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Look up the TTL for an operation, falling back to the default. */
export function operationTtl(operationName?: string): number {
  if (!operationName) return DEFAULT_TTL_MS;
  return OPERATION_TTL_MS[operationName] ?? DEFAULT_TTL_MS;
}

/** Deterministic stringify with sorted object keys (for stable cache keys). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${stableStringify(
        (value as Record<string, unknown>)[k],
      )}`,
  );
  return `{${entries.join(",")}}`;
}

/** Build the cache key. Same query with reordered variables hashes identically. */
export function buildCacheKey(req: GraphQLRequest): string {
  const op = req.operationName ?? "";
  const query = req.query.replace(/\s+/g, " ").trim();
  const vars = req.variables ? stableStringify(req.variables) : "{}";
  return `${op}|${query}|${vars}`;
}

/** A subgraph response is cacheable only if it's a clean success (no `errors`). */
function isCacheable(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  if (Array.isArray(body)) return false;
  const errors = (body as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) return false;
  return "data" in (body as object);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSubgraphProxy(opts: SubgraphProxyOptions) {
  const fetcher = opts.fetcher ?? fetch;
  const now = opts.now ?? (() => Date.now());
  const cacheCap = opts.cacheCapacity ?? DEFAULT_CACHE_CAP;
  const breakerOpenMs = opts.breakerOpenMs ?? DEFAULT_BREAKER_OPEN_MS;

  const cache = new Map<string, CacheEntry>();
  let breaker: BreakerState = { kind: "closed" };

  function readCache(key: string): CacheEntry | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    // LRU bump: re-insert so it becomes the newest.
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  function writeCache(key: string, body: unknown, ttlMs: number): void {
    cache.set(key, { body, storedAt: now(), ttlMs });
    while (cache.size > cacheCap) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }

  function isFresh(entry: CacheEntry): boolean {
    return now() - entry.storedAt < entry.ttlMs;
  }

  function isWithinStaleGrace(entry: CacheEntry): boolean {
    return now() - entry.storedAt < entry.ttlMs * STALE_GRACE_MULT;
  }

  function evaluateBreaker(): "closed" | "open" | "half-open" {
    if (breaker.kind === "open") {
      if (now() >= breaker.until) {
        breaker = { kind: "half-open" };
        return "half-open";
      }
      return "open";
    }
    return breaker.kind;
  }

  function tripBreaker(): void {
    breaker = { kind: "open", until: now() + breakerOpenMs };
  }

  function closeBreaker(): void {
    breaker = { kind: "closed" };
  }

  function staleVerdict(
    entry: CacheEntry,
    state: SubgraphState,
    reason: "rate_limited" | "network" | "http_error",
  ): Verdict {
    return {
      kind: "stale",
      status: 200,
      body: entry.body,
      subgraphState: state,
      reason,
    };
  }

  async function callUpstream(req: GraphQLRequest): Promise<{
    status: number;
    body: unknown;
    networkError: boolean;
  }> {
    try {
      const res = await fetcher(opts.upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body, networkError: false };
    } catch {
      return { status: 0, body: null, networkError: true };
    }
  }

  async function getCachedOrFetch(req: GraphQLRequest): Promise<Verdict> {
    const key = buildCacheKey(req);
    const ttlMs = operationTtl(req.operationName);
    const breakerState = evaluateBreaker();

    // Cache hit (fresh) — serve immediately, no upstream call.
    const cached = readCache(key);
    if (cached && isFresh(cached)) {
      return {
        kind: "fresh",
        status: 200,
        body: cached.body,
        subgraphState: breakerState === "closed" ? "ok" : "degraded",
      };
    }

    // Breaker open — never call upstream. Serve stale if within grace, else error.
    if (breakerState === "open") {
      if (cached && isWithinStaleGrace(cached)) {
        return staleVerdict(cached, "degraded", "rate_limited");
      }
      return {
        kind: "error",
        status: 429,
        body: rateLimitedEnvelope(),
        subgraphState: "down",
      };
    }

    // Closed or half-open: try upstream.
    const { status, body, networkError } = await callUpstream(req);

    // 429 (or 200-with-rate-limit-error) → trip breaker, serve stale if possible.
    if (is429(status) || isRateLimitedBody(body)) {
      tripBreaker();
      if (cached && isWithinStaleGrace(cached)) {
        return staleVerdict(cached, "degraded", "rate_limited");
      }
      return {
        kind: "error",
        status: 429,
        body: rateLimitedEnvelope(),
        subgraphState: "down",
      };
    }

    // Network failure → don't trip breaker (transient), but serve stale if possible.
    if (networkError) {
      if (cached && isWithinStaleGrace(cached)) {
        return staleVerdict(cached, "degraded", "network");
      }
      return {
        kind: "error",
        status: 502,
        body: { errors: [{ message: "Subgraph upstream unreachable." }] },
        subgraphState: "down",
      };
    }

    // Non-2xx that isn't 429 → treat like network error.
    if (status < 200 || status >= 300) {
      if (cached && isWithinStaleGrace(cached)) {
        return staleVerdict(cached, "degraded", "http_error");
      }
      return {
        kind: "error",
        status,
        body: body ?? { errors: [{ message: "Subgraph upstream error." }] },
        subgraphState: "down",
      };
    }

    // 2xx: half-open trial succeeded → close breaker.
    if (breakerState === "half-open") closeBreaker();

    // Cacheable response → store and return fresh.
    if (isCacheable(body)) {
      writeCache(key, body, ttlMs);
      return { kind: "fresh", status: 200, body, subgraphState: "ok" };
    }

    // 2xx with GraphQL errors — pass through but don't cache.
    return { kind: "fresh", status: 200, body, subgraphState: "ok" };
  }

  function __reset(): void {
    cache.clear();
    breaker = { kind: "closed" };
  }

  function __stats(): { cacheSize: number; breaker: string } {
    return { cacheSize: cache.size, breaker: breaker.kind };
  }

  return { getCachedOrFetch, __reset, __stats };
}

// ─── Default singleton for the route handler ──────────────────────────────────

export type SubgraphProxy = ReturnType<typeof createSubgraphProxy>;

let _default: SubgraphProxy | null = null;

export function getDefaultProxy(): SubgraphProxy {
  if (_default) return _default;
  // SUBGRAPH_URL is server-only. NEXT_PUBLIC_SUBGRAPH_URL is accepted as a
  // backward-compat fallback while .env files migrate; new deployments should
  // set SUBGRAPH_URL (no NEXT_PUBLIC_) so the URL never leaks into the bundle.
  const url = process.env.SUBGRAPH_URL ?? process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) {
    throw new Error(
      "[subgraphProxy] SUBGRAPH_URL is not configured. Set it as a server-only env var.",
    );
  }
  _default = createSubgraphProxy({ upstreamUrl: url });
  return _default;
}
