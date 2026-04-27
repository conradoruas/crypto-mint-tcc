import { useExploreOrchestrator } from "./useExploreOrchestrator";
import type { TraitFilters } from "@/types/traits";

export type { NFTItemWithMarket } from "./exploreTypes";

export function useExploreNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
  traitFilters: TraitFilters = {},
) {
  return useExploreOrchestrator({
    variant: "collection",
    collectionAddress,
    page,
    pageSize,
    traitFilters,
  });
}

export function useExploreAllNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
  onlyListed: boolean = false,
  search: string = "",
  sort: string = "default",
  traitFilters: TraitFilters = {},
  clientSideTraitFilters?: TraitFilters,
) {
  return useExploreOrchestrator({
    variant: "market",
    collectionAddress,
    page,
    pageSize,
    onlyListed,
    search,
    sort,
    traitFilters,
    clientSideTraitFilters,
  });
}
