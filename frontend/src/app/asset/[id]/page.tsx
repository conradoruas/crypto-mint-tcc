"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/NavBar";
import { ShoppingCart, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { NFTItem } from "@/hooks/useExploreNfts";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS;
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
};

export default function AssetDetail() {
  const { id } = useParams();
  const [nft, setNft] = useState<NFTItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNFT = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${CONTRACT_ADDRESS}&tokenId=${id}&refreshCache=false`,
        );
        const data = await res.json();

        let image = data.image?.cachedUrl ?? data.image?.originalUrl ?? "";

        if (!image && data.tokenUri) {
          const metaRes = await fetch(resolveIpfsUrl(data.tokenUri));
          const meta = await metaRes.json();
          image = resolveIpfsUrl(meta.image ?? "");
        }

        setNft({
          tokenId: data.tokenId,
          name: data.name ?? `NFT #${id}`,
          description: data.description ?? "",
          image,
        });
      } catch (error) {
        console.error("Erro ao buscar NFT:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [id]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 aspect-square animate-pulse" />
          <div className="flex flex-col justify-center space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/3 animate-pulse" />
            <div className="h-10 bg-slate-800 rounded w-2/3 animate-pulse" />
            <div className="h-40 bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (!nft) {
    return (
      <main className="min-h-screen bg-slate-950">
        <Navbar />
        <p className="text-center text-slate-400 py-20">NFT não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Lado Esquerdo: Imagem */}
        <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 aspect-square relative">
          {nft.image ? (
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-slate-700">
              Sem imagem
            </div>
          )}
        </div>

        {/* Lado Direito: Informações */}
        <div className="flex flex-col justify-center">
          <p className="text-blue-500 font-bold mb-2 uppercase tracking-widest text-sm">
            Coleção TCC #{nft.tokenId.padStart(3, "0")}
          </p>
          <h1 className="text-5xl font-black mb-4">{nft.name}</h1>
          {nft.description && (
            <p className="text-slate-400 mb-6">{nft.description}</p>
          )}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
            <p className="text-slate-400 mb-1">Preço Atual</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">0.0001 ETH</span>
            </div>
            <button className="w-full mt-6 bg-white text-black hover:bg-slate-200 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all">
              <ShoppingCart size={20} /> Comprar Agora
            </button>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <ShieldCheck className="text-green-500" />
            <span>Propriedade verificada na blockchain</span>
          </div>
        </div>
      </div>
    </main>
  );
}
