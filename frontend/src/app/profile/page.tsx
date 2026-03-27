"use client";

import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  useProfileNFTs,
  useCollections,
  useCreatedNFTs,
  CollectionNFTItem,
  CreatedNFTItem,
} from "@/hooks/useCollections";
import { useUserFavorites } from "@/hooks/useFavorites";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  Pencil,
  User,
  ExternalLink,
  Search,
  X,
  ShoppingCart,
  Tag,
  HandCoins,
  CheckCircle,
  Sparkles,
  Activity,
  Heart,
} from "lucide-react";
import { fetchProfile, UserProfile } from "@/services/profile";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ActivityType } from "@/types/marketplace";
import Footer from "@/components/Footer";
import { fetchAlchemyMetaForEvents, type MetaMap } from "@/lib/alchemyMeta";

const EVENT_CONFIG: Record<
  ActivityType,
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  sale: {
    label: "Sale",
    icon: <ShoppingCart size={14} />,
    colorClass: "text-primary",
  },
  listing: {
    label: "Listing",
    icon: <Tag size={14} />,
    colorClass: "text-secondary",
  },
  listing_cancelled: {
    label: "Cancelled",
    icon: <X size={14} />,
    colorClass: "text-on-surface-variant",
  },
  offer: {
    label: "Offer",
    icon: <HandCoins size={14} />,
    colorClass: "text-tertiary",
  },
  offer_accepted: {
    label: "Offer Accepted",
    icon: <CheckCircle size={14} />,
    colorClass: "text-primary",
  },
  offer_cancelled: {
    label: "Offer Cancelled",
    icon: <X size={14} />,
    colorClass: "text-error",
  },
  mint: {
    label: "Mint",
    icon: <Sparkles size={14} />,
    colorClass: "text-tertiary",
  },
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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
  const [metaMap, setMetaMap] = useState<MetaMap>(new Map());
  const [collectedPage, setCollectedPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const NFT_PAGE_SIZE = 8;
  const ACTIVITY_PAGE_SIZE = 10;

  const { nfts, isLoading: isLoadingNFTs } = useProfileNFTs(
    address,
    selectedCollection || undefined,
  );
  const isLoading = isLoadingCollections || isLoadingNFTs;

  const { nfts: createdNfts, isLoading: isLoadingCreated } =
    useCreatedNFTs(address);
  const { favorites, isLoading: isLoadingFavorites } =
    useUserFavorites(address);
  const displayedNFTs = useMemo(
    () => filterAndSort(nfts, search, sort),
    [nfts, search, sort],
  );
  const hasActiveFilters = search !== "" || sort !== "default";
  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setCollectedPage(1);
  };

  useEffect(() => {
    setCollectedPage(1);
  }, [search, sort, selectedCollection]);

  const collectedTotalPages = Math.ceil(displayedNFTs.length / NFT_PAGE_SIZE);
  const paginatedCollected = displayedNFTs.slice(
    (collectedPage - 1) * NFT_PAGE_SIZE,
    collectedPage * NFT_PAGE_SIZE,
  );

  const createdTotalPages = Math.ceil(createdNfts.length / NFT_PAGE_SIZE);
  const paginatedCreated = (createdNfts as CreatedNFTItem[]).slice(
    (createdPage - 1) * NFT_PAGE_SIZE,
    createdPage * NFT_PAGE_SIZE,
  );

  // Activity feed — fetch all recent events, filter to this user client-side
  const { events: allEvents, isLoading: isLoadingActivity } = useActivityFeed(
    undefined,
    200,
  );
  const userEvents = useMemo(() => {
    if (!address) return [];
    const lower = address.toLowerCase();
    return allEvents.filter(
      (e) => e.from.toLowerCase() === lower || e.to?.toLowerCase() === lower,
    );
  }, [allEvents, address]);

  const activityTotalPages = Math.ceil(userEvents.length / ACTIVITY_PAGE_SIZE);
  const paginatedActivity = userEvents.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE,
  );

  const eventIds = userEvents.map((e) => e.id).join(",");
  useEffect(() => {
    if (!userEvents.length) return;
    fetchAlchemyMetaForEvents(userEvents).then(setMetaMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIds]);

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
          {["Collected", "Favorites", "Created", "Activity"].map((tab) => (
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

        {/* Collection filter + search — Collected tab only */}
        {activeTab === "Collected" && (
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
        )}

        {/* Activity tab */}
        {activeTab === "Activity" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  {["Event", "Item", "Price", "From", "To", "Time"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`pb-4 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold ${
                          i === 2
                            ? "text-right px-4"
                            : i === 3 || i === 4
                              ? "text-center px-4"
                              : i === 5
                                ? "text-right pl-4"
                                : i === 1
                                  ? "px-4"
                                  : "pr-4"
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {isLoadingActivity && userEvents.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 animate-pulse bg-surface-container-high rounded-sm" />
                          <div className="h-3 w-14 animate-pulse bg-surface-container-high rounded-sm" />
                        </div>
                      </td>
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 animate-pulse bg-surface-container-high rounded-sm shrink-0" />
                          <div className="h-3 w-20 animate-pulse bg-surface-container-high rounded-sm" />
                        </div>
                      </td>
                      <td className="py-5 px-4 text-right">
                        <div className="h-3 w-14 animate-pulse bg-surface-container-high rounded-sm ml-auto" />
                      </td>
                      <td className="py-5 px-4 text-center">
                        <div className="h-3 w-16 animate-pulse bg-surface-container-high rounded-sm mx-auto" />
                      </td>
                      <td className="py-5 px-4 text-center">
                        <div className="h-3 w-16 animate-pulse bg-surface-container-high rounded-sm mx-auto" />
                      </td>
                      <td className="py-5 pl-4 text-right">
                        <div className="h-3 w-10 animate-pulse bg-surface-container-high rounded-sm ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : userEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <Activity
                        size={40}
                        className="mx-auto mb-4 text-on-surface-variant/30"
                      />
                      <p className="text-sm text-on-surface-variant">
                        Nenhuma atividade recente encontrada.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedActivity.map((event) => {
                    const cfg = EVENT_CONFIG[event.type];
                    const metaKey = `${event.nftContract.toLowerCase()}-${event.tokenId}`;
                    const meta = metaMap.get(metaKey);
                    const isUser = (addr: string) =>
                      addr.toLowerCase() === address?.toLowerCase();
                    return (
                      <tr
                        key={event.id}
                        className="group hover:bg-surface-container-low transition-colors"
                      >
                        {/* Event */}
                        <td className="py-5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={cfg.colorClass}>{cfg.icon}</span>
                            <span className="font-headline font-bold text-sm text-on-surface whitespace-nowrap">
                              {cfg.label}
                            </span>
                          </div>
                        </td>
                        {/* Item */}
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-sm overflow-hidden bg-surface-container-high shrink-0">
                              {meta?.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={meta.image}
                                  alt={meta.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <Link
                              href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                              className="font-headline font-bold text-sm text-on-surface hover:text-primary transition-colors whitespace-nowrap"
                            >
                              {meta?.name ??
                                `#${event.tokenId.padStart(3, "0")}`}
                            </Link>
                          </div>
                        </td>
                        {/* Price */}
                        <td className="py-5 px-4 text-right">
                          {event.priceETH ? (
                            <span className="font-headline font-bold text-on-surface whitespace-nowrap">
                              {parseFloat(event.priceETH).toFixed(4)} ETH
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/30">
                              —
                            </span>
                          )}
                        </td>
                        {/* From */}
                        <td className="py-5 px-4 text-center">
                          <span
                            className={`font-mono text-xs ${
                              isUser(event.from)
                                ? "text-primary font-bold"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {isUser(event.from) ? "You" : shortAddr(event.from)}
                          </span>
                        </td>
                        {/* To */}
                        <td className="py-5 px-4 text-center">
                          {event.to ? (
                            <span
                              className={`font-mono text-xs ${
                                isUser(event.to)
                                  ? "text-secondary font-bold"
                                  : "text-on-surface-variant"
                              }`}
                            >
                              {isUser(event.to) ? "You" : shortAddr(event.to)}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/30 text-xs">
                              —
                            </span>
                          )}
                        </td>
                        {/* Time */}
                        <td className="py-5 pl-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-on-surface-variant text-xs whitespace-nowrap">
                            <span>{formatTime(event.timestamp)}</span>
                            <a
                              href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {activityTotalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
                <p className="text-xs text-on-surface-variant uppercase tracking-widest">
                  {(activityPage - 1) * ACTIVITY_PAGE_SIZE + 1}–
                  {Math.min(
                    activityPage * ACTIVITY_PAGE_SIZE,
                    userEvents.length,
                  )}{" "}
                  of {userEvents.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    disabled={activityPage === 1}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Prev
                  </button>
                  {Array.from({ length: activityTotalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === activityTotalPages ||
                        Math.abs(p - activityPage) <= 1,
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                        acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "…" ? (
                        <span
                          key={`e-${idx}`}
                          className="px-2 text-on-surface-variant/40 text-xs"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setActivityPage(p as number)}
                          className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${activityPage === p ? "bg-primary text-on-primary border-primary" : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"}`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() =>
                      setActivityPage((p) =>
                        Math.min(activityTotalPages, p + 1),
                      )
                    }
                    disabled={activityPage === activityTotalPages}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Favorites tab */}
        {activeTab === "Favorites" &&
          (isLoadingFavorites ? (
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
          ) : favorites.length === 0 ? (
            <div className="text-center py-20">
              <Heart
                size={48}
                className="mx-auto mb-4 text-on-surface-variant/30"
              />
              <p className="text-sm text-on-surface-variant">
                You haven&apos;t saved any NFTs yet.
              </p>
            </div>
          ) : (() => {
            const favTotalPages = Math.ceil(favorites.length / NFT_PAGE_SIZE);
            const paginatedFavorites = favorites.slice(
              (favoritesPage - 1) * NFT_PAGE_SIZE,
              favoritesPage * NFT_PAGE_SIZE,
            );
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedFavorites.map((nft) => (
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
                      </div>
                      <div className="p-5">
                        <h3 className="font-headline font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {nft.name}
                        </h3>
                        <p className="text-on-surface-variant text-xs mt-1">
                          #{nft.tokenId.padStart(3, "0")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {favTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
                    <p className="text-xs text-on-surface-variant uppercase tracking-widest">
                      {(favoritesPage - 1) * NFT_PAGE_SIZE + 1}–
                      {Math.min(favoritesPage * NFT_PAGE_SIZE, favorites.length)}{" "}
                      of {favorites.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFavoritesPage((p) => Math.max(1, p - 1))}
                        disabled={favoritesPage === 1}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        Prev
                      </button>
                      {Array.from({ length: favTotalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === favTotalPages ||
                            Math.abs(p - favoritesPage) <= 1,
                        )
                        .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                            acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "…" ? (
                            <span
                              key={`e-${idx}`}
                              className="px-2 text-on-surface-variant/40 text-xs"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setFavoritesPage(p as number)}
                              className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${favoritesPage === p ? "bg-primary text-on-primary border-primary" : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"}`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                      <button
                        onClick={() => setFavoritesPage((p) => Math.min(favTotalPages, p + 1))}
                        disabled={favoritesPage === favTotalPages}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()
          )}

        {/* Created tab */}
        {activeTab === "Created" &&
          (isLoadingCreated ? (
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
          ) : createdNfts.length === 0 ? (
            <div className="text-center py-20">
              <User
                size={48}
                className="mx-auto mb-4 text-on-surface-variant/30"
              />
              <p className="text-sm text-on-surface-variant">
                You haven&apos;t created any NFTs yet.
              </p>
              <Link
                href="/collections/create"
                className="inline-flex items-center gap-2 mt-4 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
              >
                Create a Collection
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedCreated.map((nft) => (
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
                    </div>
                    <div className="p-5">
                      <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                        {nft.collectionName}
                      </p>
                      <h3 className="font-headline font-bold text-lg truncate group-hover:text-primary transition-colors">
                        {nft.name}
                      </h3>
                      <p className="text-on-surface-variant text-xs mt-1">
                        #{nft.tokenId.padStart(3, "0")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              {createdTotalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant uppercase tracking-widest">
                    {(createdPage - 1) * NFT_PAGE_SIZE + 1}–
                    {Math.min(createdPage * NFT_PAGE_SIZE, createdNfts.length)}{" "}
                    of {createdNfts.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCreatedPage((p) => Math.max(1, p - 1))}
                      disabled={createdPage === 1}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    {Array.from({ length: createdTotalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === createdTotalPages ||
                          Math.abs(p - createdPage) <= 1,
                      )
                      .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                          acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "…" ? (
                          <span
                            key={`e-${idx}`}
                            className="px-2 text-on-surface-variant/40 text-xs"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCreatedPage(p as number)}
                            className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${createdPage === p ? "bg-primary text-on-primary border-primary" : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"}`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() =>
                        setCreatedPage((p) =>
                          Math.min(createdTotalPages, p + 1),
                        )
                      }
                      disabled={createdPage === createdTotalPages}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ))}

        {/* Collected tab NFT Grid */}
        {activeTab === "Collected" &&
          (isLoading ? (
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
              <h3 className="font-headline text-lg font-bold mb-2">
                No results
              </h3>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 font-medium px-5 py-2.5 text-sm rounded-sm bg-surface-container border border-outline-variant/15 text-on-surface mt-4"
              >
                <X size={13} /> Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedCollected.map((nft: CollectionNFTItem) => {
                  const collectionName =
                    collections.find(
                      (c) =>
                        c.contractAddress.toLowerCase() ===
                        nft.nftContract.toLowerCase(),
                    )?.name ?? "";
                  return (
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
                      </div>
                      <div className="p-5">
                        <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                          {collectionName}
                        </p>
                        <h3 className="font-headline font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {nft.name}
                        </h3>
                        <p className="text-on-surface-variant text-xs mt-1">
                          #{nft.tokenId.padStart(3, "0")}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {collectedTotalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant uppercase tracking-widest">
                    {(collectedPage - 1) * NFT_PAGE_SIZE + 1}–
                    {Math.min(
                      collectedPage * NFT_PAGE_SIZE,
                      displayedNFTs.length,
                    )}{" "}
                    of {displayedNFTs.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setCollectedPage((p) => Math.max(1, p - 1))
                      }
                      disabled={collectedPage === 1}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    {Array.from(
                      { length: collectedTotalPages },
                      (_, i) => i + 1,
                    )
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === collectedTotalPages ||
                          Math.abs(p - collectedPage) <= 1,
                      )
                      .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                          acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "…" ? (
                          <span
                            key={`e-${idx}`}
                            className="px-2 text-on-surface-variant/40 text-xs"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCollectedPage(p as number)}
                            className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${collectedPage === p ? "bg-primary text-on-primary border-primary" : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"}`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() =>
                        setCollectedPage((p) =>
                          Math.min(collectedTotalPages, p + 1),
                        )
                      }
                      disabled={collectedPage === collectedTotalPages}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ))}
      </div>
      <Footer />
    </main>
  );
}
