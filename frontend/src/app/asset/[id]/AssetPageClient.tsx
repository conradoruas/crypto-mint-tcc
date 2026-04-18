"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { useConnection } from "wagmi";
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
import {
  useNFTListing,
  useMyOffer,
  useNFTOffers,
  useListNFT,
  useBuyNFT,
  useCancelListing,
  useMakeOffer,
  useAcceptOffer,
  useCancelOffer,
} from "@/hooks/marketplace";
import { OffersTable } from "@/components/marketplace/OffersTable";
import { useIsFavorited, useFavorite } from "@/hooks/user";
import {
  offerAmountSchema,
  listPriceSchema,
  getZodErrors,
  parseAddress,
  addressSchema,
} from "@/lib/schemas";
import type { ListPriceErrors, OfferAmountErrors } from "@/lib/schemas";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { shortAddr } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { formatTransactionError } from "@/lib/txErrors";
import { toast } from "sonner";
import { PriceHistory } from "@/components/asset/PriceHistory";
import { ListingPanel } from "@/components/asset/ListingPanel";
import { OfferPanel } from "@/components/asset/OfferPanel";
import { NFTCardSkeleton } from "@/components/ui";

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

  const { address } = useConnection();
  const [nft, setNft] = useState<NFTItem | null>(initialNft);
  const [isLoadingNft, setIsLoadingNft] = useState(initialNft == null);
  const [listPrice, setListPrice] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showListForm, setShowListForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [listErrors, setListErrors] = useState<ListPriceErrors>({});
  const [offerErrors, setOfferErrors] = useState<OfferAmountErrors>({});
  const [copied, setCopied] = useState(false);

  const {
    owner,
    isListed,
    price,
    refetch: refetchListing,
  } = useNFTListing(nftContract ?? "", tokenId);
  const {
    hasActiveOffer,
    offerAmount: myOfferAmount,
    expiresAt,
    refetch: refetchMyOffer,
  } = useMyOffer(nftContract ?? "", tokenId);
  const {
    offers,
    isLoading: isLoadingOffers,
    topOffer,
    refetch: refetchOffers,
  } = useNFTOffers(nftContract ?? "", tokenId);

  const { listNFT, isPending: isListing, phase: listPhase } = useListNFT();
  const {
    buyNFT,
    isPending: isBuying,
    isConfirming: isBuyConfirming,
    isSuccess: isBought,
    hash: buyHash,
  } = useBuyNFT();
  const { cancelListing, isPending: isCancelling, isSuccess: isCancelled } =
    useCancelListing();
  const {
    makeOffer,
    isPending: isMakingOffer,
    isConfirming: isOfferConfirming,
    isSuccess: isOfferMade,
  } = useMakeOffer();
  const { acceptOffer, isPending: isAccepting } = useAcceptOffer();
  const {
    cancelOffer,
    isPending: isCancellingOffer,
    isSuccess: isOfferCancelled,
  } = useCancelOffer();

  const { isFavorited } = useIsFavorited(nftContract ?? "", tokenId);
  const { toggleFavorite } = useFavorite();

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  const refetchAll = useCallback(() => {
    refetchListing();
    refetchMyOffer();
    refetchOffers();
  }, [refetchListing, refetchMyOffer, refetchOffers]);

  // Skip the client-side fetch when the Server Component already provided initialNft.
  const skipFetch = initialNft != null;

  useEffect(() => {
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
        if (cancelled) return;
        logger.error("Error fetching NFT", error);
      } finally {
        if (!cancelled) setIsLoadingNft(false);
      }
    };
    fetchNFT();
    return () => { cancelled = true; controller.abort(); };
  }, [tokenId, nftContract, skipFetch]);

  // Consolidate all transaction-success side-effects into a single effect.
  // Each flag is stable across renders and only transitions once per mutation.
  useEffect(() => {
    if (isBought) {
      toast.success("NFT purchased successfully!", {
        action: buyHash
          ? {
              label: "View Tx",
              onClick: () =>
                window.open(
                  `https://sepolia.etherscan.io/tx/${buyHash}`,
                  "_blank",
                ),
            }
          : undefined,
      });
      refetchAll();
    }
  }, [isBought, refetchAll, buyHash]);

  useEffect(() => {
    if (isOfferMade) {
      toast.success("Offer sent! ETH is held in escrow for 7 days.");
      setShowOfferForm(false);
      setOfferAmount("");
      refetchAll();
    }
  }, [isOfferMade, refetchAll]);

  useEffect(() => {
    if (isOfferCancelled) {
      toast.success("Offer cancelled. ETH returned.");
      refetchAll();
    }
  }, [isOfferCancelled, refetchAll]);

  useEffect(() => {
    if (isCancelled) {
      toast.success("Listing cancelled.");
      setShowListForm(false);
      refetchAll();
    }
  }, [isCancelled, refetchAll]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = nft?.name ?? "NFT";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleList = async () => {
    if (!nftContract) return;
    const errors = getZodErrors(listPriceSchema, { price: listPrice }) as ListPriceErrors;
    setListErrors(errors);
    if (errors.price) return;
    try {
      await listNFT(nftContract, tokenId, listPrice);
      setShowListForm(false);
      setListPrice("");
      toast.success("NFT listed successfully!");
      refetchAll();
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not list this NFT."));
    }
  };

  const handleBuy = async () => {
    if (!nftContract || !price) return;
    try {
      await buyNFT(nftContract, tokenId, price);
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not complete purchase."));
    }
  };

  const handleCancelListing = async () => {
    if (!nftContract) return;
    try {
      await cancelListing(nftContract, tokenId);
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not cancel listing."));
    }
  };

  const handleMakeOffer = async () => {
    if (!nftContract) return;
    const errors = getZodErrors(offerAmountSchema, { amount: offerAmount }) as OfferAmountErrors;
    setOfferErrors(errors);
    if (errors.amount) return;
    try {
      await makeOffer(nftContract, tokenId, offerAmount);
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not send offer."));
    }
  };

  const handleAcceptOffer = async (buyerAddress: string) => {
    if (!nftContract) return;
    const result = addressSchema.safeParse(buyerAddress);
    if (!result.success) {
      toast.error("Buyer address is invalid. Action cancelled for security.");
      return;
    }
    try {
      await acceptOffer(nftContract, tokenId, result.data);
      toast.success("Offer accepted! NFT transferred.");
      refetchAll();
    } catch (e) {
      logger.error("acceptOffer failed", e);
      toast.error(formatTransactionError(e, "Could not accept offer."));
    }
  };

  const handleCancelOffer = async () => {
    if (!nftContract) return;
    try {
      await cancelOffer(nftContract, tokenId);
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not cancel offer."));
    }
  };

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
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-outline-variant/15 bg-surface-container text-on-surface-variant hover:border-outline transition-all text-xs font-bold uppercase tracking-widest"
              >
                {copied ? (
                  <Check size={13} className="text-primary" />
                ) : (
                  <Share2 size={13} />
                )}
                {copied ? "Copied!" : "Share"}
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
            onBuy={handleBuy}
            isCancelling={isCancelling}
            onCancelListing={handleCancelListing}
            showListForm={showListForm}
            listPrice={listPrice}
            listErrors={listErrors}
            isListing={isListing}
            listPhase={listPhase}
            onShowListForm={() => setShowListForm(true)}
            onHideListForm={() => setShowListForm(false)}
            onListPriceChange={(v) => { setListPrice(v); setListErrors({}); }}
            onList={handleList}
          />

          {!isOwner && address && (
            <OfferPanel
              hasActiveOffer={!!hasActiveOffer}
              myOfferAmount={myOfferAmount}
              expiresAt={expiresAt ?? null}
              showOfferForm={showOfferForm}
              offerAmount={offerAmount}
              offerErrors={offerErrors}
              isMakingOffer={isMakingOffer}
              isOfferConfirming={isOfferConfirming}
              isCancellingOffer={isCancellingOffer}
              onShowOfferForm={() => setShowOfferForm(true)}
              onHideOfferForm={() => setShowOfferForm(false)}
              onOfferAmountChange={(v) => { setOfferAmount(v); setOfferErrors({}); }}
              onMakeOffer={handleMakeOffer}
              onCancelOffer={handleCancelOffer}
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
              onAccept={handleAcceptOffer}
              isAccepting={isAccepting}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
