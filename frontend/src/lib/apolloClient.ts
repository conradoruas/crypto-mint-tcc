import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "";

const retryLink = new RetryLink({
  delay: { initial: 300, max: 2000, jitter: true },
  attempts: { max: 3 },
});

const httpLink = new HttpLink({ uri: SUBGRAPH_URL });

export const apolloClient = new ApolloClient({
  link: from([retryLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          collections: { merge: false },
          activityEvents: { merge: false },
          nfts: { merge: false },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});
