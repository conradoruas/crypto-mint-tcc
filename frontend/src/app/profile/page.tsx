"use client";

import { useAccount } from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  useProfileNFTs,
  useCollections,
  CollectionNFTItem,
} from "@/hooks/useCollections";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  Pencil,
  User,
  ExternalLink,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { fetchProfile, UserProfile } from "@/services/profile";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

// ─────────────────────────────────────────────
// Tipos de ordenação
// ─────────────────────────────────────────────

type SortOption = "default" | "id_asc" | "id_desc" | "name_asc" | "name_desc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Padrão",
  id_asc: "ID crescente",
  id_desc: "ID decrescente",
  name_asc: "Nome A→Z",
  name_desc: "Nome Z→A",
};

// ─────────────────────────────────────────────
// Filtro e ordenação
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────

function ProfileAvatar({
  imageUri,
  name,
  size = 96,
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
        className="relative rounded-full overflow-hidden bg-slate-700 shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src={resolveIpfsUrl(imageUri)}
          alt={name ?? "Perfil"}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { collections, isLoading: isLoadingCollections } = useCollections();

  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Busca e ordenação
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");

  const { nfts, isLoading: isLoadingNFTs } = useProfileNFTs(
    address,
    selectedCollection || undefined,
  );

  const isLoading = isLoadingCollections || isLoadingNFTs;

  const displayedNFTs = useMemo(
    () => filterAndSort(nfts, search, sort),
    [nfts, search, sort],
  );

  const hasActiveFilters = search !== "" || sort !== "default";

  const clearFilters = () => {
    setSearch("");
    setSort("default");
  };

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      setIsLoadingProfile(true);
      const p = await fetchProfile(address);
      setProfile(p);
      setIsLoadingProfile(false);
    };
    load();
  }, [address]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="text-center py-20 text-slate-400">
          Conecte sua carteira para ver seu perfil.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* ─── Header do perfil ─── */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {isLoadingProfile ? (
              <div className="w-24 h-24 rounded-full bg-slate-800 animate-pulse shrink-0" />
            ) : (
              <ProfileAvatar
                imageUri={profile?.imageUri}
                name={profile?.name}
                size={96}
              />
            )}

            <div className="flex-1 min-w-0">
              {isLoadingProfile ? (
                <div className="h-7 bg-slate-800 rounded animate-pulse w-40 mb-2" />
              ) : (
                <h2 className="text-xl font-bold mb-1">
                  {profile?.name || (
                    <span className="text-slate-500 italic font-normal">
                      Sem nome
                    </span>
                  )}
                </h2>
              )}

              <div className="flex items-center gap-2">
                <p className="text-slate-400 text-sm font-mono truncate">
                  {address}
                </p>
                <a
                  href={`https://sepolia.etherscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                >
                  <ExternalLink size={13} />
                </a>
              </div>

              <p className="text-slate-500 text-sm mt-1">
                {isLoading
                  ? "Carregando..."
                  : displayedNFTs.length === nfts.length
                    ? `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""}${selectedCollection ? " nesta coleção" : " no total"}`
                    : `${displayedNFTs.length} de ${nfts.length} NFTs`}
              </p>
            </div>

            <Link
              href="/profile/edit"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all text-sm shrink-0"
            >
              <Pencil size={14} />
              Editar Perfil
            </Link>
          </div>
        </div>

        {/* ─── Filtro de coleções ─── */}
        {!isLoadingCollections && collections.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
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
        )}

        {/* ─── Busca e ordenação ─── */}
        {!isLoading && nfts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Busca */}
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
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600"
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

        {/* ─── Grid de NFTs ─── */}
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
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20">
            <User size={48} className="text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">
              {selectedCollection
                ? "Você não possui NFTs nesta coleção."
                : collections.length === 0
                  ? "Nenhuma coleção existe ainda."
                  : "Você não possui nenhum NFT."}
            </p>
          </div>
        ) : displayedNFTs.length === 0 ? (
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
            {displayedNFTs.map((nft: CollectionNFTItem) => (
              <Link
                href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
                key={`${nft.nftContract}-${nft.tokenId}`}
                className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500 transition-all"
              >
                <div className="aspect-square relative bg-slate-800">
                  {nft.image ? (
                    <Image
                      src={nft.image}
                      alt={nft.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-slate-800" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-blue-400 font-medium mb-1">
                    #{nft.tokenId.padStart(3, "0")}
                  </p>
                  <h3 className="font-bold truncate">{nft.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
