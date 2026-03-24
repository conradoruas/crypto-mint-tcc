"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Navbar } from "@/components/NavBar";
import { Loader2, Plus, Layers, ShieldCheck } from "lucide-react";
import { useCollections, useMintToCollection } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { formatEther } from "viem";
import Image from "next/image";
import Link from "next/link";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

function CollectionOption({
  collection,
  selected,
  onSelect,
}: {
  collection: {
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    mintPrice: bigint;
    maxSupply: bigint;
    totalSupply?: bigint;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: urisLoaded } = useReadContract({
    address: collection.contractAddress as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "urisLoaded",
  });

  const isSoldOut =
    collection.totalSupply !== undefined &&
    collection.totalSupply >= collection.maxSupply;
  const unavailable = isSoldOut || !urisLoaded;
  const image = resolveIpfsUrl(collection.image);

  return (
    <button
      onClick={onSelect}
      disabled={unavailable}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : unavailable
            ? "border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed"
            : "border-slate-800 bg-slate-900 hover:border-slate-600 cursor-pointer"
      }`}
    >
      <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 relative">
        {image ? (
          <Image
            src={image}
            alt={collection.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full bg-slate-700" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold truncate">{collection.name}</p>
          <span className="text-xs text-slate-500 font-mono shrink-0">
            {collection.symbol}
          </span>
        </div>
        <p className="text-sm text-blue-400 font-bold mt-0.5">
          {formatEther(collection.mintPrice)} ETH
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {collection.totalSupply?.toString() ?? "?"} /{" "}
          {collection.maxSupply.toString()} mintados
          {isSoldOut && <span className="text-red-400 ml-1">· Esgotado</span>}
          {!urisLoaded && !isSoldOut && (
            <span className="text-yellow-400 ml-1">· Não disponível</span>
          )}
        </p>
      </div>
      {selected && <ShieldCheck size={20} className="text-blue-400 shrink-0" />}
    </button>
  );
}

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const { collections, isLoading: isLoadingCollections } = useCollections();
  const [selectedCollection, setSelectedCollection] = useState("");
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mint, isPending, isConfirming, isSuccess, hash } =
    useMintToCollection();

  const chosen = collections.find(
    (c) => c.contractAddress === selectedCollection,
  );

  if (isSuccess && hash && !mintSuccess) setMintSuccess(hash);

  const handleMint = async () => {
    setError(null);
    if (!address || !selectedCollection || !chosen) {
      setError("Selecione uma coleção e conecte sua carteira.");
      return;
    }
    try {
      await mint(
        selectedCollection as `0x${string}`,
        formatEther(chosen.mintPrice),
        address,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    }
  };

  // ─── Tela de sucesso ───
  if (mintSuccess) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={36} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">NFT Mintado!</h1>
          <p className="text-slate-400 mb-6">
            Seu NFT aleatório foi mintado com sucesso.
          </p>
          <a
            href={`https://sepolia.etherscan.io/tx/${mintSuccess}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-sm block mb-8"
          >
            Ver transação no Etherscan
          </a>
          <div className="flex gap-4 justify-center">
            <Link
              href="/profile"
              className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Ver meu perfil
            </Link>
            <button
              onClick={() => {
                setMintSuccess(null);
                setSelectedCollection("");
              }}
              className="bg-slate-800 hover:bg-slate-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Mintar outro
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-black mb-2">Mintar NFT</h1>
        <p className="text-slate-400 mb-10">
          Escolha uma coleção e receba um NFT{" "}
          <strong className="text-white">aleatório</strong> dos disponíveis.
        </p>

        <div className="space-y-6">
          {/* ─── Seleção de coleção ─── */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Layers size={18} className="text-blue-400" />
              Escolha uma coleção
            </h2>

            {isLoadingCollections ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-slate-800 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-700 rounded-2xl">
                <p className="text-slate-400 text-sm mb-4">
                  Nenhuma coleção disponível.
                </p>
                <Link
                  href="/collections/create"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  <Plus size={14} /> Criar coleção
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {collections.map((c) => (
                  <CollectionOption
                    key={c.contractAddress}
                    collection={c}
                    selected={selectedCollection === c.contractAddress}
                    onSelect={() => setSelectedCollection(c.contractAddress)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── Resumo ─── */}
          {chosen && (
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-3">
              <h2 className="font-bold">Resumo</h2>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Coleção</span>
                <span className="font-medium">{chosen.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">NFT recebido</span>
                <span className="font-medium text-slate-300">Aleatório 🎲</span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-black text-blue-400">
                  {formatEther(chosen.mintPrice)} ETH
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          <button
            onClick={handleMint}
            disabled={
              isPending || isConfirming || !isConnected || !selectedCollection
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-white"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {isPending ? "Aguardando MetaMask..." : "Confirmando..."}
              </>
            ) : (
              <>
                <Plus size={20} />
                {chosen
                  ? `Mintar NFT Aleatório — ${formatEther(chosen.mintPrice)} ETH`
                  : "Mintar NFT"}
              </>
            )}
          </button>

          {!isConnected && (
            <p className="text-center text-slate-500 text-sm">
              Conecte sua carteira para mintar
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
