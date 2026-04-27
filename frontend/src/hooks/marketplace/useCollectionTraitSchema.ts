"use client";

import { useQuery } from "@apollo/client/react";
import { GET_COLLECTION_TRAIT_SCHEMA } from "@/lib/graphql/queries";
import type { TraitSchema, TraitField, TraitOptionData } from "@/types/traits";

interface GqlTraitOption {
  value: string;
  count: string;
  frequency: string;
}

interface GqlTraitDefinition {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  minValue: string | null;
  maxValue: string | null;
  options: GqlTraitOption[];
}

interface GqlCollectionSchema {
  collection: {
    id: string;
    contractURI: string | null;
    traitSchemaCID: string | null;
    traitDefinitions: GqlTraitDefinition[];
  } | null;
}

function toTraitField(def: GqlTraitDefinition): TraitField {
  const base = { key: def.key, label: def.label, required: def.required };
  switch (def.type) {
    case "enum":
      return { ...base, type: "enum", options: def.options.map((o) => o.value) };
    case "number":
      return {
        ...base,
        type: "number",
        ...(def.minValue !== null ? { min: Number(def.minValue) } : {}),
        ...(def.maxValue !== null ? { max: Number(def.maxValue) } : {}),
      };
    case "boolean":
      return { ...base, type: "boolean" };
    case "date":
      return { ...base, type: "date" };
    default:
      return { ...base, type: "string" };
  }
}

export function useCollectionTraitSchema(collectionAddress: string | undefined) {
  const id = collectionAddress?.toLowerCase() ?? "";

  const { data, loading } = useQuery<GqlCollectionSchema>(
    GET_COLLECTION_TRAIT_SCHEMA,
    {
      variables: { id },
      skip: !id,
      fetchPolicy: "cache-first",
    },
  );

  const defs = data?.collection?.traitDefinitions ?? [];
  const contractURI = data?.collection?.contractURI ?? null;

  let schema: TraitSchema | null = null;
  const optionData: Record<string, TraitOptionData[]> = {};

  if (defs.length > 0) {
    schema = { version: 1, fields: defs.map(toTraitField) };
    for (const def of defs) {
      optionData[def.key] = def.options.map((o) => ({
        value: o.value,
        count: Number(o.count),
        frequency: Number(o.frequency),
      }));
    }
  }

  const indexingState =
    !id
      ? "idle"
      : defs.length > 0
        ? "ready"
        : contractURI
          ? "pending"
          : "unavailable";

  return {
    schema,
    optionData,
    traitSchemaCID: data?.collection?.traitSchemaCID ?? null,
    isLoading: loading,
    isSubgraphIndexed: defs.length > 0,
    indexingState,
  };
}
