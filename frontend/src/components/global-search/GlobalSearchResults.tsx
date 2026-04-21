"use client";

import Image from "next/image";
import Link from "next/link";
import { Image as ImageIcon, Layers, Search } from "lucide-react";
import { resolveIpfsUrl } from "@/lib/ipfs";

type Props = {
  open: boolean;
  query: string;
  trimmed: string;
  hasResults: boolean;
  collectionResults: {
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    totalSupply?: string;
  }[];
  nftResults: {
    id: string;
    href: string;
    tokenId: string;
    collectionName: string;
    image: string;
    name: string;
  }[];
  onSelect: () => void;
};

export function GlobalSearchResults({
  open,
  query,
  trimmed,
  hasResults,
  collectionResults,
  nftResults,
  onSelect,
}: Props) {
  if (!open || trimmed.length < 1) {
    return null;
  }

  return (
    <div className="absolute top-full mt-2 w-full min-w-[280px] bg-background border border-outline-variant/20 shadow-2xl z-50 overflow-hidden">
      {!hasResults ? (
        <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
          No results for &ldquo;{query}&rdquo;
        </div>
      ) : (
        <>
          {collectionResults.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Collections
              </p>
              {collectionResults.map((collection) => (
                <Link
                  key={collection.contractAddress}
                  href={`/collections/${collection.contractAddress}`}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
                >
                  <div className="w-9 h-9 shrink-0 bg-surface-container-high overflow-hidden relative">
                    {collection.image ? (
                      <Image
                        src={resolveIpfsUrl(collection.image)}
                        alt={collection.name || "Collection Image"}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Layers size={14} className="text-on-surface-variant/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-headline font-bold truncate text-on-surface">
                      {collection.name}
                    </p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                      {collection.symbol}
                    </p>
                  </div>
                  {collection.totalSupply !== undefined && (
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {collection.totalSupply} NFTs
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {nftResults.length > 0 && (
            <div
              className={
                collectionResults.length > 0
                  ? "border-t border-outline-variant/10"
                  : ""
              }
            >
              <p className="px-4 pt-3 pb-1 text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                NFTs
              </p>
              {nftResults.map((nft) => (
                <Link
                  key={nft.id}
                  href={nft.href}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
                >
                  <div className="w-9 h-9 shrink-0 bg-surface-container-high overflow-hidden flex items-center justify-center relative">
                    {nft.image ? (
                      <Image
                        src={nft.image}
                        alt={nft.name || "NFT Thumbnail"}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    ) : (
                      <ImageIcon size={14} className="text-on-surface-variant/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-headline font-bold text-on-surface truncate">
                      {nft.name}
                    </p>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {nft.collectionName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="border-t border-outline-variant/10">
        <Link
          href={`/explore?q=${encodeURIComponent(trimmed)}`}
          onClick={onSelect}
          className="flex items-center gap-2 px-4 py-3 text-xs text-primary hover:bg-surface-container transition-colors font-headline font-bold uppercase tracking-widest w-full"
        >
          <Search size={11} />
          See all results in Explore
        </Link>
      </div>
    </div>
  );
}
