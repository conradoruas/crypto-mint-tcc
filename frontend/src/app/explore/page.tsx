"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections } from "@/hooks/useCollections";
import { useExploreAllNFTs, NFTItemWithMarket } from "@/hooks/useExploreNfts";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, Layers, Search, SlidersHorizontal, X } from "lucide-react";
import { useState, useMemo } from "react";

// ─────────────────────────────────────────────
// Tipos de ordenação
// ─────────────────────────────────────────────

type SortOption =
  | "default"
  | "price_asc"
  | "price_desc"
  | "offer_desc"
  | "listed_first"
  | "id_asc"
  | "id_desc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Padrão",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  offer_desc: "Maior oferta",
  listed_first: "Listados primeiro",
  id_asc: "ID crescente",
  id_desc: "ID decrescente",
};

// ─────────────────────────────────────────────
// Funções de filtro e ordenação
// ─────────────────────────────────────────────

function filterNFTs(
  nfts: NFTItemWithMarket[],
  search: string,
  onlyListed: boolean,
): NFTItemWithMarket[] {
  return nfts.filter((nft) => {
    const matchSearch =
      search.trim() === "" ||
      nft.name.toLowerCase().includes(search.toLowerCase()) ||
      nft.tokenId.includes(search.trim());

    const matchListed = !onlyListed || !!nft.listingPrice;

    return matchSearch && matchListed;
  });
}

function sortNFTs(
  nfts: NFTItemWithMarket[],
  sort: SortOption,
): NFTItemWithMarket[] {
  const sorted = [...nfts];

  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => {
        if (!a.listingPrice && !b.listingPrice) return 0;
        if (!a.listingPrice) return 1;
        if (!b.listingPrice) return -1;
        return parseFloat(a.listingPrice) - parseFloat(b.listingPrice);
      });

    case "price_desc":
      return sorted.sort((a, b) => {
        if (!a.listingPrice && !b.listingPrice) return 0;
        if (!a.listingPrice) return 1;
        if (!b.listingPrice) return -1;
        return parseFloat(b.listingPrice) - parseFloat(a.listingPrice);
      });

    case "offer_desc":
      return sorted.sort((a, b) => {
        if (!a.topOffer && !b.topOffer) return 0;
        if (!a.topOffer) return 1;
        if (!b.topOffer) return -1;
        return parseFloat(b.topOffer) - parseFloat(a.topOffer);
      });

    case "listed_first":
      return sorted.sort((a, b) => {
        if (!!a.listingPrice === !!b.listingPrice) return 0;
        return a.listingPrice ? -1 : 1;
      });

    case "id_asc":
      return sorted.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));

    case "id_desc":
      return sorted.sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));

    default:
      return sorted;
  }
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ExplorePage() {
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [onlyListed, setOnlyListed] = useState(false);

  const activeCollection = selectedCollection;

  const { nfts, isLoading: isLoadingNFTs } = useExploreAllNFTs(
    activeCollection || undefined,
  );
  const isLoading = isLoadingCollections || isLoadingNFTs;

  // Aplica filtro e ordenação apenas no frontend — sem chamadas extras
  const displayedNFTs = useMemo(() => {
    const filtered = filterNFTs(nfts, search, onlyListed);
    return sortNFTs(filtered, sort);
  }, [nfts, search, onlyListed, sort]);

  const hasActiveFilters = search !== "" || sort !== "default" || onlyListed;

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setOnlyListed(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">Explorar NFTs</h2>
          </div>
          <Link
            href="/collections"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Layers size={16} />
            Ver coleções
          </Link>
        </div>

        {/* ─── Filtro de coleções ─── */}
        {!isLoadingCollections && collections.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-l text-slate-400">Coleções</h2>
              <span className="text-xs text-slate-600">
                {collections.length} coleç
                {collections.length !== 1 ? "ões" : "ão"}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCollection("")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedCollection === ""
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                Todas
              </button>
              {collections.map((c) => (
                <button
                  key={c.contractAddress}
                  onClick={() => setSelectedCollection(c.contractAddress)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedCollection === c.contractAddress
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Barra de busca + controles ─── */}
        {!isLoading && nfts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Campo de busca */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou ID..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-600"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Ordenação */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none min-w-[160px]"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>

            {/* Toggle: só listados */}
            <button
              onClick={() => setOnlyListed((v) => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                onlyListed
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600"
              }`}
            >
              <SlidersHorizontal size={14} />
              Só à venda
            </button>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all whitespace-nowrap"
              >
                <X size={14} />
                Limpar
              </button>
            )}
          </div>
        )}

        {/* ─── Conteúdo ─── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="aspect-square bg-slate-800 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-800 rounded animate-pulse w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-3xl">
            <Layers size={48} className="text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              Nenhuma coleção criada ainda
            </h2>
            <p className="text-slate-400 mb-6">
              Crie uma coleção para começar a mintar NFTs.
            </p>
            <Link
              href="/collections/create"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Criar Coleção
            </Link>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">
              Nenhum NFT mintado nesta coleção ainda.
            </p>
            <Link
              href={`/collections/${activeCollection}`}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              Mintar na coleção
            </Link>
          </div>
        ) : displayedNFTs.length === 0 ? (
          // Nenhum resultado para os filtros aplicados
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl">
            <Search size={40} className="text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">
              Nenhum resultado encontrado
            </h3>
            <p className="text-slate-400 mb-6 text-sm">
              Tente buscar por outro nome ou ajustar os filtros.
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 font-medium px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              <X size={14} /> Limpar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedNFTs.map((nft) => (
              <Link
                href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
                key={`${nft.nftContract}-${nft.tokenId}`}
                className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500 transition-all cursor-pointer"
              >
                <div className="aspect-square relative bg-slate-800">
                  {nft.image ? (
                    <Image
                      src={nft.image}
                      alt={nft.name}
                      fill
                      loading="eager"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-slate-800" />
                  )}
                  {/* Badge "À venda" */}
                  {nft.listingPrice && (
                    <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      À venda
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-blue-400 font-medium mb-1">
                    #{nft.tokenId.padStart(3, "0")}
                  </p>
                  <h3 className="font-bold mb-3 truncate">{nft.name}</h3>
                  <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Preço</p>
                      {nft.listingPrice ? (
                        <span className="font-bold text-white text-sm">
                          {nft.listingPrice} ETH
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Não listado
                        </span>
                      )}
                    </div>
                    {nft.topOffer && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-0.5">
                          Maior oferta
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          <TrendingUp size={11} className="text-yellow-400" />
                          <span className="text-yellow-400 font-bold text-sm">
                            {nft.topOffer} ETH
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
