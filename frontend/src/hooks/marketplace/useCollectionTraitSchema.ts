"use client";

import { useQuery } from "@apollo/client/react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { GET_COLLECTION_TRAIT_SCHEMA } from "@/lib/graphql/queries";
import { fetchIpfsJson } from "@/lib/ipfs";
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
    totalSupply: string;
    contractURI: string | null;
    traitSchemaCID: string | null;
    traitDefinitions: GqlTraitDefinition[];
  } | null;
  attributes: Array<{ id: string }>;
}

type RawSchemaField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
};

type RawContractUri = {
  trait_schema?: { version?: number; fields?: RawSchemaField[] };
};

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

function rawFieldToTraitField(field: RawSchemaField): TraitField {
  const base = {
    key: field.key,
    label: field.label,
    required: field.required ?? false,
  };
  switch (field.type) {
    case "enum":
      return { ...base, type: "enum", options: field.options ?? [] };
    case "number":
      return {
        ...base,
        type: "number",
        ...(field.min !== undefined ? { min: field.min } : {}),
        ...(field.max !== undefined ? { max: field.max } : {}),
      };
    case "boolean":
      return { ...base, type: "boolean" };
    case "date":
      return { ...base, type: "date" };
    default:
      return {
        ...base,
        type: "string",
        ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
      };
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
  const totalSupply = data?.collection?.totalSupply ?? "0";
  const contractURI = data?.collection?.contractURI ?? null;
  const hasIndexedAttributes = (data?.attributes?.length ?? 0) > 0;

  const shouldLoadContractSchema = !!id && !loading && defs.length === 0 && !!contractURI;

  const { data: fallbackSchema } = useTanstackQuery({
    queryKey: ["collection-trait-schema-fallback", contractURI],
    enabled: shouldLoadContractSchema,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const json = await fetchIpfsJson<RawContractUri>(contractURI!);
      const fields = json?.trait_schema?.fields ?? [];
      if (fields.length === 0) return null;
      return {
        version: 1 as const,
        fields: fields.map(rawFieldToTraitField),
      };
    },
  });

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
  } else if (fallbackSchema) {
    schema = fallbackSchema;
  }

  const indexingState =
    !id
      ? "idle"
      : defs.length > 0 && (totalSupply === "0" || hasIndexedAttributes)
        ? "ready"
        : contractURI
          ? "pending"
          : "unavailable";

  return {
    schema,
    optionData,
    traitSchemaCID: data?.collection?.traitSchemaCID ?? null,
    isLoading: loading,
    isSubgraphIndexed: defs.length > 0 && (totalSupply === "0" || hasIndexedAttributes),
    indexingState,
  };
}
