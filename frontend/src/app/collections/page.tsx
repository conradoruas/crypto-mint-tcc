"use client";

import { Navbar } from "@/components/NavBar";
import { useCollections, CollectionInfo } from "@/hooks/useCollections";
import Image from "next/image";
import Link from "next/link";
import { formatEther } from "viem";
import { Plus, Image as ImageIcon, Users, Layers } from "lucide-react";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

function CollectionCard({ collection }: { collection: CollectionInfo }) {
  const image = resolveIpfsUrl(collection.image);
  const mintPriceEth = formatEther(collection.mintPrice);

  return (
    <Link
      href={`/collections/${collection.contractAddress}`}
      className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500 transition-all"
    >
      {/* Imagem da coleção */}
      <div className="aspect-video relative bg-slate-800 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={collection.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={40} className="text-slate-700" />
          </div>
        )}
        {/* Badge de supply */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-xs text-slate-300 px-2 py-1 rounded-lg">
          {collection.maxSupply.toString()} max
        </div>
      </div>

      {/* Informações */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {collection.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {collection.symbol}
            </p>
          </div>
          <span className="text-sm font-bold text-blue-400 whitespace-nowrap ml-2">
            {mintPriceEth} ETH
          </span>
        </div>

        {collection.description && (
          <p className="text-slate-400 text-sm line-clamp-2 mb-4">
            {collection.description}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users size={12} />
            <span className="font-mono">
              {collection.creator.slice(0, 6)}...{collection.creator.slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Layers size={12} />
            <span>
              {new Date(Number(collection.createdAt) * 1000).toLocaleDateString(
                "pt-BR",
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="aspect-video bg-slate-800 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-slate-800 rounded animate-pulse w-2/3" />
        <div className="h-3 bg-slate-800 rounded animate-pulse w-full" />
        <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2 mt-4" />
      </div>
    </div>
  );
}

export default function CollectionsPage() {
  const { collections, isLoading } = useCollections();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-black mb-2">Coleções</h1>
            <p className="text-slate-400">
              {isLoading
                ? "Carregando..."
                : `${collections.length} coleção${collections.length !== 1 ? "ões" : ""} criada${collections.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/collections/create"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all"
          >
            <Plus size={18} />
            Nova Coleção
          </Link>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-3xl">
            <Layers size={48} className="text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Nenhuma coleção ainda</h2>
            <p className="text-slate-400 mb-6">
              Seja o primeiro a criar uma coleção de NFTs.
            </p>
            <Link
              href="/collections/create"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              <Plus size={18} /> Criar Primeira Coleção
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.contractAddress}
                collection={collection}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
