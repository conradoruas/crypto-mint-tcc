import Image from "next/image";
import Link from "next/link";
import { Heart, Tag } from "lucide-react";
import type { NFTItemWithMarket } from "@/types/nft";
import { useIsFavorited, useFavorite } from "@/hooks/user";

export function NFTCard({
  nft,
  userAddress,
  priority = false, // defaults to false (lazy loading) to resolve task 4.4
}: {
  nft: NFTItemWithMarket;
  userAddress?: string;
  priority?: boolean;
}) {
  const { isFavorited } = useIsFavorited(nft.nftContract, nft.tokenId);
  const { toggleFavorite } = useFavorite();

  const isMyListing =
    !!nft.listingPrice &&
    !!nft.seller &&
    !!userAddress &&
    nft.seller.toLowerCase() === userAddress.toLowerCase();

  return (
    <div className="relative group bg-surface-container-low rounded-sm overflow-hidden hover:scale-[1.02] transition-all duration-300 border border-outline-variant/5">
      <Link
        href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
        className="block"
      >
        <div className="aspect-square overflow-hidden bg-surface-container-lowest relative">
          {nft.image ? (
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full animate-pulse bg-surface-container-high" />
          )}

          {/* Top overlay row: badges left, heart right */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {nft.listingPrice && (
                <div
                  className={`glass-panel px-2 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                    isMyListing
                      ? "text-tertiary border-tertiary/20"
                      : "text-primary border-primary/20"
                  }`}
                >
                  {isMyListing ? "Your Listing" : "For Sale"}
                </div>
              )}
              {nft.topOffer && (
                <div className="glass-panel px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary border border-secondary/20">
                  Offer
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(nft.nftContract, nft.tokenId);
              }}
              className={`transition-all drop-shadow-md ${
                isFavorited
                  ? "text-error"
                  : "text-white/60 opacity-0 group-hover:opacity-100"
              }`}
            >
              <Heart size={25} className={isFavorited ? "fill-error" : ""} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                {nft.collectionName}
              </p>
              <h4 className="font-headline text-lg font-bold group-hover:text-primary transition-colors">
                {nft.name}
              </h4>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-bold">
                #{nft.tokenId.padStart(3, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
            <div>
              <span className="block text-[10px] text-on-surface-variant uppercase tracking-widest">
                Price
              </span>
              <span className="font-headline font-bold text-on-surface">
                {nft.listingPrice ? (
                  `${nft.listingPrice} ETH`
                ) : (
                  <span className="text-on-surface-variant/50 font-normal text-sm italic">
                    Not listed
                  </span>
                )}
              </span>
              {nft.topOffer && (
                <span className="block text-[10px] text-secondary font-bold uppercase tracking-widest mt-0.5">
                  Offer {nft.topOffer} ETH
                </span>
              )}
            </div>

            {nft.listingPrice &&
              (isMyListing ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-secondary/5 border border-secondary/20 text-secondary text-xs font-bold uppercase tracking-widest">
                  <Tag size={11} />
                  Listed
                </div>
              ) : (
                <div className="bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed px-4 py-2 rounded-sm text-xs font-black uppercase tracking-widest transition-all">
                  Buy Now
                </div>
              ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
