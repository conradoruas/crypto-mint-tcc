import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNowBucketed } from "../useNowBucketed";
import { resolveExploreNftMetadata } from "./exploreMetadata";
import { buildExploreQueryConfig, matchesClientTraitFilters } from "./exploreQuery";
import type { ExploreVariant, GqlNFTsData, NFTItemWithMarket } from "./exploreTypes";
import type { TraitFilters } from "@/types/traits";

const CLIENT_SIDE_FETCH_SIZE = 500;

type UseExploreOrchestratorArgs = {
  variant: ExploreVariant;
  collectionAddress?: string;
  page?: number;
  pageSize?: number;
  onlyListed?: boolean;
  search?: string;
  sort?: string;
  traitFilters?: TraitFilters;
  /** When set, skips subgraph attribute filtering and filters the resolved IPFS attributes client-side. */
  clientSideTraitFilters?: TraitFilters;
};

export function useExploreOrchestrator({
  variant,
  collectionAddress,
  page = 1,
  pageSize = 20,
  onlyListed = false,
  search = "",
  sort = "default",
  traitFilters = {},
  clientSideTraitFilters,
}: UseExploreOrchestratorArgs) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const queryClient = useQueryClient();
  const nowBucketed = useNowBucketed();

  const hasClientFilters =
    !!clientSideTraitFilters && Object.keys(clientSideTraitFilters).length > 0;

  const queryConfig = useMemo(
    () =>
      buildExploreQueryConfig({
        variant,
        collectionAddress,
        // In client-side mode: fetch page 1 of a large batch; subgraph does no trait filtering.
        page: hasClientFilters ? 1 : page,
        pageSize: hasClientFilters ? CLIENT_SIDE_FETCH_SIZE : pageSize,
        onlyListed,
        search,
        sort,
        // Skip subgraph trait filtering in client-side mode.
        traitFilters: hasClientFilters ? {} : traitFilters,
        nowBucketed,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionAddress, nowBucketed, onlyListed, hasClientFilters, page, pageSize, search, sort, variant,
      JSON.stringify(traitFilters),
      JSON.stringify(clientSideTraitFilters)],
  );

  const { data, loading, refetch } = useQuery<GqlNFTsData>(queryConfig.query, {
    skip: queryConfig.skip,
    variables: queryConfig.variables,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (loading) {
        if (!cancelled) setIsLoading(true);
        return;
      }

      const rawAll = data?.nfts ?? [];

      // In client-side mode we fetched a large batch — no server trim needed.
      const raw = hasClientFilters
        ? rawAll
        : queryConfig.trimExtraRecord
          ? rawAll.slice(0, queryConfig.pageSize)
          : rawAll;

      if (!raw.length) {
        if (!cancelled) {
          setNfts([]);
          setHasMore(false);
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) setIsLoading(true);

      const enriched = await resolveExploreNftMetadata(
        raw,
        queryClient,
        collectionAddress,
      );

      if (cancelled) return;

      let items =
        variant === "market" && sort === "offer_desc"
          ? [...enriched].sort(
              (left, right) =>
                Number(right.topOffer ?? 0) - Number(left.topOffer ?? 0),
            )
          : enriched;

      if (hasClientFilters) {
        // Filter client-side, then slice for the current page.
        const filtered = items.filter((nft) =>
          matchesClientTraitFilters(nft, clientSideTraitFilters!),
        );
        const start = (page - 1) * pageSize;
        setHasMore(filtered.length > start + pageSize);
        items = filtered.slice(start, start + pageSize);
      } else {
        const hasNextPage = queryConfig.trimExtraRecord
          ? rawAll.length > queryConfig.pageSize
          : rawAll.length === queryConfig.pageSize;
        setHasMore(hasNextPage);
      }

      setNfts(items);
      setIsLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    collectionAddress,
    clientSideTraitFilters,
    data,
    hasClientFilters,
    loading,
    page,
    pageSize,
    queryClient,
    queryConfig.pageSize,
    queryConfig.trimExtraRecord,
    sort,
    variant,
  ]);

  return {
    nfts,
    isLoading,
    hasMore,
    refetch: useCallback(() => refetch(), [refetch]),
  };
}
