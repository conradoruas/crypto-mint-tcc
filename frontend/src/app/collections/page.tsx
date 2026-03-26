"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections, CollectionInfo } from "@/hooks/useCollections";
import Image from "next/image";
import Link from "next/link";
import { formatEther } from "viem";
import { Plus, Image as ImageIcon } from "lucide-react";
import { useState, useMemo } from "react";
import Footer from "@/components/Footer";
import { useQuery } from "@apollo/client/react";
import { GET_TRENDING_COLLECTIONS, GET_TRENDING_DATA } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

function CollectionCard({ collection }: { collection: CollectionInfo }) {
  const image = resolveIpfsUrl(collection.image);
  const mintPriceEth = formatEther(collection.mintPrice);

  return (
    <Link
      href={`/collections/${collection.contractAddress}`}
      className="group bg-surface-container-low transition-all duration-300 hover:bg-surface-container border-b-2 border-transparent hover:border-primary/30 overflow-hidden"
    >
      {/* Cover image */}
      <div className="aspect-video overflow-hidden relative bg-surface-container-high">
        {image ? (
          <Image
            src={image}
            alt={collection.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={40} className="text-on-surface-variant/30" />
          </div>
        )}
        {/* Supply badge */}
        <div className="absolute top-4 right-4 glass-panel px-3 py-1 border border-outline-variant/20 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
          {collection.maxSupply.toString()} max
        </div>
      </div>

      {/* Info */}
      <div className="p-6 relative">
        {/* Avatar overlay */}
        <div className="-mt-10 mb-4 relative z-10">
          <div className="w-16 h-16 rounded-sm border-4 border-surface-container-low overflow-hidden bg-surface-container-high relative">
            {image ? (
              <Image
                src={image}
                alt={collection.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="w-full h-full bg-surface-container-highest" />
            )}
          </div>
        </div>

        <h3 className="font-headline text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">
          {collection.name}
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
            {collection.symbol}
          </span>
          <span className="text-[10px] text-on-surface-variant/30">·</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
            {collection.creator.slice(0, 6)}...{collection.creator.slice(-4)}
          </span>
        </div>

        {collection.description && (
          <p className="text-sm text-on-surface-variant line-clamp-2 mb-4">
            {collection.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
          <div>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">
              Mint Price
            </p>
            <p className="font-headline text-lg font-medium text-primary">
              {mintPriceEth} ETH
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">
              Created
            </p>
            <p className="font-headline text-sm font-medium">
              {new Date(Number(collection.createdAt) * 1000).toLocaleDateString(
                "pt-BR",
              )}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-low overflow-hidden">
      <div className="aspect-video animate-pulse bg-surface-container-high" />
      <div className="p-6 space-y-3">
        <div className="h-16 w-16 rounded-sm animate-pulse bg-surface-container-high -mt-8 mb-2" />
        <div className="h-5 rounded-sm animate-pulse w-2/3 bg-surface-container-high" />
        <div className="h-3 rounded-sm animate-pulse w-full bg-surface-container-high" />
        <div className="h-3 rounded-sm animate-pulse w-4/5 bg-surface-container-high" />
      </div>
    </div>
  );
}

type FilterOption = "Trending" | "Top" | "Recent";

type GqlCollectionStats = {
  id: string;
  contractAddress: string;
  stats?: { totalVolume: string; totalSales: string } | null;
};
type GqlTrendingCollectionsData = { collections: GqlCollectionStats[] };

function sortCollections(
  collections: CollectionInfo[],
  filter: FilterOption,
  volume24hMap: Map<string, bigint>,
  totalVolumeMap: Map<string, bigint>,
): CollectionInfo[] {
  const sorted = [...collections];
  switch (filter) {
    case "Trending":
      return sorted.sort((a, b) => {
        const va = volume24hMap.get(a.contractAddress.toLowerCase()) ?? BigInt(0);
        const vb = volume24hMap.get(b.contractAddress.toLowerCase()) ?? BigInt(0);
        return vb > va ? 1 : vb < va ? -1 : 0;
      });
    case "Top":
      return sorted.sort((a, b) => {
        const va = totalVolumeMap.get(a.contractAddress.toLowerCase()) ?? BigInt(0);
        const vb = totalVolumeMap.get(b.contractAddress.toLowerCase()) ?? BigInt(0);
        return vb > va ? 1 : vb < va ? -1 : 0;
      });
    case "Recent":
      return sorted.sort((a, b) =>
        b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0,
      );
  }
}

type GqlSaleEvent = { nftContract: string; price: string; timestamp: string };
type GqlTrendingData = { activityEvents: GqlSaleEvent[] };

export default function CollectionsPage() {
  const { collections, isLoading } = useCollections();
  const [filter, setFilter] = useState<FilterOption>("Trending");
  const [search, setSearch] = useState("");

  const trendingVars = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return { sevenDaysAgo: (now - 7 * 86400).toString(), now: now.toString() };
  }, []);

  const { data: trendingData } = useQuery<GqlTrendingData>(GET_TRENDING_DATA, {
    skip: !SUBGRAPH_ENABLED,
    variables: trendingVars,
  });

  const { data: statsData } = useQuery<GqlTrendingCollectionsData>(
    GET_TRENDING_COLLECTIONS,
    { skip: !SUBGRAPH_ENABLED },
  );

  const volume24hMap = useMemo(() => {
    const map = new Map<string, bigint>();
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    for (const ev of trendingData?.activityEvents ?? []) {
      if (Number(ev.timestamp) <= oneDayAgo) continue;
      const addr = ev.nftContract.toLowerCase();
      map.set(addr, (map.get(addr) ?? BigInt(0)) + BigInt(ev.price ?? "0"));
    }
    return map;
  }, [trendingData]);

  const totalVolumeMap = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const col of statsData?.collections ?? []) {
      if (col.stats?.totalVolume) {
        map.set(col.contractAddress.toLowerCase(), BigInt(col.stats.totalVolume));
      }
    }
    return map;
  }, [statsData]);

  const filtered = sortCollections(
    collections.filter(
      (c) =>
        search.trim() === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase()),
    ),
    filter,
    volume24hMap,
    totalVolumeMap,
  );

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1920px] mx-auto px-8">
        {/* Hero header */}
        <section className="mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tighter text-on-surface mb-6 leading-none uppercase">
                Every <span className="text-primary italic">COLLECTION</span>
              </h1>
              <p className="text-on-surface-variant text-lg max-w-lg font-light leading-relaxed">
                Every collection is a verified and deployed on the Sepolia
                testnet.
              </p>
            </div>

            {/* Search */}
            <div className="w-full md:w-96">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search collections..."
                  className="w-full bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-4 pl-12 pr-4 text-on-surface focus:outline-none focus:border-primary transition-all tracking-wide placeholder:text-on-surface-variant/50"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Filters + stats bar */}
        <section className="mb-12 flex flex-wrap items-center gap-4">
          <div className="flex bg-surface-container-low p-1 rounded-sm border border-outline-variant/10">
            {(["Trending", "Top", "Recent"] as FilterOption[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 text-xs font-headline font-bold uppercase tracking-widest transition-colors ${
                  filter === f
                    ? "bg-surface-bright text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-outline-variant/20 mx-2 hidden md:block" />

          <span className="bg-secondary-container/20 text-secondary border border-secondary/20 px-4 py-1.5 rounded-full text-xs font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Sepolia Testnet
          </span>

          <span className="ml-auto text-xs font-headline text-on-surface-variant uppercase tracking-widest">
            {isLoading
              ? "Loading..."
              : `${filtered.length} collection${filtered.length !== 1 ? "s" : ""}`}
          </span>

          <Link
            href="/collections/create"
            className="flex items-center gap-2 font-headline font-bold px-6 py-3 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus size={16} />
            New Collection
          </Link>
        </section>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-outline-variant/20">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-container-low border border-outline-variant/20 flex items-center justify-center rounded-sm">
              <ImageIcon size={32} className="text-on-surface-variant/30" />
            </div>
            <h2 className="font-headline text-xl font-bold mb-2">
              {search
                ? "No collections match your search"
                : "No collections yet"}
            </h2>
            <p className="mb-6 text-sm text-on-surface-variant">
              {search
                ? "Try a different search term."
                : "Be the first to create an NFT collection."}
            </p>
            <Link
              href="/collections/create"
              className="inline-flex items-center gap-2 font-headline font-bold px-6 py-3 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed text-sm uppercase tracking-wider"
            >
              <Plus size={16} /> Create First Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* First card featured (larger) */}
            {filtered.length > 0 && (
              <div className="md:col-span-2 group relative overflow-hidden bg-surface-container-low transition-all duration-500 hover:bg-surface-container">
                <div className="aspect-[21/9] overflow-hidden relative bg-surface-container-high">
                  {resolveIpfsUrl(filtered[0].image) ? (
                    <Image
                      src={resolveIpfsUrl(filtered[0].image)}
                      alt={filtered[0].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 1024px) 100vw, 66vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon
                        size={48}
                        className="text-on-surface-variant/30"
                      />
                    </div>
                  )}
                </div>
                <div className="absolute top-6 right-6">
                  <span className="glass-panel px-4 py-2 border border-primary/20 text-primary text-[10px] uppercase font-headline font-black tracking-widest">
                    Featured
                  </span>
                </div>
                <div className="p-8 flex flex-col md:flex-row justify-between items-end gap-6">
                  <div className="flex gap-6 items-center">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-sm border-2 border-primary overflow-hidden bg-surface-container-high relative shadow-[0_0_15px_rgba(143,245,255,0.3)]">
                        {resolveIpfsUrl(filtered[0].image) ? (
                          <Image
                            src={resolveIpfsUrl(filtered[0].image)}
                            alt={filtered[0].name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <Link
                        href={`/collections/${filtered[0].contractAddress}`}
                      >
                        <h3 className="font-headline text-3xl font-bold text-on-surface group-hover:text-primary transition-colors">
                          {filtered[0].name}
                        </h3>
                      </Link>
                      <p className="text-on-surface-variant uppercase text-xs tracking-[0.2em] mt-1">
                        {filtered[0].symbol}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-10 border-l border-outline-variant/20 pl-8 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                        Mint Price
                      </p>
                      <p className="font-headline text-xl font-bold text-primary">
                        {formatEther(filtered[0].mintPrice)} ETH
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                        Max Supply
                      </p>
                      <p className="font-headline text-xl font-bold text-on-surface">
                        {filtered[0].maxSupply.toString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Remaining cards */}
            {filtered.slice(1).map((collection) => (
              <CollectionCard
                key={collection.contractAddress}
                collection={collection}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
