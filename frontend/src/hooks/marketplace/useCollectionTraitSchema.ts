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
    contractURI: string | null;
    traitSchemaCID: string | null;
    traitDefinitions: GqlTraitDefinition[];
  } | null;
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

function rawFieldToTraitField(f: RawSchemaField): TraitField {
  const base = { key: f.key, label: f.label, required: f.required ?? false };
  switch (f.type) {
    case "enum":
      return { ...base, type: "enum", options: f.options ?? [] };
    case "number":
      return {
        ...base,
        type: "number",
        ...(f.min !== undefined ? { min: f.min } : {}),
        ...(f.max !== undefined ? { max: f.max } : {}),
      };
    case "boolean":
      return { ...base, type: "boolean" };
    case "date":
      return { ...base, type: "date" };
    default:
      return { ...base, type: "string", ...(f.maxLength !== undefined ? { maxLength: f.maxLength } : {}) };
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

  // Fall back to fetching the contractURI IPFS JSON directly when the subgraph
  // File Data Source hasn't resolved traitDefinitions yet.
  const needsIpfsFallback = !!id && !loading && defs.length === 0 && !!contractURI;

  const { data: ipfsSchema } = useTanstackQuery({
    queryKey: ["contract-uri-schema", contractURI],
    queryFn: async () => {
      const json = await fetchIpfsJson<RawContractUri>(contractURI!);
      return json?.trait_schema ?? null;
    },
    enabled: needsIpfsFallback,
    staleTime: 5 * 60 * 1000,
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
  } else if (ipfsSchema && ipfsSchema.fields && ipfsSchema.fields.length > 0) {
    schema = { version: 1, fields: ipfsSchema.fields.map(rawFieldToTraitField) };
    // No frequency data available from IPFS — option counts start at 0
    for (const f of ipfsSchema.fields) {
      if (f.type === "enum" && f.options) {
        optionData[f.key] = f.options.map((v) => ({ value: v, count: 0, frequency: 0 }));
      }
    }
  }

  return {
    schema,
    optionData,
    traitSchemaCID: data?.collection?.traitSchemaCID ?? null,
    isLoading: loading,
    // false when schema came from IPFS fallback — attributes are not yet indexed by the subgraph
    isSubgraphIndexed: defs.length > 0,
  };
}
