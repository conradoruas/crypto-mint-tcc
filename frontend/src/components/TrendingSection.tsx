"use client";

import {
  useTrendingCollections,
  TrendingCollection,
} from "@/hooks/useTrendingCollections";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

// ─── Sparkline SVG simples ───
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    return (
      <div className="w-16 h-8 flex items-center justify-center">
        <div className="w-full h-px bg-slate-700" />
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64,
    h = 32,
    pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + ((max - v) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Linha da tabela ───
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
      className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-3 hover:bg-slate-900/60 transition-colors border-b border-slate-800/50 last:border-0"
    >
      {/* Rank */}
      <span className="text-slate-500 text-sm font-mono text-right">
        {rank}
      </span>

      {/* Coleção */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-800 overflow-hidden shrink-0 relative">
          {image ? (
            <Image
              src={image}
              alt={collection.name}
              fill
              className="object-cover"
              sizes="36px"
            />
          ) : (
            <div className="w-full h-full bg-slate-700" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{collection.name}</p>
          <p className="text-xs text-slate-500 font-mono">
            {collection.symbol}
          </p>
        </div>
      </div>

      {/* Floor */}
      <div className="text-right">
        <p className="text-sm font-bold">
          {collection.floorPrice ? (
            `${collection.floorPrice} ETH`
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </p>
      </div>

      {/* Fl. Ch 24h */}
      <div className="text-right">
        {change !== null ? (
          <div
            className={`inline-flex items-center gap-1 text-sm font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        ) : (
          <span className="text-slate-600 text-sm">—</span>
        )}
      </div>

      {/* Top Offer */}
      <div className="text-right">
        <p className="text-sm text-slate-300">
          {collection.topOffer ? (
            `${collection.topOffer} ETH`
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </p>
      </div>

      {/* Sales 24h */}
      <div className="text-right">
        <p className="text-sm font-bold">{collection.sales24h}</p>
      </div>

      {/* Owners */}
      <div className="text-right">
        <p className="text-sm text-slate-300">
          {collection.owners > 0 ? (
            collection.owners.toLocaleString("pt-BR")
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </p>
      </div>

      {/* Volume 24h */}
      <div className="text-right">
        <p className="text-sm font-bold text-blue-400">
          {parseFloat(collection.volume24h) > 0 ? (
            `${collection.volume24h} ETH`
          ) : (
            <span className="text-slate-600 font-normal">—</span>
          )}
        </p>
      </div>

      {/* Sparkline */}
      <div className="flex justify-end">
        <Sparkline data={collection.floorHistory} positive={isPositive} />
      </div>
    </Link>
  );
}

function SkeletonRow({ rank }: { rank: number }) {
  return (
    <div className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-3 border-b border-slate-800/50">
      <span className="text-slate-600 text-sm font-mono text-right">
        {rank}
      </span>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse shrink-0" />
        <div className="space-y-1.5">
          <div className="h-3.5 bg-slate-800 rounded animate-pulse w-28" />
          <div className="h-2.5 bg-slate-800 rounded animate-pulse w-12" />
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-slate-800 rounded animate-pulse ml-auto w-16"
        />
      ))}
      <div className="h-8 bg-slate-800 rounded animate-pulse w-16 ml-auto" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

const HEADERS = [
  { label: "#", align: "text-right" },
  { label: "COLEÇÃO", align: "text-left" },
  { label: "FLOOR", align: "text-right" },
  { label: "FL. CH 24H", align: "text-right" },
  { label: "TOP OFFER", align: "text-right" },
  { label: "SALES 24H", align: "text-right" },
  { label: "OWNERS", align: "text-right" },
  { label: "VOLUME 24H", align: "text-right" },
  { label: "FLOOR 24H", align: "text-right" },
];

export function TrendingSection() {
  const { trending, isLoading } = useTrendingCollections(10);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black">Trending</h2>
        <Link
          href="/collections"
          className="text-xs text-slate-400 hover:text-white transition-colors font-mono tracking-wide"
        >
          Ver todas →
        </Link>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 border-b border-slate-800">
          {HEADERS.map((h) => (
            <p
              key={h.label}
              className={`text-xs text-slate-500 font-mono tracking-widest uppercase ${h.align}`}
            >
              {h.label}
            </p>
          ))}
        </div>

        {/* Linhas */}
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} rank={i + 1} />
          ))
        ) : trending.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">
              Nenhuma atividade nas últimas 24h
            </p>
          </div>
        ) : (
          trending.map((col, i) => (
            <TrendingRow
              key={col.contractAddress}
              collection={col}
              rank={i + 1}
            />
          ))
        )}
      </div>
    </section>
  );
}
