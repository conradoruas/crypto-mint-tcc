import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNowBucketed } from "../useNowBucketed";
import { resolveExploreNftMetadata } from "./exploreMetadata";
import { buildExploreQueryConfig } from "./exploreQuery";
import type { ExploreVariant, GqlNFTsData, NFTItemWithMarket } from "./exploreTypes";

type UseExploreOrchestratorArgs = {
  variant: ExploreVariant;
  collectionAddress?: string;
  page?: number;
  pageSize?: number;
  onlyListed?: boolean;
  search?: string;
  sort?: string;
};

export function useExploreOrchestrator({
  variant,
  collectionAddress,
  page = 1,
  pageSize = 20,
  onlyListed = false,
  search = "",
  sort = "default",
}: UseExploreOrchestratorArgs) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const queryClient = useQueryClient();
  const nowBucketed = useNowBucketed();

  const queryConfig = useMemo(
    () =>
      buildExploreQueryConfig({
        variant,
        collectionAddress,
        page,
        pageSize,
        onlyListed,
        search,
        sort,
        nowBucketed,
      }),
    [collectionAddress, nowBucketed, onlyListed, page, pageSize, search, sort, variant],
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
      const hasNextPage = queryConfig.trimExtraRecord
        ? rawAll.length > queryConfig.pageSize
        : rawAll.length === queryConfig.pageSize;
      const raw = queryConfig.trimExtraRecord
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

      if (!cancelled) {
        setHasMore(hasNextPage);
        setIsLoading(true);
      }

      const enriched = await resolveExploreNftMetadata(
        raw,
        queryClient,
        collectionAddress,
      );

      if (cancelled) {
        return;
      }

      const items =
        variant === "market" && sort === "offer_desc"
          ? [...enriched].sort(
              (left, right) =>
                Number(right.topOffer ?? 0) - Number(left.topOffer ?? 0),
            )
          : enriched;

      setNfts(items);
      setIsLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    collectionAddress,
    data,
    loading,
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
