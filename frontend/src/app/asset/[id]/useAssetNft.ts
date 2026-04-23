"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import type { NFTItem } from "@/types/nft";
import { normalizeNftText, resolveNftImage } from "@/lib/nftMetadata";

export function useAssetNft(
  tokenId: string,
  nftContract: string | null,
  initialNft?: NFTItem | null,
) {
  const [nft, setNft] = useState<NFTItem | null>(initialNft ?? null);
  const [isLoadingNft, setIsLoadingNft] = useState(initialNft == null);

  useEffect(() => {
    const skipFetch = initialNft != null;
    if (skipFetch) return;
    if (!nftContract) {
      setIsLoadingNft(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const { signal } = controller;

    const fetchNFT = async () => {
      try {
        const res = await fetch(
          `/api/alchemy/getNFTMetadata?contractAddress=${nftContract}&tokenId=${tokenId}&refreshCache=false`,
          { signal },
        );
        if (!res.ok) throw new Error(`metadata_fetch_failed:${res.status}`);
        const data = await res.json();
        const image = await resolveNftImage(data.image, data.tokenUri, { signal });

        if (cancelled) return;
        setNft({
          tokenId: normalizeNftText(data.tokenId, tokenId, 100),
          name: normalizeNftText(data.name, `NFT #${tokenId}`, 500),
          description: normalizeNftText(data.description, "", 10_000),
          image,
          nftContract,
        });
      } catch (error) {
        if (!cancelled) logger.error("Error fetching NFT", error);
      } finally {
        if (!cancelled) setIsLoadingNft(false);
      }
    };

    fetchNFT();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialNft, nftContract, tokenId]);

  return { nft, isLoadingNft, setNft };
}
