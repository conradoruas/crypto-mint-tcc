"use client";

import Image from "next/image";
import { Navbar } from "@/components/NavBar";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ActivityEvent, ActivityType } from "@/types/marketplace";
import { getEventConfig, ALL_ACTIVITY_TYPES } from "@/lib/eventConfig";
import { useCollections } from "@/hooks/collections";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Activity, ExternalLink, ChevronDown } from "lucide-react";
import Footer from "@/components/Footer";
import {
  fetchAlchemyMetaForEvents,
  type NFTMeta,
  type MetaMap,
} from "@/lib/alchemyMeta";
import { useStableArray } from "@/hooks/useStableArray";

const EVENT_CONFIG = getEventConfig(16);

const ALL_TYPES = ALL_ACTIVITY_TYPES;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "—";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function EventRow({
  event,
  collectionName,
  meta,
}: {
  event: ActivityEvent;
  collectionName?: string;
  meta?: NFTMeta;
}) {
  const cfg = EVENT_CONFIG[event.type];

  return (
    <tr className="group hover:bg-surface-container-low transition-colors">
      {/* Event type */}
      <td className="py-6 pr-4">
        <div className="flex items-center gap-3">
          <span className={cfg.colorClass}>{cfg.icon}</span>
          <span className="font-headline font-bold text-sm text-on-surface">
            {cfg.label}
          </span>
        </div>
      </td>

      {/* Item */}
      <td className="py-6 px-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm overflow-hidden bg-surface-container-high flex-shrink-0 relative">
            {meta?.image && (
              <Image
                src={meta.image}
                alt={meta.name || "NFT Image"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading="eager"
              />
            )}
          </div>
          <div>
            <div className="font-headline font-bold text-on-surface text-sm leading-none">
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="hover:text-primary transition-colors"
              >
                {meta?.name ?? `#${event.tokenId.padStart(3, "0")}`}
              </Link>
            </div>
            {collectionName && (
              <div className="text-on-surface-variant text-xs mt-1 uppercase tracking-wider">
                {collectionName}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-6 px-4 text-right">
        {event.priceETH ? (
          <div className="font-headline font-bold text-on-surface">
            {parseFloat(event.priceETH).toFixed(4)} ETH
          </div>
        ) : (
          <span className="text-on-surface-variant/30">—</span>
        )}
      </td>

      {/* From */}
      <td className="py-6 px-4 text-center">
        <span className="text-primary font-mono text-xs hover:underline cursor-pointer">
          {shortAddr(event.from)}
        </span>
      </td>

      {/* To */}
      <td className="py-6 px-4 text-center">
        {event.to ? (
          <span className="text-secondary font-mono text-xs hover:underline cursor-pointer">
            {shortAddr(event.to)}
          </span>
        ) : (
          <span className="text-on-surface-variant/30 text-xs">—</span>
        )}
      </td>

      {/* Time + tx */}
      <td className="py-6 pl-4 text-right">
        <div className="flex items-center justify-end gap-2 text-on-surface-variant text-xs">
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
}

function SkeletonRow() {
  return (
    <tr>
      <td className="py-6 pr-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 animate-pulse bg-surface-container-high rounded-sm" />
          <div className="h-4 w-16 animate-pulse bg-surface-container-high rounded-sm" />
        </div>
      </td>
      <td className="py-6 px-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 animate-pulse bg-surface-container-high rounded-sm flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse bg-surface-container-high rounded-sm" />
            <div className="h-3 w-16 animate-pulse bg-surface-container-high rounded-sm" />
          </div>
        </div>
      </td>
      <td className="py-6 px-4 text-right">
        <div className="h-4 w-16 animate-pulse bg-surface-container-high rounded-sm ml-auto" />
      </td>
      <td className="py-6 px-4 text-center">
        <div className="h-3 w-20 animate-pulse bg-surface-container-high rounded-sm mx-auto" />
      </td>
      <td className="py-6 px-4 text-center">
        <div className="h-3 w-20 animate-pulse bg-surface-container-high rounded-sm mx-auto" />
      </td>
      <td className="py-6 pl-4 text-right">
        <div className="h-3 w-12 animate-pulse bg-surface-container-high rounded-sm ml-auto" />
      </td>
    </tr>
  );
}

export default function ActivityPage() {
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [metaMap, setMetaMap] = useState<MetaMap>(new Map());

  const { events: events, isLoading } = useActivityFeed(
    selectedCollection || undefined,
    100,
  );

  const stableEvents = useStableArray(
    events,
    (e) => `${e.nftContract}-${e.tokenId}`,
  );

  // Fetch NFT metadata only when the set of event IDs actually changes.
  // Using a joined string avoids re-triggering on Apollo's array reference churn.
  useEffect(() => {
    if (!stableEvents.length) return;
    fetchAlchemyMetaForEvents(stableEvents).then(setMetaMap);
  }, [stableEvents]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const displayedEvents =
    selectedTypes.length === 0
      ? events
      : events.filter((e) => selectedTypes.includes(e.type));

  const totalPages = Math.ceil(displayedEvents.length / PAGE_SIZE);
  const paginatedEvents = displayedEvents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const toggleType = (type: ActivityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
    setPage(1);
  };

  const collectionName = (addr: string) =>
    collections.find(
      (c) => c.contractAddress.toLowerCase() === addr.toLowerCase(),
    )?.name;

  const nftMeta = (nftContract: string, tokenId: string) =>
    metaMap.get(`${nftContract.toLowerCase()}-${tokenId}`);

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <div className="pt-32 pb-20 px-8 max-w-[1920px] mx-auto min-h-screen">
        {/* Page Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-headline font-bold tracking-[0.3em] text-primary uppercase">
                Live Market Feed
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-headline tracking-tighter text-on-surface uppercase">
              Platform Activity
            </h1>
            <p className="text-on-surface-variant max-w-xl text-lg font-light leading-relaxed">
              Real-time synchronization of the on-chain ledger. Every pulse of
              the marketplace.
            </p>
          </div>
        </header>

        {/* Filters */}
        <section className="mb-8 relative z-10">
          <div className="flex items-center gap-2 pb-4 flex-wrap overflow-x-auto">
            {/* Type pill filters */}
            <button
              onClick={() => setSelectedTypes([])}
              className={`px-6 py-2 rounded-full text-xs font-headline font-bold uppercase tracking-widest transition-all ${
                selectedTypes.length === 0
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              All Events
            </button>
            {ALL_TYPES.map((type) => {
              const cfg = EVENT_CONFIG[type];
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-6 py-2 rounded-full text-xs font-headline font-bold uppercase tracking-widest transition-all ${
                    isSelected
                      ? `bg-surface-container-high ${cfg.colorClass} border border-outline-variant/30`
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}

            <div className="h-6 w-px bg-outline-variant/20 mx-2" />

            {/* Collection filter */}
            {!isLoadingCollections && collections.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTypeFilter((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/15"
                >
                  <Activity size={14} />
                  {selectedCollection
                    ? (collections.find(
                        (c) => c.contractAddress === selectedCollection,
                      )?.name ?? "Collection")
                    : "All Collections"}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showTypeFilter ? "rotate-180" : ""}`}
                  />
                </button>
                {showTypeFilter && (
                  <div className="absolute top-full mt-1 left-0 z-50 w-56 shadow-xl bg-surface-container border border-outline-variant/20 rounded-sm">
                    <button
                      onClick={() => {
                        setSelectedCollection("");
                        setShowTypeFilter(false);
                        setPage(1);
                      }}
                      className="w-full flex items-center px-4 py-3 text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all border-b border-outline-variant/10"
                    >
                      All Collections
                    </button>
                    {collections.map((c) => (
                      <button
                        key={c.contractAddress}
                        onClick={() => {
                          setSelectedCollection(c.contractAddress);
                          setShowTypeFilter(false);
                          setPage(1);
                        }}
                        className={`w-full flex items-center px-4 py-3 text-sm transition-all border-b border-outline-variant/10 last:border-0 ${
                          selectedCollection === c.contractAddress
                            ? "text-primary bg-primary/5"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Count */}
        {!isLoading && (
          <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-4">
            {displayedEvents.length === events.length
              ? `${events.length} event${events.length !== 1 ? "s" : ""}`
              : `${displayedEvents.length} of ${events.length} events`}
          </p>
        )}

        {/* Ledger table */}
        <div className="relative z-0 overflow-x-auto">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
                  Event
                </th>
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
                  Item
                </th>
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-right">
                  Price
                </th>
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-center">
                  From
                </th>
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-center">
                  To
                </th>
                <th className="pb-6 pt-2 font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-right">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {isLoading && events.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayedEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Activity
                      size={40}
                      className="mx-auto mb-4 text-on-surface-variant/30"
                    />
                    <h3 className="font-headline text-lg font-bold mb-2 text-on-surface">
                      No activity found
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      {selectedTypes.length > 0 || selectedCollection
                        ? "Try adjusting the filters."
                        : "No events in the last 7 days."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    collectionName={collectionName(event.nftContract)}
                    meta={nftMeta(event.nftContract, event.tokenId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant uppercase tracking-widest">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, displayedEvents.length)} of{" "}
              {displayedEvents.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
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
                      key={`ellipsis-${idx}`}
                      className="px-2 text-on-surface-variant/40 text-xs"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${
                        page === p
                          ? "bg-primary text-on-primary border-primary"
                          : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
