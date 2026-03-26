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
    const link = new MockLink(mocks, true);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}
