import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "";

function buildCacheConfig() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          collections: { merge: false },
          activityEvents: { merge: false },
          nfts: { merge: false },
        },
      },
    },
  });
}

function buildLinks() {
  const retryLink = new RetryLink({
    delay: { initial: 300, max: 2000, jitter: true },
    attempts: { max: 3 },
  });
  const httpLink = new HttpLink({ uri: SUBGRAPH_URL });
  return from([retryLink, httpLink]);
}

// Browser: reuse a single instance across the lifetime of the page.
// Server (RSC / SSR): create a new instance per request to prevent cache
// leaking between concurrent requests.
let _browserClient: ApolloClient<object> | null = null;

export function makeApolloClient(): ApolloClient<object> {
  return new ApolloClient({
    link: buildLinks(),
    cache: buildCacheConfig(),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}

export function getApolloClient(): ApolloClient<object> {
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
