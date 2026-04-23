"use client";

import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { useActivityFeed } from "@/hooks/activity";
import type { ActivityEvent, ActivityType } from "@/types/marketplace";
import { getEventConfig, ALL_ACTIVITY_TYPES } from "@/lib/eventConfig";
import { useCollections } from "@/hooks/collections";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Activity, ExternalLink, ChevronDown } from "lucide-react";
import Footer from "@/components/Footer";
import { fetchBatchNFTMetadataForEvents as fetchAlchemyMetaForEvents } from "@/lib/nftMetadata";
import type { NFTMeta, MetaMap } from "@/types/alchemy";
import { useStableArray } from "@/hooks/useStableArray";
import { shortAddr, formatTimeAgo } from "@/lib/utils";
import { PageControls } from "@/components/ui";
import { buildEtherscanTxUrl } from "@/lib/externalLinks";

const EVENT_CONFIG = getEventConfig(16);

const ALL_TYPES = ALL_ACTIVITY_TYPES;

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
  const txUrl = buildEtherscanTxUrl(event.txHash);
  if (!cfg) return null;

  return (
    <tr className="group hover:bg-surface-container-low transition-colors">
      {/* Event type */}
      <td className="py-5 pr-3">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className={`shrink-0 ${cfg.colorClass}`}>{cfg.icon}</span>
          <span className="font-headline font-bold text-sm text-on-surface truncate">
            {cfg.label}
          </span>
        </div>
      </td>

      {/* Item */}
      <td className="py-5 px-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-sm overflow-hidden bg-surface-container-high shrink-0 relative">
            {meta?.image && (
              <Image
                src={meta.image}
                alt={meta.name || "NFT Image"}
                fill
                className="object-cover"
                sizes="80px"
                loading="eager"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-headline font-bold text-on-surface text-sm leading-none truncate">
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="hover:text-primary transition-colors"
              >
                {meta?.name ?? `#${event.tokenId.padStart(3, "0")}`}
              </Link>
            </div>
            {collectionName && (
              <div className="text-on-surface-variant text-xs mt-1 uppercase tracking-wider truncate">
                {collectionName}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-5 px-3 text-right whitespace-nowrap">
        {event.priceETH ? (
          <div className="font-headline font-bold text-on-surface text-sm">
            {parseFloat(event.priceETH).toFixed(4)} ETH
          </div>
        ) : (
          <span className="text-on-surface-variant/30">—</span>
        )}
      </td>

      {/* From */}
      <td className="py-5 px-3 text-center">
        <span className="text-primary font-mono text-xs hover:underline cursor-pointer whitespace-nowrap">
          {shortAddr(event.from)}
        </span>
      </td>

      {/* To */}
      <td className="py-5 px-3 text-center">
        {event.to ? (
          <span className="text-secondary font-mono text-xs hover:underline cursor-pointer whitespace-nowrap">
            {shortAddr(event.to)}
          </span>
        ) : (
          <span className="text-on-surface-variant/30 text-xs">—</span>
        )}
      </td>

      {/* Time + tx */}
      <td className="py-5 pl-3 text-right">
        <div className="flex items-center justify-end gap-2 text-on-surface-variant text-xs whitespace-nowrap">
          <span>{formatTimeAgo(event.timestamp)}</span>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors shrink-0"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function EventCard({
  event,
  collectionName,
  meta,
}: {
  event: ActivityEvent;
  collectionName?: string;
  meta?: NFTMeta;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const txUrl = buildEtherscanTxUrl(event.txHash);
  if (!cfg) return null;

  return (
    <div className="flex gap-3 px-4 py-4 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low transition-colors">
      {/* NFT thumbnail */}
      <div className="w-12 h-12 rounded-sm overflow-hidden bg-surface-container-high shrink-0 relative">
        {meta?.image && (
          <Image
            src={meta.image}
            alt={meta.name || "NFT Image"}
            fill
            className="object-cover"
            sizes="48px"
            loading="eager"
          />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 text-xs font-headline font-bold uppercase tracking-widest ${cfg.colorClass}`}>
            <span className="shrink-0">{cfg.icon}</span>
            {cfg.label}
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs shrink-0">
            <span>{formatTimeAgo(event.timestamp)}</span>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
            className="font-headline font-bold text-sm text-on-surface truncate hover:text-primary transition-colors"
          >
            {meta?.name ?? `#${event.tokenId.padStart(3, "0")}`}
          </Link>
          {event.priceETH && (
            <span className="font-headline font-bold text-sm text-on-surface shrink-0">
              {parseFloat(event.priceETH).toFixed(4)} ETH
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {collectionName && (
            <span className="text-on-surface-variant uppercase tracking-wider truncate">
              {collectionName}
            </span>
          )}
          {(event.from || event.to) && (
            <span className="text-on-surface-variant/50 shrink-0">
              <span className="text-primary font-mono">{shortAddr(event.from)}</span>
              {event.to && (
                <>
                  {" → "}
                  <span className="text-secondary font-mono">{shortAddr(event.to)}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
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
    <main className="min-h-screen bg-background text-on-surface overflow-x-hidden">
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
          <div className="flex items-center gap-2 pb-4 flex-wrap">
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
                      className="w-full flex items-center text-left px-4 py-3 text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all border-b border-outline-variant/10"
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
                        className={`w-full flex items-center text-left px-4 py-3 text-sm transition-all border-b border-outline-variant/10 last:border-0 ${
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

        {/* Mobile card list */}
        <div className="md:hidden bg-surface-container-low border border-outline-variant/10">
          {isLoading && events.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4 border-b border-outline-variant/5">
                <div className="w-12 h-12 animate-pulse bg-surface-container-high rounded-sm shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 animate-pulse bg-surface-container-high rounded-sm" />
                  <div className="h-4 w-32 animate-pulse bg-surface-container-high rounded-sm" />
                  <div className="h-3 w-24 animate-pulse bg-surface-container-high rounded-sm" />
                </div>
              </div>
            ))
          ) : displayedEvents.length === 0 ? (
            <div className="py-16 text-center">
              <Activity size={32} className="mx-auto mb-3 text-on-surface-variant/30" />
              <p className="text-sm text-on-surface-variant">No activity found</p>
            </div>
          ) : (
            paginatedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                collectionName={collectionName(event.nftContract)}
                meta={nftMeta(event.nftContract, event.tokenId)}
              />
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="relative z-0 hidden md:block">
          <div className="absolute -top-10 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[14%]" />{/* Event */}
              <col className="w-[28%]" />{/* Item */}
              <col className="w-[14%]" />{/* Price */}
              <col className="w-[14%]" />{/* From */}
              <col className="w-[14%]" />{/* To */}
              <col className="w-[16%]" />{/* Time */}
            </colgroup>
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
                  Event
                </th>
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
                  Item
                </th>
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-right">
                  Price
                </th>
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-center">
                  From
                </th>
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-center">
                  To
                </th>
                <th className="pb-5 pt-2 font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-bold text-right">
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

        <PageControls
          page={page}
          totalPages={totalPages}
          totalItems={displayedEvents.length}
          pageSize={PAGE_SIZE}
          setPage={setPage}
          className="mt-8"
        />
      </div>
      <Footer />
    </main>
  );
}
