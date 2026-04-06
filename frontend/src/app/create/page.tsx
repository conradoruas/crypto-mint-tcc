"use client";

import { useState, useEffect, useRef } from "react";
import {
  useConnection,
  useReadContracts,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEventLogs, formatEther } from "viem";
import { Navbar } from "@/components/navbar";
import { WalletGuard } from "@/components/WalletGuard";
import {
  Loader2,
  Plus,
  Layers,
  ShieldCheck,
  Sparkles,
  Shuffle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useCollections, useMintToCollection } from "@/hooks/collections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { formatTransactionError } from "@/lib/txErrors";

function CollectionOption({
  collection,
  selected,
  onSelect,
}: {
  collection: {
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    mintPrice: bigint;
    maxSupply: bigint;
    totalSupply?: bigint;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const image = resolveIpfsUrl(collection.image);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 flex items-center gap-4 transition-all border rounded-sm cursor-pointer ${
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container"
      }`}
    >
      <div className="w-14 h-14 overflow-hidden shrink-0 relative border border-outline-variant/20 rounded-sm">
        {image ? (
          <Image
            src={image}
            alt={collection.name}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="w-full h-full bg-surface-container-high" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-headline font-bold truncate text-on-surface">
            {collection.name}
          </p>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest shrink-0">
            {collection.symbol}
          </span>
        </div>
        <p className="font-headline text-sm font-bold text-primary">
          {formatEther(collection.mintPrice)} ETH
        </p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {collection.totalSupply?.toString() ?? "?"} /{" "}
          {collection.maxSupply.toString()} minted
        </p>
      </div>
      {selected && <ShieldCheck size={16} className="text-primary shrink-0" />}
    </button>
  );
}

type MintedNft = { name: string; image: string; tokenId: string };

export default function MintPage() {
  const { address, isConnected } = useConnection();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mintedNft, setMintedNft] = useState<MintedNft | null>(null);
  const [isFetchingNft, setIsFetchingNft] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [soldOutAddresses, setSoldOutAddresses] = useState<Set<string>>(
    new Set(),
  );
  const mintingCollectionRef = useRef<{
    contractAddress: string;
    totalSupply?: bigint;
    maxSupply: bigint;
  } | null>(null);

  const { mint, isPending, isConfirming, hash } = useMintToCollection();

  // Batch-read urisLoaded for all collections to filter mintable ones
  const { data: urisLoadedData, isLoading: isLoadingUris } = useReadContracts({
    contracts: collections.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: NFT_COLLECTION_ABI,
      functionName: "urisLoaded",
    })),
    query: { enabled: collections.length > 0 },
  });

  const mintableCollections = collections.filter((c, i) => {
    const urisLoaded = urisLoadedData?.[i]?.result as boolean | undefined;
    const isSoldOut =
      c.totalSupply !== undefined && c.totalSupply >= c.maxSupply;
    return (
      urisLoaded === true &&
      !isSoldOut &&
      !soldOutAddresses.has(c.contractAddress)
    );
  });

  // Get receipt to parse the minted tokenId from NFTMinted event
  const { data: receipt } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  useEffect(() => {
    if (!receipt || !selectedCollection) return;

    let cancelled = false;
    const mintedCollection = mintingCollectionRef.current;

    const run = async () => {
      setIsFetchingNft(true);
      setShowSuccess(true);
      try {
        const logs = parseEventLogs({
          abi: NFT_COLLECTION_ABI,
          eventName: "NFTMinted",
          logs: receipt.logs,
        });
        const tokenId = (
          logs[0]?.args as { tokenId?: bigint } | undefined
        )?.tokenId?.toString();
        if (!tokenId || cancelled) return;

        const r = await fetch(
          `/api/alchemy/getNFTMetadata?contractAddress=${selectedCollection}&tokenId=${tokenId}&refreshCache=false`,
        );
        const data = await r.json();
        if (cancelled) return;

        const image = resolveIpfsUrl(
          data.image?.cachedUrl ?? data.image?.originalUrl ?? "",
        );
        setMintedNft({ name: data.name ?? `NFT #${tokenId}`, image, tokenId });

        // Optimistically remove from list if this mint exhausted the supply
        if (mintedCollection) {
          const newSupply =
            (mintedCollection.totalSupply ?? BigInt(0)) + BigInt(1);
          if (newSupply >= mintedCollection.maxSupply) {
            setSoldOutAddresses(
              (prev) => new Set([...prev, mintedCollection.contractAddress]),
            );
            setSelectedCollection("");
          }
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setIsFetchingNft(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [receipt, selectedCollection]);

  const chosen = mintableCollections.find(
    (c) => c.contractAddress === selectedCollection,
  );

  const handleMint = async () => {
    setError(null);
    setMintedNft(null);
    setShowSuccess(false);
    if (!address || !selectedCollection || !chosen) {
      setError("Select a collection and connect your wallet.");
      return;
    }
    mintingCollectionRef.current = chosen;
    try {
      await mint(
        selectedCollection as `0x${string}`,
        formatEther(chosen.mintPrice),
        address,
      );
    } catch (e) {
      setError(formatTransactionError(e, "Could not mint. Try again."));
    }
  };

  const isLoadingList = isLoadingCollections || isLoadingUris;
  const busy = isPending || isConfirming || isFetchingNft;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <WalletGuard message="Connect your wallet to mint your synthetic assets.">
        <div className="pt-32 pb-20 max-w-[1920px] mx-auto px-8">
        {/* Page Header */}
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase">
              Synthetic Foundry · Sepolia
            </span>
          </div>
          <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tighter text-on-surface mb-4 leading-none uppercase">
            <span className="text-primary italic"> Mint New Asset</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-lg font-light leading-relaxed">
            Choose a collection and receive a{" "}
            <strong className="text-on-surface font-semibold">
              random NFT
            </strong>{" "}
            from those available.
          </p>
        </header>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left — Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Collection Selector */}
            <div className="bg-surface-container-low border border-outline-variant/10 p-8">
              <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3 mb-6">
                <Layers size={18} className="text-primary" />
                Select Collection
              </h2>

              {isLoadingList ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-sm bg-surface-container-high border border-outline-variant/5"
                    />
                  ))}
                </div>
              ) : mintableCollections.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-outline-variant/20 rounded-sm">
                  <Layers
                    size={32}
                    className="mx-auto mb-4 text-on-surface-variant/30"
                  />
                  <p className="text-sm text-on-surface-variant mb-4">
                    No collections available for minting.
                  </p>
                  <Link
                    href="/collections/create"
                    className="inline-flex items-center gap-2 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
                  >
                    <Plus size={13} /> Create Collection
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {mintableCollections.map((c) => (
                    <CollectionOption
                      key={c.contractAddress}
                      collection={c}
                      selected={selectedCollection === c.contractAddress}
                      onSelect={() => {
                        setSelectedCollection(c.contractAddress);
                        setMintedNft(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {chosen && (
              <div className="bg-surface-container-low border border-outline-variant/10 p-8">
                <h2 className="font-headline text-lg font-bold uppercase tracking-tight mb-6">
                  Order Summary
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm border-b border-outline-variant/10 pb-4">
                    <span className="text-on-surface-variant uppercase tracking-widest text-xs">
                      Collection
                    </span>
                    <span className="font-headline font-bold">
                      {chosen.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-outline-variant/10 pb-4">
                    <span className="text-on-surface-variant uppercase tracking-widest text-xs">
                      NFT Received
                    </span>
                    <span className="text-on-surface-variant flex items-center gap-2 text-xs">
                      <Shuffle size={12} /> Random
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="font-headline font-bold uppercase tracking-widest text-sm">
                      Total
                    </span>
                    <span className="font-headline text-xl font-bold text-primary">
                      {formatEther(chosen.mintPrice)} ETH
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Success banner */}
            {showSuccess && hash && (
              <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20">
                <CheckCircle2 size={20} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-headline font-bold text-sm text-on-surface">
                    NFT Minted Successfully!
                  </p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    View on Etherscan <ExternalLink size={10} />
                  </a>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/profile"
                    className="font-headline font-bold px-4 py-2 text-xs rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm p-4 bg-error/5 border border-error/20 text-error rounded-sm">
                {error}
              </div>
            )}

            {/* CTA Button */}
            {
              <div className="relative group overflow-hidden">
                <button
                  onClick={handleMint}
                  disabled={busy || !isConnected || !selectedCollection}
                  className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
                    busy || !isConnected || !selectedCollection
                      ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                  }`}
                >
                  {!busy && isConnected && selectedCollection && (
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  )}
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      {isPending
                        ? "Awaiting Wallet..."
                        : isConfirming
                          ? "Confirming..."
                          : "Loading NFT..."}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {chosen
                        ? `Mint Random NFT — ${formatEther(chosen.mintPrice)} ETH`
                        : "Mint NFT"}
                    </>
                  )}
                </button>
              </div>
            }

            {!isConnected && (
              <p className="text-center text-sm text-on-surface-variant/50 uppercase tracking-widest">
                Connect your wallet to mint
              </p>
            )}
          </div>

          {/* Right — Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
            <div className="bg-surface-container-low border border-outline-variant/10">
              <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                <h3 className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  Live Preview
                </h3>
                {mintedNft && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest">
                    <CheckCircle2 size={12} /> Minted
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="relative aspect-square bg-surface-container-high overflow-hidden rounded-sm">
                  {isFetchingNft ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2
                        size={32}
                        className="animate-spin text-primary/40"
                      />
                    </div>
                  ) : mintedNft ? (
                    <>
                      {mintedNft.image ? (
                        <Image
                          src={mintedNft.image}
                          alt={mintedNft.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 40vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles
                            size={40}
                            className="text-on-surface-variant/20"
                          />
                        </div>
                      )}
                      <div className="absolute top-4 left-4 glass-panel px-3 py-1.5 border border-primary/30 text-[10px] font-headline font-bold uppercase tracking-widest text-primary">
                        #{mintedNft.tokenId.padStart(3, "0")}
                      </div>
                    </>
                  ) : chosen && resolveIpfsUrl(chosen.image) ? (
                    <>
                      <Image
                        src={resolveIpfsUrl(chosen.image)}
                        alt={chosen.name}
                        fill
                        className="object-cover grayscale"
                        sizes="(max-width: 1024px) 100vw, 40vw"
                      />
                      <div className="absolute top-4 left-4 glass-panel px-3 py-1.5 border border-outline-variant/20 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
                        #???
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles
                          size={40}
                          className="mx-auto mb-3 text-on-surface-variant/20"
                        />
                        <p className="text-xs text-on-surface-variant/30 uppercase tracking-widest">
                          Select a collection
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 pt-3">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    {mintedNft
                      ? (chosen?.symbol ?? "NFT")
                      : (chosen?.symbol ?? "COLLECTION")}
                  </p>
                  <h4 className="font-headline text-lg font-bold text-on-surface">
                    {mintedNft
                      ? mintedNft.name
                      : chosen
                        ? `${chosen.name} · Random`
                        : "Unknown Asset"}
                  </h4>
                </div>
              </div>
            </div>

            {/* Creator Insight */}
            <div className="glass-panel border-l-2 border-primary/40 border border-outline-variant/10 p-6">
              <p className="text-[10px] font-headline font-bold text-primary uppercase tracking-[0.2em] mb-2">
                Creator Insight
              </p>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                NFTs are distributed via a{" "}
                <span className="text-on-surface font-medium">
                  Fisher-Yates shuffle
                </span>{" "}
                on-chain, guaranteeing fair and verifiable randomness for every
                mint.
              </p>
            </div>
          </div>
        </div>
        <Footer />
        </div>
      </WalletGuard>
    </main>
  );
}
