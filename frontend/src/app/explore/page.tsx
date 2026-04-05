"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections } from "@/hooks/useCollections";
import { useExploreAllNFTs } from "@/hooks/useExploreNfts";
import type { NFTItemWithMarket } from "@/types/nft";
import Link from "next/link";
import { Search, SlidersHorizontal, X, Layers, Heart } from "lucide-react";
import { useState, useMemo, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import { useConnection } from "wagmi";
import { useUserFavorites } from "@/hooks/useFavorites";
import { NFTCard } from "@/components/NFTCard";
import { Pagination } from "@/components/Pagination";
import { FilterSidebar, type SortOption } from "@/components/FilterSidebar";







const PAGE_SIZE = 8;

function ExploreContent() {
  const searchParams = useSearchParams();
  const { address } = useConnection();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>("default");
  const [onlyListed, setOnlyListed] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(1);

  // Only favorites remain client-side (impacts pagination logic).
  const hasClientFilters = onlyFavorites;

  // Any filter or sort active (impacts UI elements like "Clear Filters").
  const hasActiveFilters =
    search !== "" || sort !== "default" || onlyListed || onlyFavorites || selectedCollection !== "";

  const {
    nfts,
    isLoading: isLoadingNFTs,
    hasMore,
    refetch: refetchExploreNfts,
  } = useExploreAllNFTs(
    selectedCollection || undefined,
    page,
    PAGE_SIZE,
    onlyListed,
    search,
    sort,
  );

  const { favorites } = useUserFavorites(address);
  const favoriteSet = useMemo(
    () =>
      new Set(
        favorites.map((f) => `${f.nftContract.toLowerCase()}-${f.tokenId}`),
      ),
    [favorites],
  );
  const isLoading = isLoadingCollections || isLoadingNFTs;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetchExploreNfts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refetchExploreNfts]);

  const isFavoritesEmpty = onlyFavorites && favoriteSet.size === 0;

  // now handled server-side.
  const displayedNFTs = useMemo(() => {
    // Only favorites filter remains client-side because it depends on local state/address
    if (onlyFavorites) {
      return nfts.filter((nft) => {
        const key = `${nft.nftContract.toLowerCase()}-${nft.tokenId}`;
        return favoriteSet.has(key);
      });
    }
    return nfts;
  }, [nfts, onlyFavorites, favoriteSet]);

  const totalFilteredPages = undefined;

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
        <FilterSidebar
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          onlyListed={onlyListed}
          setOnlyListed={setOnlyListed}
          onlyFavorites={onlyFavorites}
          setOnlyFavorites={setOnlyFavorites}
          setPage={setPage}
          sort={sort}
          setSort={setSort}
          isLoadingCollections={isLoadingCollections}
          collections={collections}
          selectedCollection={selectedCollection}
          setSelectedCollection={setSelectedCollection}
        />

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
              <p className="text-on-surface-variant/80 max-w-xl text-xs mt-3 leading-relaxed">
                Prices and offers on this grid come from the subgraph indexer
                and can lag the chain by a few blocks. Open an asset to confirm
                the listing price and escrow before you spend — metadata comes
                from Alchemy.
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
          ) : isFavoritesEmpty ? (
            <div className="text-center py-20 border border-dashed border-outline-variant/20">
              <Heart size={40} className="mx-auto mb-4 text-error/70" />
              <h3 className="font-headline text-lg font-bold mb-2">
                No favorites yet
              </h3>
              <p className="mb-6 text-sm text-on-surface-variant">
                Favorite an item by clicking the heart to see it here.
              </p>
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
              {displayedNFTs.map((nft, i) => (
                <NFTCard
                  key={`${nft.nftContract}-${nft.tokenId}`}
                  nft={nft}
                  userAddress={address}
                  priority={i < 8}
                />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            setPage={setPage}
            hasActiveFilters={hasClientFilters}
            totalFilteredPages={totalFilteredPages}
            hasMore={hasMore}
          />
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
