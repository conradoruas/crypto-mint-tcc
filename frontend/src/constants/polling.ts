/**
 * Centralised polling intervals (ms) for GraphQL and data-refresh hooks.
 *
 * All values here are *upper bounds*: every GraphQL hit goes through the
 * /api/subgraph proxy, which has its own per-operation TTL cache and a 429
 * circuit breaker. Polling at this cadence is therefore cheap — duplicate
 * requests within a TTL window are served from the proxy's in-memory cache
 * without touching The Graph Studio. We additionally trigger a refetch on
 * window focus (via useRefetchOnWindowFocus), so the perceived freshness
 * after a tab switch is decoupled from these intervals.
 *
 * If you change a value here, also review the corresponding TTL in
 * lib/subgraphProxy.ts (OPERATION_TTL_MS) — they should be in the same
 * order of magnitude or the proxy cache becomes ineffective.
 */

/** Activity feed events. Was 30s; raised to keep us under Studio's daily quota. */
export const POLL_ACTIVITY_MS = 120_000;

/** Global marketplace stats — slow-moving, tolerates staleness. */
export const POLL_STATS_MS = 5 * 60_000;

/** Trending collections aggregate — heaviest query, least urgent. */
export const POLL_TRENDING_MS = 15 * 60_000;

/**
 * Maximum number of on-chain `getOffer` reads batched in a single multicall
 * when reconciling offers for an NFT. Keeps RPC payload size bounded even
 * if a popular NFT accumulates hundreds of historical buyers.
 */
export const MAX_OFFER_BUYERS_MULTICALL = 100;

/**
 * Default throttle for window-focus refetches. Prevents a flurry of refetches
 * if a user rapidly Alt-Tabs in and out of the marketplace tab.
 */
export const FOCUS_REFETCH_THROTTLE_MS = 30_000;
