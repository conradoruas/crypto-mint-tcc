import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type MockLink } from "@apollo/client/testing";
import { GET_COLLECTION_TRAIT_SCHEMA } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import { useCollectionTraitSchema } from "./useCollectionTraitSchema";

type MockedResponse = MockLink.MockedResponse;

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

describe("useCollectionTraitSchema", () => {
  it("reports pending indexing when contractURI exists but trait definitions are not indexed yet", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_COLLECTION_TRAIT_SCHEMA,
          variables: { id: "0x1000000000000000000000000000000000000001" },
        },
        result: {
          data: {
            collection: {
              __typename: "Collection",
              id: "0x1000000000000000000000000000000000000001",
              contractURI: "ipfs://cid",
              traitSchemaCID: "cid",
              traitDefinitions: [],
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useCollectionTraitSchema("0x1000000000000000000000000000000000000001"),
      { wrapper: makeWrapper(mocks) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.schema).toBeNull();
    expect(result.current.isSubgraphIndexed).toBe(false);
    expect(result.current.indexingState).toBe("pending");
    expect(result.current.traitSchemaCID).toBe("cid");
  });

  it("returns a usable schema only when trait definitions are indexed", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_COLLECTION_TRAIT_SCHEMA,
          variables: { id: "0x2000000000000000000000000000000000000002" },
        },
        result: {
          data: {
            collection: {
              __typename: "Collection",
              id: "0x2000000000000000000000000000000000000002",
              contractURI: "ipfs://cid",
              traitSchemaCID: "cid",
              traitDefinitions: [
                {
                  __typename: "TraitDefinition",
                  id: "def-1",
                  key: "class",
                  label: "Class",
                  type: "enum",
                  required: true,
                  minValue: null,
                  maxValue: null,
                  options: [
                    {
                      __typename: "TraitOption",
                      value: "Mage",
                      count: "2",
                      frequency: "0.5",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useCollectionTraitSchema("0x2000000000000000000000000000000000000002"),
      { wrapper: makeWrapper(mocks) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.indexingState).toBe("ready");
    expect(result.current.isSubgraphIndexed).toBe(true);
    expect(result.current.schema?.fields[0]).toMatchObject({
      key: "class",
      label: "Class",
      type: "enum",
    });
    expect(result.current.optionData.class?.[0]).toMatchObject({
      value: "Mage",
      count: 2,
      frequency: 0.5,
    });
  });
});
