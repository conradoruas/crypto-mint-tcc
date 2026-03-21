"use client";

import { Navbar } from "@/components/NavBar";
import {
  useActivityFeed,
  ActivityEvent,
  ActivityType,
} from "@/hooks/useActivityFeed";
import { useCollections } from "@/hooks/useCollections";
import Link from "next/link";
import { useState } from "react";
import {
  ShoppingCart,
  Tag,
  X,
  HandCoins,
  CheckCircle,
  Sparkles,
  Activity,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

// ─────────────────────────────────────────────
// Configuração visual por tipo de evento
// ─────────────────────────────────────────────

const EVENT_CONFIG: Record<
  ActivityType,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
  }
> = {
  sale: {
    label: "Venda",
    icon: <ShoppingCart size={14} />,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  listing: {
    label: "Listagem",
    icon: <Tag size={14} />,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  listing_cancelled: {
    label: "Listagem Cancelada",
    icon: <X size={14} />,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  offer: {
    label: "Oferta",
    icon: <HandCoins size={14} />,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  offer_accepted: {
    label: "Oferta Aceita",
    icon: <CheckCircle size={14} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  offer_cancelled: {
    label: "Oferta Cancelada",
    icon: <X size={14} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  mint: {
    label: "Mint",
    icon: <Sparkles size={14} />,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
};

const ALL_TYPES = Object.keys(EVENT_CONFIG) as ActivityType[];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "—";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// ─────────────────────────────────────────────
// Card de evento
// ─────────────────────────────────────────────

function EventRow({
  event,
  collectionName,
}: {
  event: ActivityEvent;
  collectionName?: string;
}) {
  const cfg = EVENT_CONFIG[event.type];

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border ${cfg.border} ${cfg.bg} hover:brightness-110 transition-all`}
    >
      {/* Ícone do tipo */}
      <div
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${cfg.color} bg-slate-900/60`}
      >
        {cfg.icon}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}
          >
            {cfg.label}
          </span>
          {collectionName && (
            <span className="text-xs text-slate-500 font-medium">
              {collectionName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm mt-0.5 flex-wrap">
          {/* Descrição por tipo */}
          {event.type === "sale" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">vendeu para</span>
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.to ?? "")}
              </span>
              <span className="text-slate-500 mx-1">·</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "listing" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">listou</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "listing_cancelled" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">cancelou listagem de</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "offer" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">ofertou em</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "offer_accepted" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">aceitou oferta de</span>
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.to ?? "")}
              </span>
              <span className="text-slate-500 mx-1">em</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "offer_cancelled" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">cancelou oferta em</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
          {event.type === "mint" && (
            <p className="text-slate-300">
              <span className="font-mono text-xs text-slate-500">
                {shortAddr(event.from)}
              </span>
              <span className="text-slate-500 mx-1">mintou</span>
              <Link
                href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                className="text-white hover:text-blue-400 font-medium transition-colors"
              >
                #{event.tokenId.padStart(3, "0")}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Preço */}
      {event.priceETH && (
        <div className="text-right shrink-0">
          <p className={`font-bold text-sm ${cfg.color}`}>
            {parseFloat(event.priceETH).toFixed(4)} ETH
          </p>
        </div>
      )}

      {/* Timestamp + Etherscan */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-xs text-slate-500">{formatTime(event.timestamp)}</p>
        <a
          href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-600 hover:text-slate-400 transition-colors inline-flex items-center gap-0.5 text-xs mt-0.5"
        >
          tx <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
      <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-800 rounded animate-pulse w-1/4" />
        <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
      </div>
      <div className="h-4 bg-slate-800 rounded animate-pulse w-16 hidden sm:block" />
      <div className="h-4 bg-slate-800 rounded animate-pulse w-12 hidden sm:block" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ActivityPage() {
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  const { events, isLoading } = useActivityFeed(
    selectedCollection || undefined,
    100,
  );

  // Filtro por tipo no frontend
  const displayedEvents =
    selectedTypes.length === 0
      ? events
      : events.filter((e) => selectedTypes.includes(e.type));

  const toggleType = (type: ActivityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const collectionName = (addr: string) =>
    collections.find(
      (c) => c.contractAddress.toLowerCase() === addr.toLowerCase(),
    )?.name;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Activity size={18} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Atividade</h1>
        </div>
        <p className="text-slate-400 text-sm mb-10 ml-[52px]">
          Histórico de eventos on-chain dos últimos 7 dias
        </p>

        {/* ─── Filtros ─── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Filtro de coleção */}
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer flex-1"
          >
            <option value="">Todas as coleções</option>
            {collections.map((c) => (
              <option key={c.contractAddress} value={c.contractAddress}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Filtro de tipo */}
          <div className="relative">
            <button
              onClick={() => setShowTypeFilter((v) => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border transition-all w-full sm:w-auto justify-between ${
                selectedTypes.length > 0
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {selectedTypes.length > 0
                ? `${selectedTypes.length} tipo${selectedTypes.length > 1 ? "s" : ""}`
                : "Tipo de evento"}
              <ChevronDown
                size={14}
                className={`transition-transform ${showTypeFilter ? "rotate-180" : ""}`}
              />
            </button>

            {showTypeFilter && (
              <div className="absolute top-full mt-2 right-0 z-20 bg-slate-900 border border-slate-800 rounded-2xl p-3 w-56 shadow-xl">
                {ALL_TYPES.map((type) => {
                  const cfg = EVENT_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        selectedTypes.includes(type)
                          ? `${cfg.bg} ${cfg.color}`
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <span className={cfg.color}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  );
                })}
                {selectedTypes.length > 0 && (
                  <button
                    onClick={() => setSelectedTypes([])}
                    className="w-full mt-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Contador ─── */}
        {!isLoading && (
          <p className="text-xs text-slate-500 mb-4">
            {displayedEvents.length === events.length
              ? `${events.length} evento${events.length !== 1 ? "s" : ""}`
              : `${displayedEvents.length} de ${events.length} eventos`}
          </p>
        )}

        {/* ─── Lista de eventos ─── */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : displayedEvents.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl">
              <Activity size={40} className="text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">
                Nenhuma atividade encontrada
              </h3>
              <p className="text-slate-400 text-sm">
                {selectedTypes.length > 0 || selectedCollection
                  ? "Tente ajustar os filtros."
                  : "Nenhum evento nos últimos 7 dias."}
              </p>
            </div>
          ) : (
            displayedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                collectionName={collectionName(event.nftContract)}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
