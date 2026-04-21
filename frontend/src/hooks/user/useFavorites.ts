"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useConnection } from "wagmi";
import { fetchBatchNFTMetadata as fetchAlchemyMeta } from "@/lib/nftMetadata";
import type { CollectionNFTItem, FavoriteRef } from "@/types/nft";
import { useQuery } from "@tanstack/react-query";
import {
  favoritesStorageKey,
  readFavoriteRefs,
  subscribeToFavorites,
  toggleFavoriteRef,
} from "./favoritesStore";

// ─────────────────────────────────────────────
// useIsFavorited
// ─────────────────────────────────────────────

export function useIsFavorited(nftContract: string, tokenId: string) {
  const { address } = useConnection();

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToFavorites(address, onStoreChange),
    [address],
  );

  const getSnapshot = useCallback(() => {
    if (!address) return false;

    const favs = readFavoriteRefs(address);
    return favs.some(
      (f) =>
        f.nftContract.toLowerCase() === nftContract.toLowerCase() &&
        f.tokenId === tokenId,
    );
  }, [address, nftContract, tokenId]);

  const isFavorited = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const refetch = useCallback(() => {}, []);

  return { isFavorited, isLoading: false, refetch };
}

// ─────────────────────────────────────────────
// useFavorite
// ─────────────────────────────────────────────

export function useFavorite() {
  const { address } = useConnection();

  const toggleFavorite = useCallback(
    (nftContract: string, tokenId: string) => {
      if (!address) return;
      toggleFavoriteRef(address, nftContract, tokenId);
    },
    [address],
  );

  return { toggleFavorite };
}

// ─────────────────────────────────────────────
// useUserFavorites
// ─────────────────────────────────────────────

export function useUserFavorites(userAddress: string | undefined) {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeToFavorites(userAddress, onStoreChange),
    [userAddress],
  );

  const favoriteRefsRaw = useSyncExternalStore(
    subscribe,
    () => {
      if (typeof window === "undefined" || !userAddress) return "";
      return localStorage.getItem(favoritesStorageKey(userAddress)) ?? "";
    },
    () => "",
  );

  const favoriteRefs = useMemo<FavoriteRef[]>(() => {
    if (!userAddress || favoriteRefsRaw === "") return [];
    return readFavoriteRefs(userAddress);
  }, [userAddress, favoriteRefsRaw]);
  const hasFavorites = favoriteRefs.length > 0;

  const { data: favorites = [], isLoading } = useQuery<CollectionNFTItem[]>({
    queryKey: [
      "user-favorites",
      userAddress,
      favoriteRefs.map((favorite) => `${favorite.nftContract}-${favorite.tokenId}`),
    ],
    queryFn: async () => {
      if (!userAddress || favoriteRefs.length === 0) return [];

      const tokens = favoriteRefs.map((ref) => ({
        contractAddress: ref.nftContract,
        tokenId: ref.tokenId,
      }));
      const metaMap = await fetchAlchemyMeta(tokens);

      return favoriteRefs.map((ref) => {
        const key = `${ref.nftContract.toLowerCase()}-${ref.tokenId}`;
        const meta = metaMap.get(key);
        return {
          tokenId: ref.tokenId,
          name: meta?.name ?? `NFT #${ref.tokenId}`,
          description: "",
          image: meta?.image ?? "",
          nftContract: ref.nftContract,
        };
      });
    },
    enabled: !!userAddress && hasFavorites,
    staleTime: 60_000,
  });

  return { favorites, isLoading: hasFavorites ? isLoading : false };
}
