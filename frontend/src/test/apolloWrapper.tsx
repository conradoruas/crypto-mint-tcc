import React from "react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";

type MockedResponse = MockLink.MockedResponse;

/**
 * Returns a React wrapper component that provides an Apollo client backed by
 * the given mocked responses — replacement for the removed MockedProvider.
 */
export function makeApolloWrapper(mocks: MockedResponse[]) {
  return function ApolloWrapper({ children }: { children: React.ReactNode }) {
    const link = new MockLink(mocks, {
      showWarnings: true,
    });
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache" },
        query: { fetchPolicy: "no-cache" },
      },
    });
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}
