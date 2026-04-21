"use client";

import type { FavoriteRef } from "@/types/nft";

const FAVORITES_EVENT = "cryptomint:favorites-changed";

export function favoritesStorageKey(address: string) {
  return `nft_favorites_${address.toLowerCase()}`;
}

export function readFavoriteRefs(address: string): FavoriteRef[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(favoritesStorageKey(address));
    return raw ? (JSON.parse(raw) as FavoriteRef[]) : [];
  } catch {
    return [];
  }
}

function emitFavoritesChanged(address: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(FAVORITES_EVENT, {
      detail: { key: favoritesStorageKey(address) },
    }),
  );
}

export function writeFavoriteRefs(address: string, favorites: FavoriteRef[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(favoritesStorageKey(address), JSON.stringify(favorites));
  emitFavoritesChanged(address);
}

export function toggleFavoriteRef(
  address: string,
  nftContract: string,
  tokenId: string,
) {
  const favorites = readFavoriteRefs(address);
  const nextFavorites = [...favorites];
  const matchIndex = nextFavorites.findIndex(
    (favorite) =>
      favorite.nftContract.toLowerCase() === nftContract.toLowerCase() &&
      favorite.tokenId === tokenId,
  );

  if (matchIndex >= 0) {
    nextFavorites.splice(matchIndex, 1);
  } else {
    nextFavorites.push({ nftContract, tokenId });
  }

  writeFavoriteRefs(address, nextFavorites);
}

export function subscribeToFavorites(
  address: string | undefined,
  onChange: () => void,
) {
  if (typeof window === "undefined" || !address) {
    return () => {};
  }

  const key = favoritesStorageKey(address);
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === key) onChange();
  };
  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (!detail?.key || detail.key === key) onChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(FAVORITES_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(FAVORITES_EVENT, handleCustom);
  };
}
