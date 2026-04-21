"use client";

import { useEffect, useState } from "react";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { logger } from "@/lib/logger";
import type { NFTItem } from "@/types/nft";

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
        const data = await res.json();
        let image = data.image?.cachedUrl ?? data.image?.originalUrl ?? "";

        if (!image && data.tokenUri) {
          const metaRes = await fetch(resolveIpfsUrl(data.tokenUri), { signal });
          const meta = await metaRes.json();
          image = resolveIpfsUrl(meta.image ?? "");
        }

        if (cancelled) return;
        setNft({
          tokenId: data.tokenId,
          name: data.name ?? `NFT #${tokenId}`,
          description: data.description ?? "",
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
