"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useConnection } from "wagmi";
import { fetchAlchemyMeta } from "@/lib/alchemyMeta";
import type { CollectionNFTItem, FavoriteRef } from "@/types/nft";

function storageKey(address: string) {
  return `nft_favorites_${address.toLowerCase()}`;
}

function readFavorites(address: string): FavoriteRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    return raw ? (JSON.parse(raw) as FavoriteRef[]) : [];
  } catch {
    return [];
  }
}

function writeFavorites(address: string, favs: FavoriteRef[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(address), JSON.stringify(favs));
  // Notifica outras instâncias do hook na mesma aba
  window.dispatchEvent(
    new StorageEvent("storage", { key: storageKey(address) }),
  );
}

// ─────────────────────────────────────────────
// useIsFavorited
// ─────────────────────────────────────────────

export function useIsFavorited(nftContract: string, tokenId: string) {
  const { address } = useConnection();

  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    return () => window.removeEventListener("storage", onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    if (!address) return false;

    const favs = readFavorites(address);
    return favs.some(
      (f) =>
        f.nftContract.toLowerCase() === nftContract.toLowerCase() &&
        f.tokenId === tokenId,
    );
  }, [address, nftContract, tokenId]);

  const isFavorited = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const refetch = useCallback(() => {
    window.dispatchEvent(new Event("storage"));
  }, []);

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
      const favs = readFavorites(address);
      const idx = favs.findIndex(
        (f) =>
          f.nftContract.toLowerCase() === nftContract.toLowerCase() &&
          f.tokenId === tokenId,
      );
      if (idx >= 0) {
        favs.splice(idx, 1);
      } else {
        favs.push({ nftContract, tokenId });
      }
      writeFavorites(address, favs);
    },
    [address],
  );

  return { toggleFavorite };
}

// ─────────────────────────────────────────────
// useUserFavorites
// ─────────────────────────────────────────────

export function useUserFavorites(userAddress: string | undefined) {
  const [favorites, setFavorites] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userAddress) {
      setFavorites([]);
      return;
    }
    const refs = readFavorites(userAddress);
    if (refs.length === 0) {
      setFavorites([]);
      return;
    }

    setIsLoading(true);
    const tokens = refs.map((r) => ({
      contractAddress: r.nftContract,
      tokenId: r.tokenId,
    }));
    const metaMap = await fetchAlchemyMeta(tokens);
    const items: CollectionNFTItem[] = refs.map((ref) => {
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
    setFavorites(items);
    setIsLoading(false);
  }, [userAddress]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-sincroniza quando localStorage muda (outra aba ou toggle)
  useEffect(() => {
    if (!userAddress) return;
    const key = storageKey(userAddress);
    const handler = (e: StorageEvent) => {
      if (e.key === key) load();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [userAddress, load]);

  return { favorites, isLoading };
}
