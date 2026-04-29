import { ApolloClient, ApolloLink, InMemoryCache, HttpLink } from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";
import { tap } from "rxjs";
import { SUBGRAPH_STATE_HEADER, type SubgraphState } from "./subgraphErrors";
import { setSubgraphState } from "./subgraphState";

// All GraphQL traffic flows through the local Next.js route, which provides
// in-memory caching, dedup across users on the same instance, and a 429
// circuit breaker that serves stale data instead of failing.
const PROXY_URI = "/api/subgraph";

function buildCacheConfig() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          collections: { merge: false },
          activityEvents: { merge: false },
          nfts: { merge: false },
          offers: { merge: false },
        },
      },
    },
  });
}

function isSubgraphState(value: string | null): value is SubgraphState {
  return value === "ok" || value === "degraded" || value === "down";
}

/**
 * Reads the `x-subgraph-state` header from the proxy response (set by
 * /api/subgraph) and updates the vanilla state store. UI hooks subscribe
 * to that store to render degraded/down banners and to switch hybrid
 * hooks over to RPC when the subgraph is fully unavailable.
 *
 * Exported as a factory so tests can build the link in isolation.
 */
export function createSubgraphStateLink(
  onState: (s: SubgraphState) => void = setSubgraphState,
): ApolloLink {
  return new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      tap({
        next: () => {
          const response = operation.getContext().response as
            | { headers?: Headers }
            | undefined;
          const header = response?.headers?.get?.(SUBGRAPH_STATE_HEADER) ?? null;
          if (isSubgraphState(header)) onState(header);
        },
      }),
    ),
  );
}

/**
 * Retry transient failures only. The proxy already absorbs 429 (it serves
 * stale data on its side), so retries from the client would just hit the
 * still-open circuit breaker — wasted round trips. We also skip 4xx errors
 * because they are deterministic.
 */
function buildRetryLink(): RetryLink {
  return new RetryLink({
    delay: { initial: 300, max: 2000, jitter: true },
    attempts: {
      max: 3,
      retryIf: (error) => {
        const status =
          (error as { statusCode?: number; status?: number } | undefined)
            ?.statusCode ??
          (error as { statusCode?: number; status?: number } | undefined)
            ?.status;
        if (typeof status === "number") {
          if (status === 429) return false;
          if (status >= 400 && status < 500) return false;
        }
        return !!error;
      },
    },
  });
}

function buildLinks() {
  return ApolloLink.from([
    createSubgraphStateLink(),
    buildRetryLink(),
    new HttpLink({ uri: PROXY_URI }),
  ]);
}

// Browser: reuse a single instance across the lifetime of the page.
// Server (RSC / SSR): create a new instance per request to prevent cache
// leaking between concurrent requests.
let _browserClient: ApolloClient | null = null;

export function makeApolloClient(): ApolloClient {
  return new ApolloClient({
    link: buildLinks(),
    cache: buildCacheConfig(),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}

export function getApolloClient(): ApolloClient {
  if (typeof window === "undefined") {
    // Server-side: always create a fresh client so requests don't share cache.
    return makeApolloClient();
  }
  // Client-side: return (or create) the singleton.
  if (!_browserClient) _browserClient = makeApolloClient();
  return _browserClient;
}

// Named export kept for backwards-compatibility with existing imports.
export const apolloClient = getApolloClient();
