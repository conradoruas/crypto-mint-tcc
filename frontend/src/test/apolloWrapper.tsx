import React from "react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import type { MockedResponse } from "@apollo/client/testing";

/**
 * Returns a React wrapper component that provides an Apollo client backed by
 * the given mocked responses — replacement for the removed MockedProvider.
 */
export function makeApolloWrapper(mocks: MockedResponse[]) {
  return function ApolloWrapper({ children }: { children: React.ReactNode }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = new MockLink(mocks, true as any);
    const client = new ApolloClient({
      link,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cache: new InMemoryCache({ addTypename: false } as any),
    });
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}
