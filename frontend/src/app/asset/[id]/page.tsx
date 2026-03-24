"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { formatEther } from "viem";
import { Navbar } from "@/components/NavBar";
import {
  ShoppingCart,
  ShieldCheck,
  Tag,
  X,
  Loader2,
  HandCoins,
  CheckCircle,
  Clock,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { NFTItem } from "@/hooks/useExploreNfts";
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
  OfferWithBuyer,
} from "@/hooks/useMarketplace";

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

const inputClass =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

function TxMessage({
  type,
  text,
  hash,
}: {
  type: "success" | "error";
  text: string;
  hash?: string;
}) {
  return (
    <div
      className={`p-4 text-sm flex flex-col gap-2 rounded-sm border ${
        type === "success"
          ? "bg-primary/5 border-primary/20 text-primary"
          : "bg-error/5 border-error/20 text-error"
      }`}
    >
      <span>{text}</span>
      {hash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 underline font-headline font-bold text-xs uppercase tracking-widest"
        >
          View on Etherscan <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12">
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

function OffersTable({
  offers,
  isLoading,
  isOwner,
  onAccept,
  isAccepting,
}: {
  offers: OfferWithBuyer[];
  isLoading: boolean;
  isOwner: boolean;
  onAccept: (buyer: `0x${string}`) => void;
  isAccepting: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-sm bg-surface-container-high" />
        ))}
      </div>
    );
  }
  if (offers.length === 0) {
    return (
      <p className="text-sm text-center py-4 text-on-surface-variant/40 uppercase tracking-widest text-xs">
        No active offers at the moment.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {offers.map((offer, i) => (
        <div
          key={offer.buyerAddress}
          className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
            i === 0
              ? "border-tertiary/30 bg-tertiary/5"
              : "border-outline-variant/10 bg-surface-container"
          }`}
        >
          <div className="flex items-center gap-3">
            {i === 0 && <TrendingUp size={13} className="text-tertiary" />}
            <div>
              <p className="font-headline font-bold text-sm text-on-surface">
                {formatEther(offer.amount)} ETH
                {i === 0 && (
                  <span className="ml-2 text-xs font-normal text-tertiary">
                    Top offer
                  </span>
                )}
              </p>
              <p className="text-xs text-on-surface-variant font-mono">
                {offer.buyerAddress.slice(0, 6)}...{offer.buyerAddress.slice(-4)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Clock size={11} />
              {new Date(Number(offer.expiresAt) * 1000).toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
              })}
            </div>
            {isOwner && (
              <button
                onClick={() => onAccept(offer.buyerAddress)}
                disabled={isAccepting}
                className={`text-xs font-headline font-bold px-3 py-1.5 flex items-center gap-1 rounded-sm transition-all ${
                  isAccepting
                    ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                    : "bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed"
                }`}
              >
                {isAccepting ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCircle size={11} />
                )}
                Accept
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const tokenId = (Array.isArray(id) ? id[0] : id) ?? "";
  const nftContract = searchParams.get("contract") as `0x${string}`;

  const { address } = useConnection();
  const [nft, setNft] = useState<NFTItem | null>(null);
  const [isLoadingNft, setIsLoadingNft] = useState(true);
  const [listPrice, setListPrice] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showListForm, setShowListForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [txMsg, setTxMsg] = useState<{
    type: "success" | "error";
    text: string;
    hash?: string;
  } | null>(null);

  const { owner, isListed, price, refetch: refetchListing } = useNFTListing(nftContract ?? "", tokenId);
  const { hasActiveOffer, offerAmount: myOfferAmount, expiresAt, refetch: refetchMyOffer } = useMyOffer(nftContract ?? "", tokenId);
  const { offers, isLoading: isLoadingOffers, topOffer, refetch: refetchOffers } = useNFTOffers(nftContract ?? "", tokenId);

  const { listNFT, isPending: isListing } = useListNFT();
  const { buyNFT, isPending: isBuying, isConfirming: isBuyConfirming, isSuccess: isBought, hash: buyHash } = useBuyNFT();
  const { cancelListing, isPending: isCancelling } = useCancelListing();
  const { makeOffer, isPending: isMakingOffer, isConfirming: isOfferConfirming, isSuccess: isOfferMade } = useMakeOffer();
  const { acceptOffer, isPending: isAccepting, isSuccess: isOfferAccepted } = useAcceptOffer();
  const { cancelOffer, isPending: isCancellingOffer, isSuccess: isOfferCancelled } = useCancelOffer();

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  const refetchAll = () => { refetchListing(); refetchMyOffer(); refetchOffers(); };

  useEffect(() => {
    if (!nftContract) { setIsLoadingNft(false); return; }
    const fetchNFT = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${nftContract}&tokenId=${tokenId}&refreshCache=false`,
        );
        const data = await res.json();
        let image = data.image?.cachedUrl ?? data.image?.originalUrl ?? "";
        if (!image && data.tokenUri) {
          const metaRes = await fetch(resolveIpfsUrl(data.tokenUri));
          const meta = await metaRes.json();
          image = resolveIpfsUrl(meta.image ?? "");
        }
        setNft({ tokenId: data.tokenId, name: data.name ?? `NFT #${tokenId}`, description: data.description ?? "", image, nftContract });
      } catch (error) {
        console.error("Error fetching NFT:", error);
      } finally {
        setIsLoadingNft(false);
      }
    };
    fetchNFT();
  }, [tokenId, nftContract]);

  useEffect(() => {
    if (isBought) { setTxMsg({ type: "success", text: "NFT purchased successfully!", hash: buyHash }); refetchAll(); }
  }, [isBought]);
  useEffect(() => {
    if (isOfferMade) { setTxMsg({ type: "success", text: "Offer sent! ETH is held in escrow for 7 days." }); setShowOfferForm(false); setOfferAmount(""); refetchMyOffer(); refetchOffers(); }
  }, [isOfferMade]);
  useEffect(() => {
    if (isOfferCancelled) { setTxMsg({ type: "success", text: "Offer cancelled. ETH returned." }); refetchMyOffer(); refetchOffers(); }
  }, [isOfferCancelled]);
  useEffect(() => {
    if (isOfferAccepted) { setTxMsg({ type: "success", text: "Offer accepted! NFT transferred." }); refetchAll(); }
  }, [isOfferAccepted]);

  const handleList = async () => {
    if (!listPrice || parseFloat(listPrice) < 0.0001) { setTxMsg({ type: "error", text: "Minimum price is 0.0001 ETH." }); return; }
    try { setTxMsg(null); await listNFT(nftContract, tokenId, listPrice); setShowListForm(false); setListPrice(""); setTxMsg({ type: "success", text: "NFT listed successfully!" }); refetchListing(); }
    catch { setTxMsg({ type: "error", text: "Error listing NFT." }); }
  };

  const handleBuy = async () => {
    if (!price) return;
    try { setTxMsg(null); await buyNFT(nftContract, tokenId, price); }
    catch { setTxMsg({ type: "error", text: "Error buying NFT." }); }
  };

  const handleCancelListing = async () => {
    try { setTxMsg(null); await cancelListing(nftContract, tokenId); setTxMsg({ type: "success", text: "Listing cancelled." }); refetchListing(); }
    catch { setTxMsg({ type: "error", text: "Error cancelling listing." }); }
  };

  const handleMakeOffer = async () => {
    if (!offerAmount || parseFloat(offerAmount) < 0.0001) { setTxMsg({ type: "error", text: "Minimum offer is 0.0001 ETH." }); return; }
    try { setTxMsg(null); await makeOffer(nftContract, tokenId, offerAmount); }
    catch { setTxMsg({ type: "error", text: "Error sending offer." }); }
  };

  const handleAcceptOffer = async (buyerAddress: `0x${string}`) => {
    try { setTxMsg(null); await acceptOffer(nftContract, tokenId, buyerAddress); }
    catch { setTxMsg({ type: "error", text: "Error accepting offer." }); }
  };

  const handleCancelOffer = async () => {
    try { setTxMsg(null); await cancelOffer(nftContract, tokenId); }
    catch { setTxMsg({ type: "error", text: "Error cancelling offer." }); }
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
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12">

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
            {owner && (
              <div className="flex items-center gap-2 text-sm bg-surface-container px-3 py-1.5 rounded-sm border border-outline-variant/15">
                <ShieldCheck size={13} className="text-primary" />
                <span className="text-on-surface-variant text-xs uppercase tracking-widest">Owner</span>
                <span className="font-headline font-bold text-sm font-mono text-on-surface">
                  {isOwner ? "You" : `${owner.slice(0, 6)}...${owner.slice(-4)}`}
                </span>
              </div>
            )}
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

          {txMsg && (
            <TxMessage type={txMsg.type} text={txMsg.text} hash={txMsg.hash} />
          )}

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
                    className={`w-full font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${
                      isCancelling
                        ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                        : "bg-error/5 border-error/20 text-error hover:bg-error/10"
                    }`}
                  >
                    {isCancelling ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
                    {isCancelling ? "Cancelling..." : "Cancel Listing"}
                  </button>
                ) : (
                  <div className="relative group overflow-hidden">
                    <button
                      onClick={handleBuy}
                      disabled={isBuying || isBuyConfirming}
                      className={`w-full relative overflow-hidden font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                        isBuying || isBuyConfirming
                          ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                          : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                      }`}
                    >
                      {!(isBuying || isBuyConfirming) && (
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                      )}
                      {isBuying || isBuyConfirming ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                      {isBuying ? "Awaiting wallet..." : isBuyConfirming ? "Confirming..." : "Buy Now"}
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
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        placeholder="Price in ETH (e.g. 0.05)"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleList}
                          disabled={isListing}
                          className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                            isListing
                              ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                              : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110"
                          }`}
                        >
                          {isListing ? <Loader2 className="animate-spin" size={16} /> : <Tag size={16} />}
                          {isListing ? "Approving & Listing..." : "Confirm Listing"}
                        </button>
                        <button
                          onClick={() => setShowListForm(false)}
                          className="px-4 py-3 rounded-sm bg-surface-container border border-outline-variant/15 text-on-surface-variant hover:text-on-surface transition-all"
                        >
                          <X size={16} />
                        </button>
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
                      <Clock size={11} />
                      Expires:{" "}
                      {expiresAt.toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  <button
                    onClick={handleCancelOffer}
                    disabled={isCancellingOffer}
                    className={`w-full font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${
                      isCancellingOffer
                        ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                        : "bg-error/5 border-error/20 text-error hover:bg-error/10"
                    }`}
                  >
                    {isCancellingOffer ? <Loader2 className="animate-spin" size={16} /> : <X size={16} />}
                    {isCancellingOffer ? "Cancelling..." : "Cancel Offer & Reclaim ETH"}
                  </button>
                </div>
              ) : showOfferForm ? (
                <div className="space-y-3">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="Amount in ETH (e.g. 0.08)"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest">
                    ETH will be held in escrow for 7 days.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleMakeOffer}
                      disabled={isMakingOffer || isOfferConfirming}
                      className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                        isMakingOffer || isOfferConfirming
                          ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                          : "bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20"
                      }`}
                    >
                      {isMakingOffer || isOfferConfirming ? <Loader2 className="animate-spin" size={16} /> : <HandCoins size={16} />}
                      {isMakingOffer ? "Awaiting wallet..." : isOfferConfirming ? "Confirming..." : "Send Offer"}
                    </button>
                    <button
                      onClick={() => setShowOfferForm(false)}
                      className="px-4 py-3 rounded-sm bg-surface-container border border-outline-variant/15 text-on-surface-variant hover:text-on-surface transition-all"
                    >
                      <X size={16} />
                    </button>
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
