"use client";

import { useMarketplaceStats } from "@/hooks/marketplaceStats";
import { Layers, Box, Tag, TrendingUp } from "lucide-react";

function StatCard({
  label,
  value,
  icon,
  isLoading,
  suffix = "",
  accentClass,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  isLoading: boolean;
  suffix?: string;
  accentClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 border-r border-outline-variant/10 last:border-r-0">
      <div className={`w-10 h-10 flex items-center justify-center rounded-sm ${accentClass}`}>
        {icon}
      </div>
      {isLoading ? (
        <div className="h-10 w-24 rounded-sm animate-pulse bg-surface-container-high" />
      ) : (
        <p className="font-headline text-4xl font-bold tracking-tight tabular-nums text-on-surface">
          {value}
          {suffix && (
            <span className="text-2xl ml-1 text-on-surface-variant">{suffix}</span>
          )}
        </p>
      )}
      <p className="text-xs font-headline uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
    </div>
  );
}

export function StatsSection() {
  const stats = useMarketplaceStats();

  return (
    <section className="max-w-5xl mx-auto px-8">
      <div className="overflow-hidden md:grid md:grid-cols-4 divide-y md:divide-y-0 bg-surface-container-low border border-outline-variant/10">
        <StatCard
          label="Collections"
          value={stats.totalCollections}
          icon={<Layers size={18} className="text-primary" />}
          isLoading={stats.isLoading}
          accentClass="bg-primary/10 border border-primary/20"
        />
        <StatCard
          label="NFTs Minted"
          value={stats.totalNFTs}
          icon={<Box size={18} className="text-secondary" />}
          isLoading={stats.isLoading}
          accentClass="bg-secondary/10 border border-secondary/20"
        />
        <StatCard
          label="Listed"
          value={stats.totalListed}
          icon={<Tag size={18} className="text-tertiary" />}
          isLoading={stats.isLoading}
          accentClass="bg-tertiary/10 border border-tertiary/20"
        />
        <StatCard
          label="Volume"
          value={stats.volumeETH}
          suffix="ETH"
          icon={<TrendingUp size={18} className="text-primary-container" />}
          isLoading={stats.isLoading}
          accentClass="bg-primary-container/10 border border-primary-container/20"
        />
      </div>
    </section>
  );
}
