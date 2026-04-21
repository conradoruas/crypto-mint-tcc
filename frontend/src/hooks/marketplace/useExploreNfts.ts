import { useExploreOrchestrator } from "./useExploreOrchestrator";

export type { NFTItemWithMarket } from "./exploreTypes";

export function useExploreNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
) {
  return useExploreOrchestrator({
    variant: "collection",
    collectionAddress,
    page,
    pageSize,
  });
}

export function useExploreAllNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
  onlyListed: boolean = false,
  search: string = "",
  sort: string = "default",
) {
  return useExploreOrchestrator({
    variant: "market",
    collectionAddress,
    page,
    pageSize,
    onlyListed,
    search,
    sort,
  });
}
