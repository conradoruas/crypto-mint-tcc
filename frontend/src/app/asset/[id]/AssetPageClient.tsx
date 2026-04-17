"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useConnection } from "wagmi";
import { Navbar } from "@/components/navbar";
import {
  ShoppingCart,
  ShieldCheck,
  Tag,
  X,
  Loader2,
  HandCoins,
  CheckCircle,
  TrendingUp,
  Heart,
  Share2,
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
import { OffersTable, ExpiresIn } from "@/components/marketplace/OffersTable";
import { useIsFavorited, useFavorite } from "@/hooks/user";
import { useActivityFeed } from "@/hooks/activity";
import {
  listPriceSchema,
  offerAmountSchema,
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
import { EthAmountInput, IconButton } from "@/components/ui";

// ─── Price History Chart ──────────────────────────────────────────────────────

const W = 500;
const H = 150;
const PAD = { top: 10, right: 16, bottom: 36, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PriceHistory({
  nftContract,
  tokenId,
}: {
  nftContract: string;
  tokenId: string;
}) {
  const { events, isLoading } = useActivityFeed(nftContract, 200);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    price: string;
    date: string;
  } | null>(null);

  const sales = useMemo(
    () =>
      events
        .filter((e) => e.type === "sale" && e.tokenId === tokenId && e.priceETH)
        .map((e) => ({
          price: parseFloat(e.priceETH!),
          ts: e.timestamp ?? 0,
          txHash: e.txHash,
        }))
        .sort((a, b) => a.ts - b.ts),
    [events, tokenId],
  );

  const isSkeleton = isLoading && sales.length === 0;

  if (isSkeleton) {
    return (
      <div className="h-[150px] animate-pulse bg-surface-container-high rounded-sm" />
    );
  }

  if (sales.length < 2) {
    return (
      <div className="h-[150px] flex items-center justify-center text-xs text-on-surface-variant/40 uppercase tracking-widest border border-dashed border-outline-variant/15 rounded-sm">
        No sales recorded yet
      </div>
    );
  }

  const minP = Math.min(...sales.map((s) => s.price));
  const maxP = Math.max(...sales.map((s) => s.price));
  const minTs = sales[0].ts;
  const maxTs = sales[sales.length - 1].ts;
  const rangeP = maxP - minP || 1;
  const rangeTs = maxTs - minTs || 1;

  const sx = (ts: number) => PAD.left + ((ts - minTs) / rangeTs) * PLOT_W;
  const sy = (p: number) => PAD.top + (1 - (p - minP) / rangeP) * PLOT_H;

  const pts = sales.map((s) => ({ ...s, cx: sx(s.ts), cy: sy(s.price) }));
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`)
    .join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].cx},${PAD.top + PLOT_H} L${pts[0].cx},${PAD.top + PLOT_H} Z`;

  const yTicks = [minP, (minP + maxP) / 2, maxP];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = pts[0];
    let minDist = Math.abs(pts[0].cx - mouseX);
    for (const p of pts) {
      const d = Math.abs(p.cx - mouseX);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    setTooltip({
      x: (closest.cx / W) * 100,
      y: (closest.cy / H) * 100,
      price: closest.price.toFixed(4),
      date: fmtDate(closest.ts),
    });
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0.01"
            />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => {
          const y = sy(tick);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 12}
                y={y + 4.5}
                textAnchor="end"
                fontSize="14"
                fill="currentColor"
                fillOpacity="0.6"
              >
                {tick.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        <text
          x={PAD.left}
          y={H - 6}
          fontSize="14"
          fill="currentColor"
          fillOpacity="0.6"
        >
          {fmtDate(minTs)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          fontSize="14"
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.6"
        >
          {fmtDate(maxTs)}
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#priceAreaGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="3"
            fill="var(--color-primary)"
            stroke="var(--color-background)"
            strokeWidth="1.5"
          />
        ))}

        {/* Crosshair on hover */}
        {tooltip && (
          <line
            x1={(tooltip.x / 100) * W}
            y1={PAD.top}
            x2={(tooltip.x / 100) * W}
            y2={PAD.top + PLOT_H}
            stroke="var(--color-primary)"
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-sm bg-surface-container-high border border-outline-variant/20 shadow-md text-xs"
          style={{
            left: `clamp(0%, calc(${tooltip.x}% - 48px), calc(100% - 96px))`,
            top: `calc(${tooltip.y}% - 38px)`,
          }}
        >
          <p className="font-headline font-bold text-primary">
            {tooltip.price} ETH
          </p>
          <p className="text-on-surface-variant">{tooltip.date}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className="aspect-square animate-pulse bg-surface-container-high rounded-sm" />
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
  const { cancelListing, isPending: isCancelling } = useCancelListing();
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
  const [copied, setCopied] = useState(false);
  const [listErrors, setListErrors] = useState<ListPriceErrors>({});
  const [offerErrors, setOfferErrors] = useState<OfferAmountErrors>({});

  const handleShare = async () => {
    const url = window.location.href;
    const title = nft?.name ?? "NFT";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  const listFlowLabel =
    listPhase === "approve-wallet"
      ? "Approve in wallet…"
      : listPhase === "approve-confirm"
        ? "Confirming approval…"
        : listPhase === "exec-wallet"
          ? "Sign listing…"
          : listPhase === "exec-confirm"
            ? "Confirming listing…"
            : "Working…";

  const refetchAll = useCallback(() => {
    refetchListing();
    refetchMyOffer();
    refetchOffers();
  }, [refetchListing, refetchMyOffer, refetchOffers]);

  // Skip the client-side fetch when the Server Component already provided initialNft.
  // Falls back to a client fetch only when the server fetch failed or returned null
  // (e.g., bot crawlers without JS, or a cold-miss on the server cache).
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
  const handleList = async () => {
    if (!nftContract) return;
    const errors = getZodErrors(listPriceSchema, {
      price: listPrice,
    }) as ListPriceErrors;
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
      toast.success("Listing cancelled.");
      refetchAll();
    } catch (e) {
      toast.error(formatTransactionError(e, "Could not cancel listing."));
    }
  };

  const handleMakeOffer = async () => {
    if (!nftContract) return;
    const errors = getZodErrors(offerAmountSchema, {
      amount: offerAmount,
    }) as OfferAmountErrors;
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
      toast.error(
        "Buyer address is invalid. Action cancelled for security.",
      );
      return;
    }

    // Validated and typed as Address (0x...)
    const safeBuyer = result.data;

    try {
      await acceptOffer(nftContract, tokenId, safeBuyer);
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
                    {isOwner
                      ? "You"
                      : shortAddr(owner)}
                  </span>
                </div>
              )}
              {address && (
                <button
                  onClick={() => toggleFavorite(nftContract, tokenId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border transition-all text-xs font-bold uppercase tracking-widest ${isFavorited
                      ? "bg-error/10 border-error/30 text-error"
                      : "bg-surface-container border-outline-variant/15 text-on-surface-variant hover:border-outline"
                    }`}
                >
                  <Heart
                    size={13}
                    className={isFavorited ? "fill-error" : ""}
                  />
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

          {/* Buy / List Panel */}
          <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
            {isListed && price ? (
              <>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1 font-headline font-bold">
                    Sale Price
                  </p>
                  <p className="font-headline text-3xl font-bold text-primary">
                    {price} ETH
                  </p>
                </div>
                {isOwner ? (
                  <button
                    onClick={handleCancelListing}
                    disabled={isCancelling}
                    className={`w-full font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${isCancelling
                        ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                        : "bg-error/5 border-error/20 text-error hover:bg-error/10"
                      }`}
                  >
                    {isCancelling ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <X size={18} />
                    )}
                    {isCancelling ? "Cancelling..." : "Cancel Listing"}
                  </button>
                ) : (
                  <div className="relative group overflow-hidden">
                    <button
                      onClick={handleBuy}
                      disabled={isBuying || isBuyConfirming}
                      className={`w-full relative overflow-hidden font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${isBuying || isBuyConfirming
                          ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                          : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                        }`}
                    >
                      {!(isBuying || isBuyConfirming) && (
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                      )}
                      {isBuying || isBuyConfirming ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <ShoppingCart size={18} />
                      )}
                      {isBuying
                        ? "Awaiting wallet..."
                        : isBuyConfirming
                          ? "Confirming..."
                          : "Buy Now"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-on-surface-variant/50 uppercase tracking-widest text-xs">
                  This NFT is not for sale.
                </p>
                {isOwner &&
                  (showListForm ? (
                    <div className="space-y-3">
                      <EthAmountInput
                        value={listPrice}
                        onChange={(v) => { setListPrice(v); setListErrors({}); }}
                        placeholder="Price in ETH (e.g. 0.05)"
                        aria-label="Listing price in ETH"
                        error={listErrors.price}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleList}
                          disabled={isListing}
                          className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${isListing
                              ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                              : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110"
                            }`}
                        >
                          {isListing ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Tag size={16} />
                          )}
                          {isListing ? listFlowLabel : "Confirm Listing"}
                        </button>
                        <IconButton
                          onClick={() => setShowListForm(false)}
                          aria-label="Close"
                          variant="outlined"
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group overflow-hidden">
                      <button
                        onClick={() => setShowListForm(true)}
                        className="w-full relative overflow-hidden font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99] transition-all text-sm uppercase tracking-widest"
                      >
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                        <Tag size={18} /> List for Sale
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>

          {/* Offer panel (non-owner) */}
          {!isOwner && address && (
            <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
              <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                <HandCoins size={16} className="text-secondary" />
                Make an Offer
              </h3>
              {hasActiveOffer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm p-3 rounded-sm bg-primary/5 border border-primary/20 text-primary">
                    <CheckCircle size={14} />
                    <span>
                      Your active offer:{" "}
                      <strong className="font-mono">{myOfferAmount} ETH</strong>
                    </span>
                  </div>
                  {expiresAt && (
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      Expires: <ExpiresIn expiresAt={expiresAt} />
                    </div>
                  )}
                  <button
                    onClick={handleCancelOffer}
                    disabled={isCancellingOffer}
                    className={`w-full font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${isCancellingOffer
                        ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                        : "bg-error/5 border-error/20 text-error hover:bg-error/10"
                      }`}
                  >
                    {isCancellingOffer ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <X size={16} />
                    )}
                    {isCancellingOffer
                      ? "Cancelling..."
                      : "Cancel Offer & Reclaim ETH"}
                  </button>
                </div>
              ) : showOfferForm ? (
                <div className="space-y-3">
                  <EthAmountInput
                    value={offerAmount}
                    onChange={(v) => { setOfferAmount(v); setOfferErrors({}); }}
                    placeholder="Amount in ETH (e.g. 0.08)"
                    aria-label="Offer amount in ETH"
                    error={offerErrors.amount}
                  />
                  <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest">
                    ETH will be held in escrow for 7 days.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleMakeOffer}
                      disabled={isMakingOffer || isOfferConfirming}
                      className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${isMakingOffer || isOfferConfirming
                          ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                          : "bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20"
                        }`}
                    >
                      {isMakingOffer || isOfferConfirming ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <HandCoins size={16} />
                      )}
                      {isMakingOffer
                        ? "Awaiting wallet..."
                        : isOfferConfirming
                          ? "Confirming..."
                          : "Send Offer"}
                    </button>
                    <IconButton
                      onClick={() => setShowOfferForm(false)}
                      aria-label="Close"
                      variant="outlined"
                    >
                      <X size={16} />
                    </IconButton>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowOfferForm(true)}
                  className="w-full font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm bg-secondary/5 border border-secondary/20 text-secondary hover:bg-secondary/10 transition-all text-sm uppercase tracking-widest"
                >
                  <HandCoins size={18} /> Make an Offer
                </button>
              )}
            </div>
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
