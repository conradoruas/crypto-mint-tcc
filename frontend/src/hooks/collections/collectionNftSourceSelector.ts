import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

export type CollectionNftSourceKind = "subgraph" | "alchemy";

export function resolveCollectionNftSource(): CollectionNftSourceKind {
  return SUBGRAPH_ENABLED ? "subgraph" : "alchemy";
}
