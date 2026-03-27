"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections } from "@/hooks/useCollections";
import { useExploreAllNFTs } from "@/hooks/useExploreNfts";
import type { NFTItemWithMarket } from "@/types/nft";
import Image from "next/image";
import Link from "next/link";
import { Search, SlidersHorizontal, X, Layers, Heart, Tag } from "lucide-react";
import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import { useConnection } from "wagmi";
import { useIsFavorited, useFavorite } from "@/hooks/useFavorites";

type SortOption =
  | "default"
  | "price_asc"
  | "price_desc"
  | "offer_desc"
  | "listed_first"
  | "id_asc"
  | "id_desc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Default",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  offer_desc: "Top Offer",
  listed_first: "Listed First",
  id_asc: "ID Ascending",
  id_desc: "ID Descending",
};

function filterNFTs(
  nfts: NFTItemWithMarket[],
  search: string,
  onlyListed: boolean,
): NFTItemWithMarket[] {
  return nfts.filter((nft) => {
    const matchSearch =
      search.trim() === "" ||
      nft.name.toLowerCase().includes(search.toLowerCase()) ||
      nft.tokenId.includes(search.trim());
    const matchListed = !onlyListed || !!nft.listingPrice;
    return matchSearch && matchListed;
  });
}

function sortNFTs(
  nfts: NFTItemWithMarket[],
  sort: SortOption,
): NFTItemWithMarket[] {
  const sorted = [...nfts];
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => {
        if (!a.listingPrice && !b.listingPrice) return 0;
        if (!a.listingPrice) return 1;
        if (!b.listingPrice) return -1;
        return parseFloat(a.listingPrice) - parseFloat(b.listingPrice);
      });
    case "price_desc":
      return sorted.sort((a, b) => {
        if (!a.listingPrice && !b.listingPrice) return 0;
        if (!a.listingPrice) return 1;
        if (!b.listingPrice) return -1;
        return parseFloat(b.listingPrice) - parseFloat(a.listingPrice);
      });
    case "offer_desc":
      return sorted.sort((a, b) => {
        if (!a.topOffer && !b.topOffer) return 0;
        if (!a.topOffer) return 1;
        if (!b.topOffer) return -1;
        return parseFloat(b.topOffer) - parseFloat(a.topOffer);
      });
    case "listed_first":
      return sorted.sort((a, b) => {
        if (!!a.listingPrice === !!b.listingPrice) return 0;
        return a.listingPrice ? -1 : 1;
      });
    case "id_asc":
      return sorted.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
    case "id_desc":
      return sorted.sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));
    default:
      return sorted;
  }
}

// ─── NFT Card ────────────────────────────────────────────────────────────────

function NFTCard({
  nft,
  userAddress,
}: {
  nft: NFTItemWithMarket;
  userAddress?: string;
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
              loading="eager"
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

// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function ExploreContent() {
  const searchParams = useSearchParams();
  const { address } = useConnection();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>("default");
  const [onlyListed, setOnlyListed] = useState(false);
  const [page, setPage] = useState(1);

  const hasActiveFilters = search !== "" || sort !== "default" || onlyListed;

  // When filters are active, fetch all NFTs so client-side filtering spans every page.
  // When no filters, use normal server-side pagination.
  const fetchPage = hasActiveFilters ? 1 : page;
  // The Graph caps `first` at 1000; the hook adds +1 internally, so max fetchSize is 999.
  const fetchSize = hasActiveFilters ? 999 : PAGE_SIZE;

  const {
    nfts,
    isLoading: isLoadingNFTs,
    hasMore,
  } = useExploreAllNFTs(selectedCollection || undefined, fetchPage, fetchSize);
  const isLoading = isLoadingCollections || isLoadingNFTs;

  const allFilteredNFTs = useMemo(() => {
    const filtered = filterNFTs(nfts, search, onlyListed);
    return sortNFTs(filtered, sort);
  }, [nfts, search, onlyListed, sort]);

  // Client-side pagination of filtered results (only when filters are active).
  const totalFilteredPages = hasActiveFilters
    ? Math.ceil(allFilteredNFTs.length / PAGE_SIZE)
    : undefined;
  const displayedNFTs = hasActiveFilters
    ? allFilteredNFTs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : allFilteredNFTs;

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setOnlyListed(false);
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <div className="pt-24 min-h-screen flex max-w-[1920px] mx-auto">
        {/* Left Sidebar */}
        <aside className="w-72 fixed h-[calc(100vh-6rem)] overflow-y-auto px-8 hidden xl:block no-scrollbar top-24">
          <div className="space-y-10 pt-4">
            <header className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold tracking-tight uppercase">
                Filters
              </h2>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest"
                >
                  Reset
                </button>
              )}
            </header>

            {/* Status filter */}
            <section className="space-y-4">
              <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                Status
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setOnlyListed(false);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    !onlyListed
                      ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                      : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setOnlyListed(true);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    onlyListed
                      ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                      : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
                  }`}
                >
                  Buy Now
                </button>
              </div>
            </section>

            {/* Sort */}
            <section className="space-y-4">
              <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                Sort By
              </h3>
              <div className="space-y-2">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSort(key);
                      setPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-sm text-sm transition-all ${
                      sort === key
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>
            </section>

            {/* Collections */}
            {!isLoadingCollections && collections.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Collections
                </h3>
                <div className="space-y-2">
                  {[{ contractAddress: "", name: "All" }, ...collections].map(
                    (c) => (
                      <label
                        key={c.contractAddress}
                        className="flex items-center space-x-3 cursor-pointer group"
                      >
                        <input
                          type="radio"
                          name="collection"
                          checked={selectedCollection === c.contractAddress}
                          onChange={() => {
                            setSelectedCollection(c.contractAddress);
                            setPage(1);
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                          {c.name}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 px-8 xl:ml-72 pb-20">
          {/* Header */}
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
            <div>
              <h1 className="font-headline text-5xl font-black tracking-tighter uppercase mb-2">
                Marketplace <span className="text-primary italic">Explore</span>
              </h1>
              <p className="text-on-surface-variant max-w-lg font-light">
                Browse NFTs across all collections on the Sepolia testnet.
              </p>
            </div>
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or ID..."
                className="bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-3 pl-12 pr-4 w-72 focus:outline-none focus:border-primary transition-all text-sm text-on-surface placeholder:text-on-surface-variant/50"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile filters */}
          <div className="flex xl:hidden gap-2 mb-6 flex-wrap">
            <button
              onClick={() => {
                setOnlyListed((v) => !v);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                onlyListed
                  ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                  : "bg-surface-container text-on-surface-variant border-outline-variant/15"
              }`}
            >
              <SlidersHorizontal size={12} className="inline mr-1" />
              Buy Now Only
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-full text-xs font-bold border border-error/30 text-error bg-error/5 transition-all flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* NFT Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="bg-surface-container-low rounded-sm overflow-hidden border border-outline-variant/5"
                >
                  <div className="aspect-square animate-pulse bg-surface-container-high" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 rounded-sm animate-pulse w-1/2 bg-surface-container-high" />
                    <div className="h-4 rounded-sm animate-pulse w-3/4 bg-surface-container-high" />
                    <div className="h-3 rounded-sm animate-pulse w-full bg-surface-container-high mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-outline-variant/20">
              <Layers
                size={48}
                className="mx-auto mb-4 text-on-surface-variant/30"
              />
              <h2 className="font-headline text-xl font-bold mb-2">
                No collections yet
              </h2>
              <p className="mb-6 text-sm text-on-surface-variant">
                Create a collection to start minting NFTs.
              </p>
              <Link
                href="/collections/create"
                className="inline-flex items-center gap-2 font-headline font-bold px-6 py-3 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed text-sm uppercase tracking-wider"
              >
                Create Collection
              </Link>
            </div>
          ) : nfts.length === 0 ? (
            <div className="text-center py-20">
              <p className="mb-4 text-sm text-on-surface-variant">
                No NFTs minted in this collection yet.
              </p>
              <Link
                href={`/collections/${selectedCollection}`}
                className="inline-flex items-center gap-2 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
              >
                Mint in Collection
              </Link>
            </div>
          ) : displayedNFTs.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-outline-variant/20">
              <Search
                size={40}
                className="mx-auto mb-4 text-on-surface-variant/30"
              />
              <h3 className="font-headline text-lg font-bold mb-2">
                No results found
              </h3>
              <p className="mb-6 text-sm text-on-surface-variant">
                Try adjusting your search or filters.
              </p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 font-medium px-5 py-2.5 text-sm rounded-sm bg-surface-container border border-outline-variant/15 text-on-surface"
              >
                <X size={14} /> Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {displayedNFTs.map((nft) => (
                <NFTCard
                  key={`${nft.nftContract}-${nft.tokenId}`}
                  nft={nft}
                  userAddress={address}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(page > 1 || (hasActiveFilters ? (totalFilteredPages ?? 1) > 1 : hasMore)) && (
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-outline-variant/10">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest">
                Page {page}{totalFilteredPages ? ` / ${totalFilteredPages}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={hasActiveFilters ? page >= (totalFilteredPages ?? 1) : !hasMore}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  );
}
