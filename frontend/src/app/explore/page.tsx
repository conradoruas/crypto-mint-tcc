"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionNFTs } from "@/hooks/useCollections";
import { useExploreNFTs } from "@/hooks/useExploreNfts";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, Layers } from "lucide-react";
import { formatEther } from "viem";
import { useState } from "react";

// ─── Opção A: Explorer mostra NFTs de TODAS as coleções da factory ───
// O usuário pode filtrar por coleção usando o seletor no topo

function CollectionFilter({
  collections,
  selected,
  onSelect,
}: {
  collections: { contractAddress: string; name: string }[];
  selected: string;
  onSelect: (addr: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap mb-8">
      {collections.map((c) => (
        <button
          key={c.contractAddress}
          onClick={() => onSelect(c.contractAddress)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            selected === c.contractAddress
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState<string>("");

  // Seleciona a primeira coleção automaticamente quando carregadas
  const activeCollection =
    selectedCollection ||
    (collections.length > 0 ? collections[0].contractAddress : "");

  const { nfts, isLoading: isLoadingNFTs } = useExploreNFTs(
    activeCollection || undefined,
  );

  const isLoading = isLoadingCollections || isLoadingNFTs;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Explorar NFTs</h2>
          <Link
            href="/collections"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Layers size={16} />
            Ver todas as coleções
          </Link>
        </div>

        {/* Filtro de coleções */}
        {!isLoadingCollections && collections.length > 0 && (
          <CollectionFilter
            collections={collections.map((c) => ({
              contractAddress: c.contractAddress,
              name: c.name,
            }))}
            selected={activeCollection}
            onSelect={setSelectedCollection}
          />
        )}

        {/* Grid de NFTs */}
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              // ✅ Passa nftContract via query param
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
                </div>
                <div className="p-4">
                  <p className="text-xs text-blue-400 font-medium mb-1">
                    #{nft.tokenId.padStart(3, "0")}
                  </p>
                  <h3 className="font-bold mb-3">{nft.name}</h3>
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
