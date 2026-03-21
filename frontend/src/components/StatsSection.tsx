"use client";

import { useMarketplaceStats } from "@/hooks/useMarketplaceStats";
import { Layers, Box, Tag, TrendingUp } from "lucide-react";

function StatCard({
  label,
  value,
  icon,
  isLoading,
  suffix = "",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  isLoading: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
        {icon}
      </div>
      {isLoading ? (
        <div className="h-9 w-20 bg-slate-800 rounded-lg animate-pulse" />
      ) : (
        <p className="text-4xl font-black tracking-tight tabular-nums">
          {value}
          {suffix && (
            <span className="text-2xl text-slate-400 ml-1">{suffix}</span>
          )}
        </p>
      )}
      <p className="text-slate-500 text-sm font-medium">{label}</p>
    </div>
  );
}

export function StatsSection() {
  const stats = useMarketplaceStats();

  return (
    <section className="max-w-5xl mx-auto px-4 pb-20">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800 md:divide-y-0 md:divide-x md:grid md:grid-cols-4 overflow-hidden">
        <StatCard
          label="Coleções"
          value={stats.totalCollections}
          icon={<Layers size={18} className="text-blue-400" />}
          isLoading={stats.isLoading}
        />
        <StatCard
          label="NFTs Mintados"
          value={stats.totalNFTs}
          icon={<Box size={18} className="text-purple-400" />}
          isLoading={stats.isLoading}
        />
        <StatCard
          label="À Venda"
          value={stats.totalListed}
          icon={<Tag size={18} className="text-green-400" />}
          isLoading={stats.isLoading}
        />
        <StatCard
          label="Volume (ETH)"
          value={stats.volumeETH}
          suffix="ETH"
          icon={<TrendingUp size={18} className="text-yellow-400" />}
          isLoading={stats.isLoading}
        />
      </div>
    </section>
  );
}
