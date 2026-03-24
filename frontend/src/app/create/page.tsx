"use client";

import { useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  Loader2,
  Plus,
  Layers,
  ShieldCheck,
  Sparkles,
  Shuffle,
} from "lucide-react";
import { useCollections, useMintToCollection } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { formatEther } from "viem";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

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
  const { data: urisLoaded } = useReadContract({
    address: collection.contractAddress as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "urisLoaded",
  });

  const isSoldOut =
    collection.totalSupply !== undefined &&
    collection.totalSupply >= collection.maxSupply;
  const unavailable = isSoldOut || !urisLoaded;
  const image = resolveIpfsUrl(collection.image);

  return (
    <button
      onClick={onSelect}
      disabled={unavailable}
      className={`w-full text-left p-4 flex items-center gap-4 transition-all border rounded-sm ${
        selected
          ? "border-primary/40 bg-primary/5"
          : unavailable
            ? "border-outline-variant/10 bg-surface-container-lowest opacity-50 cursor-not-allowed"
            : "border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container cursor-pointer"
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
          {isSoldOut && <span className="ml-1 text-error"> · Sold Out</span>}
          {!urisLoaded && !isSoldOut && (
            <span className="ml-1 text-secondary"> · Unavailable</span>
          )}
        </p>
      </div>
      {selected && <ShieldCheck size={16} className="text-primary shrink-0" />}
    </button>
  );
}

export default function MintPage() {
  const { address, isConnected } = useConnection();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState("");
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mint, isPending, isConfirming, isSuccess, hash } =
    useMintToCollection();

  const chosen = collections.find(
    (c) => c.contractAddress === selectedCollection,
  );
  if (isSuccess && hash && !mintSuccess) setMintSuccess(hash);

  const handleMint = async () => {
    setError(null);
    if (!address || !selectedCollection || !chosen) {
      setError("Select a collection and connect your wallet.");
      return;
    }
    try {
      await mint(
        selectedCollection as `0x${string}`,
        formatEther(chosen.mintPrice),
        address,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    }
  };

  if (mintSuccess) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <div className="max-w-lg mx-auto px-8 py-32 text-center">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-primary/5 border border-primary/20 rounded-sm">
            <ShieldCheck size={36} className="text-primary" />
          </div>
          <span className="text-xs font-headline font-bold tracking-[0.3em] text-primary uppercase block mb-3">
            Transaction Confirmed
          </span>
          <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
            NFT Minted!
          </h1>
          <p className="mb-6 text-sm text-on-surface-variant">
            Your random NFT was successfully minted.
          </p>
          <a
            href={`https://sepolia.etherscan.io/tx/${mintSuccess}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-8 text-sm text-primary hover:text-primary-container transition-colors font-mono underline"
          >
            View on Etherscan
          </a>
          <div className="flex gap-4 justify-center">
            <Link
              href="/profile"
              className="font-headline font-bold px-6 py-3 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed text-sm uppercase tracking-wider transition-all hover:brightness-110"
            >
              View Profile
            </Link>
            <button
              onClick={() => {
                setMintSuccess(null);
                setSelectedCollection("");
              }}
              className="font-headline font-bold px-6 py-3 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-all text-sm uppercase tracking-wider"
            >
              Mint Another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
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

              {isLoadingCollections ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-sm bg-surface-container-high border border-outline-variant/5"
                    />
                  ))}
                </div>
              ) : collections.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-outline-variant/20 rounded-sm">
                  <Layers
                    size={32}
                    className="mx-auto mb-4 text-on-surface-variant/30"
                  />
                  <p className="text-sm text-on-surface-variant mb-4">
                    No collections available.
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
                  {collections.map((c) => (
                    <CollectionOption
                      key={c.contractAddress}
                      collection={c}
                      selected={selectedCollection === c.contractAddress}
                      onSelect={() => setSelectedCollection(c.contractAddress)}
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

            {/* Error */}
            {error && (
              <div className="text-sm p-4 bg-error/5 border border-error/20 text-error rounded-sm">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <div className="relative group overflow-hidden">
              <button
                onClick={handleMint}
                disabled={
                  isPending ||
                  isConfirming ||
                  !isConnected ||
                  !selectedCollection
                }
                className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
                  isPending ||
                  isConfirming ||
                  !isConnected ||
                  !selectedCollection
                    ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                }`}
              >
                {/* Shimmer sweep */}
                {!isPending &&
                  !isConfirming &&
                  isConnected &&
                  selectedCollection && (
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  )}
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {isPending ? "Awaiting Wallet..." : "Confirming..."}
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

            {!isConnected && (
              <p className="text-center text-sm text-on-surface-variant/50 uppercase tracking-widest">
                Connect your wallet to mint
              </p>
            )}
          </div>

          {/* Right — Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
            {/* NFT Preview Card */}
            <div className="bg-surface-container-low border border-outline-variant/10">
              <div className="px-6 pt-6 pb-2">
                <h3 className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  Live Preview
                </h3>
              </div>
              <div className="p-4">
                <div className="relative aspect-square bg-surface-container-high overflow-hidden rounded-sm">
                  {chosen && resolveIpfsUrl(chosen.image) ? (
                    <Image
                      src={resolveIpfsUrl(chosen.image)}
                      alt={chosen.name}
                      fill
                      className="object-cover grayscale"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
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
                  <div className="absolute top-4 left-4 glass-panel px-3 py-1.5 border border-outline-variant/20 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
                    #???
                  </div>
                </div>
                <div className="p-4 pt-3">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    {chosen?.symbol ?? "COLLECTION"}
                  </p>
                  <h4 className="font-headline text-lg font-bold text-on-surface">
                    {chosen ? `${chosen.name} · Random` : "Unknown Asset"}
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
    </main>
  );
}
