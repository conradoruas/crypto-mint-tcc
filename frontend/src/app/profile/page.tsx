"use client";

import { useAccount } from "wagmi"; // ✅ corrigido: era useConnection
import { Navbar } from "@/components/NavBar";
import {
  useProfileNFTs,
  useCollections,
  CollectionNFTItem,
} from "@/hooks/useCollections"; // ✅ importa de useCollections
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatEther } from "viem";

export default function ProfilePage() {
  const { address, isConnected } = useAccount(); // ✅ corrigido
  const { collections, isLoading: isLoadingCollections } = useCollections();

  // Na Opção A, o perfil mostra NFTs de TODAS as coleções do usuário
  // O seletor permite filtrar por coleção
  const [selectedCollection, setSelectedCollection] = useState<string>("");

  const activeCollection =
    selectedCollection ||
    (collections.length > 0 ? collections[0].contractAddress : "");

  // ✅ usa useProfileNFTs de useCollections (não de useProfileNFTs separado)
  const { nfts, isLoading: isLoadingNFTs } = useProfileNFTs(
    address,
    activeCollection || undefined,
  );

  const isLoading = isLoadingCollections || isLoadingNFTs;

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
        {/* Header */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 mb-8">
          <p className="text-slate-400 text-sm mb-2">Carteira Conectada</p>
          <h2 className="text-xl font-mono font-bold break-all">{address}</h2>
          <p className="text-slate-500 text-sm mt-2">
            {isLoading
              ? "Carregando..."
              : `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""} encontrado${nfts.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Filtro de coleções */}
        {!isLoadingCollections && collections.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-8">
            {collections.map((c) => (
              <button
                key={c.contractAddress}
                onClick={() => setSelectedCollection(c.contractAddress)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeCollection === c.contractAddress
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
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
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">
              {collections.length === 0
                ? "Nenhuma coleção existe ainda."
                : "Você não possui NFTs nesta coleção."}
            </p>
            <Link
              href="/create"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold transition-all"
            >
              {collections.length === 0 ? "Criar Coleção" : "Mintar um NFT"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nfts.map((nft: CollectionNFTItem) => (
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
                  <h3 className="font-bold">{nft.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
