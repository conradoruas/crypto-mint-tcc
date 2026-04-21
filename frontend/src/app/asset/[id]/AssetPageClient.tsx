"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import {
  ShieldCheck,
  TrendingUp,
  Heart,
  Share2,
  HandCoins,
  Check,
} from "lucide-react";
import Image from "next/image";
import type { NFTItem } from "@/types/nft";
import { OffersTable } from "@/components/marketplace/OffersTable";
import { parseAddress } from "@/lib/schemas";
import { shortAddr } from "@/lib/utils";
import { PriceHistory } from "@/components/asset/PriceHistory";
import { ListingPanel } from "@/components/asset/ListingPanel";
import { OfferPanel } from "@/components/asset/OfferPanel";
import { NFTCardSkeleton } from "@/components/ui";
import { useAssetPageCoordinator } from "./useAssetPageCoordinator";

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <NFTCardSkeleton rounded />
        <div className="flex flex-col justify-center space-y-4 pt-4">
          <div className="h-3 rounded-sm animate-pulse w-1/4 bg-surface-container-high" />
          <div className="h-10 rounded-sm animate-pulse w-2/3 bg-surface-container-high" />
          <div className="h-4 rounded-sm animate-pulse w-full bg-surface-container-high" />
          <div className="h-40 rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-14 rounded-sm animate-pulse bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}

export default function AssetPageClient({
  initialNft = null,
}: {
  initialNft?: NFTItem | null;
}) {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const tokenId = (Array.isArray(id) ? id[0] : id) ?? "";
  const nftContract = parseAddress(searchParams.get("contract"));
  const {
    address,
    nft,
    isLoadingNft,
    owner,
    isListed,
    price,
    hasActiveOffer,
    myOfferAmount,
    expiresAt,
    offers,
    isLoadingOffers,
    topOffer,
    isListing,
    listPhase,
    isBuying,
    isBuyConfirming,
    isCancelling,
    isMakingOffer,
    isOfferConfirming,
    isAccepting,
    isCancellingOffer,
    isFavorited,
    toggleFavorite,
    isOwner,
    actions,
  } = useAssetPageCoordinator(tokenId, nftContract ?? null, initialNft);

  if (!nftContract) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <p className="text-center py-20 text-on-surface-variant text-sm">
          Contract address not provided.
        </p>
      </main>
    );
  }

  if (isLoadingNft) return <LoadingSkeleton />;

  if (!nft) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <p className="text-center py-20 text-on-surface-variant text-sm">
          NFT not found.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-on-surface overflow-x-hidden">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Image */}
        <div className="relative overflow-hidden aspect-square bg-surface-container-high border border-outline-variant/10 rounded-sm">
          {nft.image ? (
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-on-surface-variant/30 uppercase tracking-widest">
              No image
            </div>
          )}
        </div>

        {/* Info + Actions */}
        <div className="flex flex-col gap-5 pt-4">
          <div>
            <p className="font-headline font-bold mb-1 uppercase tracking-[0.2em] text-[10px] text-primary">
              #{nft.tokenId.padStart(3, "0")}
            </p>
            <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
              {nft.name}
            </h1>
            {nft.description && (
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {nft.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {owner && (
                <div className="flex items-center gap-2 text-sm bg-surface-container px-3 py-1.5 rounded-sm border border-outline-variant/15">
                  <ShieldCheck size={13} className="text-primary" />
                  <span className="text-on-surface-variant text-xs uppercase tracking-widest">
                    Owner
                  </span>
                  <span className="font-headline font-bold text-sm font-mono text-on-surface">
                    {isOwner ? "You" : shortAddr(owner)}
                  </span>
                </div>
              )}
              {nftContract && (
                <button
                  onClick={() => toggleFavorite(nftContract, tokenId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border transition-all text-xs font-bold uppercase tracking-widest ${
                    isFavorited
                      ? "bg-error/10 border-error/30 text-error"
                      : "bg-surface-container border-outline-variant/15 text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <Heart size={13} className={isFavorited ? "fill-error" : ""} />
                  {isFavorited ? "Saved" : "Save"}
                </button>
              )}
              <button
                onClick={actions.handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-outline-variant/15 bg-surface-container text-on-surface-variant hover:border-outline transition-all text-xs font-bold uppercase tracking-widest"
              >
                {actions.copied ? (
                  <Check size={13} className="text-primary" />
                ) : (
                  <Share2 size={13} />
                )}
                {actions.copied ? "Copied!" : "Share"}
              </button>
            </div>
            {topOffer && (
              <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm bg-tertiary/5 border border-tertiary/20">
                <TrendingUp size={12} className="text-tertiary" />
                <span className="font-headline font-bold text-tertiary">
                  {topOffer} ETH
                </span>
                <span className="text-xs text-on-surface-variant uppercase tracking-widest">
                  top offer
                </span>
              </div>
            )}
          </div>

          <ListingPanel
            isListed={!!isListed}
            price={price}
            isOwner={!!isOwner}
            isBuying={isBuying}
            isBuyConfirming={isBuyConfirming}
            onBuy={actions.handleBuy}
            isCancelling={isCancelling}
            onCancelListing={actions.handleCancelListing}
            showListForm={actions.showListForm}
            listPrice={actions.listPrice}
            listErrors={actions.listErrors}
            isListing={isListing}
            listPhase={listPhase}
            onShowListForm={() => actions.setShowListForm(true)}
            onHideListForm={() => actions.setShowListForm(false)}
            onListPriceChange={(v) => {
              actions.setListPrice(v);
              actions.setListErrors({});
            }}
            onList={actions.handleList}
          />

          {!isOwner && address && (
            <OfferPanel
              hasActiveOffer={!!hasActiveOffer}
              myOfferAmount={myOfferAmount}
              expiresAt={expiresAt ?? null}
              showOfferForm={actions.showOfferForm}
              offerAmount={actions.offerAmount}
              offerErrors={actions.offerErrors}
              isMakingOffer={isMakingOffer}
              isOfferConfirming={isOfferConfirming}
              isCancellingOffer={isCancellingOffer}
              onShowOfferForm={() => actions.setShowOfferForm(true)}
              onHideOfferForm={() => actions.setShowOfferForm(false)}
              onOfferAmountChange={(v) => {
                actions.setOfferAmount(v);
                actions.setOfferErrors({});
              }}
              onMakeOffer={actions.handleMakeOffer}
              onCancelOffer={actions.handleCancelOffer}
            />
          )}

          {/* Price History */}
          <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
            <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Price History
            </h3>
            <PriceHistory nftContract={nftContract} tokenId={tokenId} />
          </div>

          {/* Offers list */}
          <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
            <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <HandCoins size={16} className="text-secondary" />
              Offers
              {offers.length > 0 && (
                <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary uppercase tracking-widest">
                  {offers.length}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-on-surface-variant/70 leading-snug -mt-1">
              Offers load from the indexer for speed, then align with on-chain
              escrow when your wallet can read the marketplace contract.
            </p>
            <OffersTable
              offers={offers}
              isLoading={isLoadingOffers}
              isOwner={!!isOwner}
              onAccept={actions.handleAcceptOffer}
              isAccepting={isAccepting}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
