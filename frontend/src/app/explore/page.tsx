"use client";

import { Navbar } from "@/components/NavBar";
import { useExploreNFTs } from "@/hooks/useExploreNfts";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

export default function ExplorePage() {
  const { nfts, isLoading } = useExploreNFTs();

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Explorar Coleções</h2>
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
        ) : nfts.length === 0 ? (
          <p className="text-slate-400 text-center py-20">
            Nenhum NFT mintado ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <Link
                href={`/asset/${nft.tokenId}`}
                key={nft.tokenId}
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
                    Coleção TCC #{nft.tokenId.padStart(3, "0")}
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
