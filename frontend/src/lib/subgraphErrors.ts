/**
 * Shared types and helpers for the subgraph proxy / rate-limit handling.
 *
 * The proxy and the Apollo client both need to agree on:
 *   - the response header used to communicate health (`x-subgraph-state`),
 *   - what counts as a rate-limit error,
 *   - the GraphQL error envelope returned when no cached fallback exists.
 */

export type SubgraphState = "ok" | "degraded" | "down";

export const SUBGRAPH_STATE_HEADER = "x-subgraph-state";

export const RATE_LIMIT_ERROR_CODE = "SUBGRAPH_RATE_LIMITED";

export function is429(status: number): boolean {
  return status === 429;
}

/**
 * Studio occasionally returns 200 with a GraphQL error body when the daily
 * quota is exceeded. Detect both shapes so the proxy can open the breaker
 * regardless of HTTP status.
 */
export function isRateLimitedBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => {
    if (!e || typeof e !== "object") return false;
    const code = (e as { extensions?: { code?: unknown } }).extensions?.code;
    if (typeof code === "string" && /rate.?limit/i.test(code)) return true;
    const msg = (e as { message?: unknown }).message;
    return typeof msg === "string" && /rate.?limit|too many requests/i.test(msg);
  });
}

/** GraphQL error envelope returned to clients when subgraph is down and no cache exists. */
export function rateLimitedEnvelope(): {
  errors: Array<{ message: string; extensions: { code: string } }>;
} {
  return {
    errors: [
      {
        message: "Subgraph is rate-limited and no cached response is available.",
        extensions: { code: RATE_LIMIT_ERROR_CODE },
      },
    ],
  };
}
