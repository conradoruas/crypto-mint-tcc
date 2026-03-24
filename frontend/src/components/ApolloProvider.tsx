"use client";

import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import { apolloClient } from "@/lib/apolloClient";

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseApolloProvider client={apolloClient}>{children}</BaseApolloProvider>
  );
}
