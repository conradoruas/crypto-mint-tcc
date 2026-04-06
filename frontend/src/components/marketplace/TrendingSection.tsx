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

function TrendingRow({
  collection,
  rank,
}: {
  collection: TrendingCollection;
  rank: number;
}) {
  const image = resolveIpfsUrl(collection.image);
  const change = collection.floorChange24h;
  const isPositive = change !== null && change >= 0;

  return (
    <Link
      href={`/collections/${collection.contractAddress}`}
      className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-4 transition-colors border-b border-outline-variant/5 last:border-0 hover:bg-surface-container group"
    >
      <span className="font-headline text-on-surface-variant text-sm text-right">
        {rank}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 overflow-hidden shrink-0 relative rounded-sm border border-outline-variant/20">
          {image ? (
            <Image
              src={image}
              alt={collection.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full bg-surface-container-high" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-headline font-bold text-sm truncate text-on-surface group-hover:text-primary transition-colors">
            {collection.name}
          </p>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
            {collection.symbol}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-on-surface">
          {collection.floorPrice ? (
            `${collection.floorPrice} ETH`
          ) : (
            <span className="text-on-surface-variant/30">—</span>
          )}
        </p>
      </div>

      <div className="text-right">
        {change !== null ? (
          <div
            className={`inline-flex items-center gap-1 text-sm font-bold font-headline ${
              isPositive ? "text-primary" : "text-error"
            }`}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        ) : (
          <span className="text-sm text-on-surface-variant/30">—</span>
        )}
      </div>

      <div className="text-right">
        <p className="text-sm text-on-surface-variant">
          {collection.topOffer ? (
            `${collection.topOffer} ETH`
          ) : (
            <span className="text-on-surface-variant/30">—</span>
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-on-surface">
          {collection.sales24h}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm text-on-surface-variant">
          {collection.owners > 0 ? (
            collection.owners.toLocaleString("pt-BR")
          ) : (
            <span className="text-on-surface-variant/30">—</span>
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="font-headline font-bold text-sm text-primary">
          {parseFloat(collection.volume24h) > 0 ? (
            `${collection.volume24h} ETH`
          ) : (
            <span className="font-normal text-on-surface-variant/30">—</span>
          )}
        </p>
      </div>

      <div className="flex justify-end">
        <Sparkline data={collection.floorHistory} positive={isPositive} />
      </div>
    </Link>
  );
}

function SkeletonRow({ rank }: { rank: number }) {
  return (
    <div className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-4 border-b border-outline-variant/5">
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
      <div className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 border-b border-outline-variant/10">
        {HEADERS.map((h) => (
          <p
            key={h.label}
            className={`text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant ${h.align}`}
          >
            {h.label}
          </p>
        ))}
      </div>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} rank={i + 1} />
        ))
      ) : trending.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-on-surface-variant">
            No collections found
          </p>
        </div>
      ) : (
        trending.map((col, i) => (
          <TrendingRow key={col.contractAddress} collection={col} rank={i + 1} />
        ))
      )}
    </div>
  );
}
