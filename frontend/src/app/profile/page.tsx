"use client";

import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  useProfileNFTs,
  useCollections,
  CollectionNFTItem,
} from "@/hooks/useCollections";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Pencil, User, ExternalLink, Search, X } from "lucide-react";
import { fetchProfile, UserProfile } from "@/services/profile";
import Footer from "@/components/Footer";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

type SortOption = "default" | "id_asc" | "id_desc" | "name_asc" | "name_desc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Default",
  id_asc: "ID Ascending",
  id_desc: "ID Descending",
  name_asc: "Name A→Z",
  name_desc: "Name Z→A",
};

function filterAndSort(
  nfts: CollectionNFTItem[],
  search: string,
  sort: SortOption,
): CollectionNFTItem[] {
  const filtered = nfts.filter((nft) => {
    if (!search.trim()) return true;
    return (
      nft.name.toLowerCase().includes(search.toLowerCase()) ||
      nft.tokenId.includes(search.trim())
    );
  });
  const sorted = [...filtered];
  switch (sort) {
    case "id_asc":
      return sorted.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
    case "id_desc":
      return sorted.sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));
    case "name_asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted;
  }
}

function ProfileAvatar({
  imageUri,
  name,
  size = 160,
}: {
  imageUri?: string;
  name?: string;
  size?: number;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  if (imageUri) {
    return (
      <div
        className="relative overflow-hidden shrink-0 border-4 border-background shadow-2xl"
        style={{ width: size, height: size }}
      >
        <Image
          src={resolveIpfsUrl(imageUri)}
          alt={name ?? "Profile"}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center shrink-0 font-headline font-bold border-4 border-background shadow-2xl bg-surface-container-high"
      style={{ width: size, height: size, fontSize: size * 0.28 }}
    >
      <span className="text-primary">{initials}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useConnection();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [activeTab, setActiveTab] = useState("Collected");

  const { nfts, isLoading: isLoadingNFTs } = useProfileNFTs(
    address,
    selectedCollection || undefined,
  );
  const isLoading = isLoadingCollections || isLoadingNFTs;
  const displayedNFTs = useMemo(
    () => filterAndSort(nfts, search, sort),
    [nfts, search, sort],
  );
  const hasActiveFilters = search !== "" || sort !== "default";
  const clearFilters = () => {
    setSearch("");
    setSort("default");
  };

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchProfile(address).then((p) => {
      if (!cancelled) setProfile(p ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <div className="text-center py-32 text-on-surface-variant">
          Connect your wallet to view your profile.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />

      {/* Hero banner */}
      <section className="relative w-full h-[280px] bg-surface-container-low overflow-hidden mt-16">
        <div className="w-full h-full bg-gradient-to-br from-primary/5 via-surface-container-low to-secondary/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </section>

      {/* Profile content */}
      <div className="max-w-[1400px] mx-auto px-8 relative -mt-24 pb-12">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row items-end gap-8 mb-12">
          <div className="relative">
            {profile === undefined ? (
              <div className="w-40 h-40 animate-pulse bg-surface-container-high border-4 border-background" />
            ) : (
              <ProfileAvatar
                imageUri={profile?.imageUri}
                name={profile?.name}
                size={160}
              />
            )}
            <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-1.5 border-2 border-background">
              <User size={14} className="text-on-primary-fixed" />
            </div>
          </div>

          <div className="flex-1 pb-4">
            {profile === undefined ? (
              <div className="h-8 rounded-sm animate-pulse w-48 mb-3 bg-surface-container-high" />
            ) : (
              <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface mb-2 uppercase">
                {profile?.name || (
                  <span className="font-normal italic text-on-surface-variant">
                    No Name
                  </span>
                )}
              </h1>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-sm border border-outline-variant/15">
                <span className="text-primary font-mono text-sm tracking-tight">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <a
                  href={`https://sepolia.etherscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-4">
            <Link
              href="/profile/edit"
              className="flex items-center gap-2 px-6 py-2.5 border border-outline-variant/30 rounded-sm font-headline font-semibold text-sm uppercase tracking-widest hover:bg-surface-container transition-all"
            >
              <Pencil size={14} />
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-primary/40">
            <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1">
              NFTs
            </p>
            <p className="font-headline text-2xl font-bold">{nfts.length}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-secondary/40">
            <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1">
              Collections
            </p>
            <p className="font-headline text-2xl font-bold">
              {collections.length}
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-tertiary/40">
            <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1">
              Network
            </p>
            <p className="font-headline text-lg font-bold text-primary">
              Sepolia
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-outline/40">
            <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1">
              Standard
            </p>
            <p className="font-headline text-lg font-bold">ERC-721</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-outline-variant/15 mb-10 overflow-x-auto no-scrollbar">
          {["Collected", "Created", "Activity"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-headline text-sm font-bold uppercase tracking-widest border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Collection filter + search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {!isLoadingCollections && collections.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {[{ contractAddress: "", name: "All" }, ...collections].map(
                (c) => {
                  const isActive = selectedCollection === c.contractAddress;
                  return (
                    <button
                      key={c.contractAddress}
                      onClick={() => setSelectedCollection(c.contractAddress)}
                      className={`px-4 py-2 rounded-full text-xs font-headline font-bold uppercase tracking-widest border transition-all ${
                        isActive
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "text-on-surface-variant border-outline-variant/15 hover:border-outline"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                },
              )}
            </div>
          )}

          {!isLoading && nfts.length > 0 && (
            <div className="flex gap-3 sm:ml-auto">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-on-surface-variant/50 w-48"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="appearance-none bg-surface-container border border-outline-variant/15 rounded-sm px-4 py-2 pr-8 text-sm focus:outline-none focus:border-primary cursor-pointer text-on-surface"
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 rounded-sm text-xs border border-error/30 text-error bg-error/5"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* NFT Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-sm overflow-hidden border border-outline-variant/5"
              >
                <div className="aspect-square animate-pulse bg-surface-container-high" />
                <div className="p-5 space-y-3">
                  <div className="h-3 rounded-sm animate-pulse w-1/2 bg-surface-container-high" />
                  <div className="h-4 rounded-sm animate-pulse w-3/4 bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20">
            <User
              size={48}
              className="mx-auto mb-4 text-on-surface-variant/30"
            />
            <p className="text-sm text-on-surface-variant">
              {selectedCollection
                ? "You don't own any NFTs in this collection."
                : collections.length === 0
                  ? "No collections exist yet."
                  : "You don't own any NFTs yet."}
            </p>
          </div>
        ) : displayedNFTs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-outline-variant/20">
            <Search
              size={40}
              className="mx-auto mb-4 text-on-surface-variant/30"
            />
            <h3 className="font-headline text-lg font-bold mb-2">No results</h3>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 font-medium px-5 py-2.5 text-sm rounded-sm bg-surface-container border border-outline-variant/15 text-on-surface mt-4"
            >
              <X size={13} /> Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedNFTs.map((nft: CollectionNFTItem) => (
              <Link
                href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
                key={`${nft.nftContract}-${nft.tokenId}`}
                className="group bg-surface-container-low rounded-sm overflow-hidden hover:scale-[1.02] hover:bg-surface-container-high transition-all duration-300"
              >
                <div className="aspect-square overflow-hidden relative">
                  {nft.image ? (
                    <Image
                      src={nft.image}
                      alt={nft.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-surface-container-high" />
                  )}
                  <div className="absolute top-4 right-4 glass-panel px-3 py-1 rounded-full border border-outline-variant/30 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold">
                      #{nft.tokenId.padStart(3, "0")}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                    {nft.tokenId.padStart(3, "0")}
                  </p>
                  <h3 className="font-headline font-bold text-lg truncate group-hover:text-primary transition-colors">
                    {nft.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
