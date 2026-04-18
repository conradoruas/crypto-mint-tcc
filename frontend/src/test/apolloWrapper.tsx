import type { MockLink } from "@apollo/client/testing";
import { wrapperWithProviders } from "./renderWithProviders";

/** Backward-compat shim. Prefer wrapperWithProviders({ apolloMocks }) for new tests. */
export function makeApolloWrapper(mocks: MockLink.MockedResponse[]) {
  return wrapperWithProviders({ apolloMocks: mocks });
}
