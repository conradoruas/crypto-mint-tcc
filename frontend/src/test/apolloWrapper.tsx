import React from "react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type MockedResponse = MockLink.MockedResponse;

export function makeApolloWrapper(mocks: MockedResponse[]) {
  return function ApolloWrapper({ children }: { children: React.ReactNode }) {
    const link = new MockLink(mocks, { showWarnings: true });
    const apolloClient = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache" },
        query: { fetchPolicy: "no-cache" },
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={queryClient}>
        <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
      </QueryClientProvider>
    );
  };
}
