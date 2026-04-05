/**
 * Centralised polling intervals (ms) for GraphQL and data-refresh hooks.
 *
 * Having every cadence in one file makes it trivial to tune them later
 * (e.g. bump all intervals during a testnet congestion event) and avoids
 * magic numbers scattered across hooks.
 */

/** Activity feed events — near-real-time feel. */
export const POLL_ACTIVITY_MS = 30_000;

/** Global marketplace stats (collections, volume, etc.). */
export const POLL_STATS_MS = 60_000;

/** Trending collections aggregate — heavier query, less urgent. */
export const POLL_TRENDING_MS = 5 * 60_000;

/**
 * Maximum number of on-chain `getOffer` reads batched in a single multicall
 * when reconciling offers for an NFT.  Keeps RPC payload size bounded even
 * if a popular NFT accumulates hundreds of historical buyers.
 */
export const MAX_OFFER_BUYERS_MULTICALL = 100;
