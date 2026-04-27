import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
              totalSupply: "3",
              contractURI: "ipfs://cid",
              traitSchemaCID: "cid",
              traitDefinitions: [],
            },
            attributes: [],
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

  it("falls back to contractURI schema for display while indexing is still pending", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_COLLECTION_TRAIT_SCHEMA,
          variables: { id: "0x3000000000000000000000000000000000000003" },
        },
        result: {
          data: {
            collection: {
              __typename: "Collection",
              id: "0x3000000000000000000000000000000000000003",
              totalSupply: "2",
              contractURI: "ipfs://fallback-cid",
              traitSchemaCID: "fallback-cid",
              traitDefinitions: [],
            },
            attributes: [],
          },
        },
      },
    ];

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        body: undefined,
        json: async () => ({
          trait_schema: {
            version: 1,
            fields: [
              {
                key: "class",
                label: "Class",
                type: "enum",
                required: true,
                options: ["Mage", "Warrior"],
              },
            ],
          },
        }),
      } as unknown as Response);

    const { result } = renderHook(
      () => useCollectionTraitSchema("0x3000000000000000000000000000000000000003"),
      { wrapper: makeWrapper(mocks) },
    );

    await waitFor(() => expect(result.current.schema?.fields[0]?.key).toBe("class"));

    expect(result.current.isSubgraphIndexed).toBe(false);
    expect(result.current.indexingState).toBe("pending");
    expect(result.current.schema?.fields[0]).toMatchObject({
      key: "class",
      label: "Class",
      type: "enum",
    });

    fetchSpy.mockRestore();
  });

  it("treats the collection as ready once trait definitions and token attributes are indexed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        body: undefined,
        json: async () => ({
          trait_schema: {
            version: 1,
            fields: [
              {
                key: "class",
                label: "Class",
                type: "enum",
                required: true,
                options: ["Mage", "Warrior"],
              },
            ],
          },
        }),
      } as unknown as Response);

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
              totalSupply: "2",
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
                  options: [],
                },
              ],
            },
            attributes: [{ __typename: "Attribute", id: "attr-1" }],
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

    fetchSpy.mockRestore();
  });

  it("uses indexed trait definitions when they are available", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_COLLECTION_TRAIT_SCHEMA,
          variables: { id: "0x2000000000000000000000000000000000000004" },
        },
        result: {
          data: {
            collection: {
              __typename: "Collection",
              id: "0x2000000000000000000000000000000000000004",
              totalSupply: "2",
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
            attributes: [{ __typename: "Attribute", id: "attr-2" }],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useCollectionTraitSchema("0x2000000000000000000000000000000000000004"),
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
