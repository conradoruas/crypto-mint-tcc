"use client";

import { useTrendingCollections } from "@/hooks/marketplace";
import type { TrendingCollection } from "@/types/collection";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { resolveIpfsUrl } from "@/lib/ipfs";

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    return (
      <div className="w-16 h-8 flex items-center justify-center">
        <div className="w-full h-px bg-outline-variant/30" />
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64, h = 32, pad = 2;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + ((max - v) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const color = positive ? "#8ff5ff" : "#ff716c";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

function ChangeChip({ change }: { change: number | null }) {
  if (change === null) return <span className="text-on-surface-variant/30 text-sm">—</span>;
  const positive = change >= 0;
  return (
    <div className={`inline-flex items-center gap-1 text-sm font-bold font-headline ${positive ? "text-primary" : "text-error"}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(change).toFixed(1)}%
    </div>
  );
}

// ── Desktop row (md+) ────────────────────────────────────────────────────────

function TrendingRow({ collection, rank }: { collection: TrendingCollection; rank: number }) {
  const image = resolveIpfsUrl(collection.image);
  const change = collection.floorChange24h;
  const isPositive = change !== null && change >= 0;

  return (
    <Link
      href={`/collections/${collection.contractAddress}`}
      className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-4 transition-colors border-b border-outline-variant/5 last:border-0 hover:bg-surface-container group"
    >
      <span className="font-headline text-on-surface-variant text-sm text-right">{rank}</span>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 overflow-hidden shrink-0 relative rounded-sm border border-outline-variant/20">
          {image ? (
            <Image src={image} alt={collection.name} fill className="object-cover" sizes="40px" />
          ) : (
            <div className="w-full h-full bg-surface-container-high" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-headline font-bold text-sm truncate text-on-surface group-hover:text-primary transition-colors">
            {collection.name}
          </p>
          <p className="text-[11px] text-on-surface-variant uppercase tracking-widest">{collection.symbol}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-on-surface">
          {collection.floorPrice ? `${collection.floorPrice} ETH` : <span className="text-on-surface-variant/30">—</span>}
        </p>
      </div>

      <div className="text-right"><ChangeChip change={change} /></div>

      <div className="text-right">
        <p className="text-sm text-on-surface-variant">
          {collection.topOffer ? `${collection.topOffer} ETH` : <span className="text-on-surface-variant/30">—</span>}
        </p>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-on-surface">{collection.sales24h}</p>
      </div>

      <div className="text-right">
        <p className="text-sm text-on-surface-variant">
          {collection.owners > 0 ? collection.owners.toLocaleString("pt-BR") : <span className="text-on-surface-variant/30">—</span>}
        </p>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-primary">
          {parseFloat(collection.volume24h) > 0 ? `${collection.volume24h} ETH` : <span className="font-normal text-on-surface-variant/30">—</span>}
        </p>
      </div>

      <div className="flex justify-end">
        <Sparkline data={collection.floorHistory} positive={isPositive} />
      </div>
    </Link>
  );
}

// ── Mobile card (below md) ───────────────────────────────────────────────────

function TrendingCard({ collection, rank }: { collection: TrendingCollection; rank: number }) {
  const image = resolveIpfsUrl(collection.image);
  const change = collection.floorChange24h;
  const isPositive = change !== null && change >= 0;
  const hasVolume = parseFloat(collection.volume24h) > 0;

  return (
    <Link
      href={`/collections/${collection.contractAddress}`}
      className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container transition-colors group"
    >
      <span className="font-headline text-on-surface-variant text-sm w-6 shrink-0 text-right">{rank}</span>

      <div className="w-10 h-10 overflow-hidden shrink-0 relative rounded-sm border border-outline-variant/20">
        {image ? (
          <Image src={image} alt={collection.name} fill className="object-cover" sizes="40px" />
        ) : (
          <div className="w-full h-full bg-surface-container-high" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-headline font-bold text-sm truncate text-on-surface group-hover:text-primary transition-colors">
          {collection.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-on-surface-variant uppercase tracking-widest">{collection.symbol}</span>
          {collection.floorPrice && (
            <span className="text-[11px] text-on-surface-variant">· {collection.floorPrice} ETH</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <ChangeChip change={change} />
        {hasVolume ? (
          <span className="font-headline font-bold text-xs text-primary">{collection.volume24h} ETH</span>
        ) : (
          <Sparkline data={collection.floorHistory} positive={isPositive} />
        )}
      </div>
    </Link>
  );
}

// ── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow({ rank }: { rank: number }) {
  return (
    <div className="hidden md:grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-4 border-b border-outline-variant/5">
      <span className="text-sm text-right text-on-surface-variant/30">{rank}</span>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 animate-pulse shrink-0 bg-surface-container-high rounded-sm" />
        <div className="space-y-1.5">
          <div className="h-3.5 rounded-sm animate-pulse w-28 bg-surface-container-high" />
          <div className="h-2.5 rounded-sm animate-pulse w-12 bg-surface-container-high" />
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-3 rounded-sm animate-pulse ml-auto w-16 bg-surface-container-high" />
      ))}
      <div className="h-8 rounded-sm animate-pulse w-16 ml-auto bg-surface-container-high" />
    </div>
  );
}

function SkeletonCard({ rank }: { rank: number }) {
  return (
    <div className="flex md:hidden items-center gap-3 px-4 py-4 border-b border-outline-variant/5">
      <span className="text-sm text-on-surface-variant/30 w-6 text-right">{rank}</span>
      <div className="w-10 h-10 animate-pulse shrink-0 bg-surface-container-high rounded-sm" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded-sm animate-pulse w-28 bg-surface-container-high" />
        <div className="h-2.5 rounded-sm animate-pulse w-20 bg-surface-container-high" />
      </div>
      <div className="space-y-1.5 items-end flex flex-col">
        <div className="h-3.5 rounded-sm animate-pulse w-12 bg-surface-container-high" />
        <div className="h-2.5 rounded-sm animate-pulse w-16 bg-surface-container-high" />
      </div>
    </div>
  );
}

const HEADERS = [
  { label: "#", align: "text-right" },
  { label: "Collection", align: "text-left" },
  { label: "Floor", align: "text-right" },
  { label: "24h Chg", align: "text-right" },
  { label: "Top Offer", align: "text-right" },
  { label: "Sales 24h", align: "text-right" },
  { label: "Owners", align: "text-right" },
  { label: "Vol 24h", align: "text-right" },
  { label: "Floor 24h", align: "text-right" },
];

export function TrendingSection() {
  const { trending, isLoading } = useTrendingCollections(10);

  return (
    <div className="overflow-hidden bg-surface-container-low border border-outline-variant/10">
      {/* Desktop header — hidden on mobile */}
      <div className="hidden md:grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 border-b border-outline-variant/10">
        {HEADERS.map((h) => (
          <p
            key={h.label}
            className={`text-[11px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant ${h.align}`}
          >
            {h.label}
          </p>
        ))}
      </div>

      {/* Mobile header */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-outline-variant/10">
        <p className="text-[11px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">Collection</p>
        <p className="text-[11px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">24h Chg / Vol</p>
      </div>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <SkeletonRow rank={i + 1} />
            <SkeletonCard rank={i + 1} />
          </div>
        ))
      ) : trending.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-on-surface-variant">No collections found</p>
        </div>
      ) : (
        trending.map((col, i) => (
          <div key={col.contractAddress}>
            {/* Desktop row */}
            <div className="hidden md:block">
              <TrendingRow collection={col} rank={i + 1} />
            </div>
            {/* Mobile card */}
            <div className="md:hidden">
              <TrendingCard collection={col} rank={i + 1} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
