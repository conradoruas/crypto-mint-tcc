"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Image as ImageIcon,
  Layers,
  User,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { formatEther } from "viem";
import { uploadMetadataToIPFS } from "@/services/pinata";
import {
  useCollectionDetails,
  useCollectionNFTs,
  useMintToCollection,
  CollectionNFTItem,
} from "@/hooks/useCollections";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

// ─── Card de NFT ───
function NFTCard({ nft }: { nft: CollectionNFTItem }) {
  return (
    <Link
      href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
      className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500 transition-all"
    >
      <div className="aspect-square relative bg-slate-800">
        {nft.image ? (
          <Image
            src={nft.image}
            alt={nft.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-slate-700" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-blue-400 font-medium mb-1">
          #{nft.tokenId.padStart(3, "0")}
        </p>
        <h3 className="font-bold text-sm truncate">{nft.name}</h3>
      </div>
    </Link>
  );
}

// ─── Modal de Mint ───
function MintModal({
  collectionAddress,
  mintPriceEth,
  onClose,
  onSuccess,
}: {
  collectionAddress: `0x${string}`;
  mintPriceEth: string;
  onClose: () => void;
  onSuccess: (hash: string) => void;
}) {
  const { address } = useConnection();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mint, isPending, isConfirming, hash } = useMintToCollection();

  const isLoading = isUploading || isPending || isConfirming;

  const handleMint = async () => {
    setError(null);
    if (!file || !name) {
      setError("Preencha o nome e selecione uma imagem.");
      return;
    }
    if (!address) {
      setError("Carteira não conectada.");
      return;
    }

    try {
      setIsUploading(true);
      const tokenUri = await uploadMetadataToIPFS(file, name, description);
      setIsUploading(false);
      await mint(collectionAddress, tokenUri, mintPriceEth, address);
      if (hash) onSuccess(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-8">
        <h2 className="text-2xl font-black mb-6">Mintar NFT</h2>

        <div className="space-y-4">
          {/* Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Imagem</label>
            <input
              type="file"
              id="mint-file"
              className="hidden"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="mint-file"
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer block transition-colors
                ${file ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-blue-500"}`}
            >
              <p className="text-sm text-slate-400">
                {file ? `✓ ${file.name}` : "Selecionar imagem"}
              </p>
            </label>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-2">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Nome do NFT"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium mb-2">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-24 outline-none text-white resize-none"
              placeholder="Descrição do NFT..."
            />
          </div>

          {/* Preço */}
          <div className="bg-slate-800 rounded-xl p-4 flex justify-between items-center">
            <span className="text-slate-400 text-sm">Preço de mint</span>
            <span className="font-bold">{mintPriceEth} ETH</span>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleMint}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Plus size={18} />
              )}
              {isUploading
                ? "Enviando..."
                : isPending
                  ? "Aguardando..."
                  : isConfirming
                    ? "Confirmando..."
                    : "Mintar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function CollectionPage() {
  const { address: collectionAddr } = useParams();
  const collectionAddress =
    (Array.isArray(collectionAddr) ? collectionAddr[0] : collectionAddr) ?? "";

  const { address: userAddress, isConnected } = useConnection();
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  const details = useCollectionDetails(collectionAddress);
  const {
    nfts,
    isLoading: isLoadingNFTs,
    totalSupply,
  } = useCollectionNFTs(collectionAddress);

  const isOwner =
    userAddress &&
    details.owner &&
    userAddress.toLowerCase() === details.owner.toLowerCase();

  const supplyPercent =
    details.maxSupply && details.totalSupply
      ? Number((details.totalSupply * BigInt(100)) / details.maxSupply)
      : 0;

  if (!details.name && !isLoadingNFTs) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <p className="text-center text-slate-400 py-20">
          Coleção não encontrada.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      {/* Hero da coleção */}
      <div className="relative">
        {/* Banner */}
        <div className="h-48 md:h-64 bg-gradient-to-br from-blue-900/40 to-purple-900/40 relative overflow-hidden">
          {details.image && (
            <Image
              src={resolveIpfsUrl(details.image)}
              alt={details.name ?? ""}
              fill
              className="object-cover opacity-30 blur-sm"
              sizes="100vw"
            />
          )}
        </div>

        {/* Avatar + Info */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6 -mt-12 relative z-10">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-slate-950 bg-slate-800 overflow-hidden shrink-0 relative">
              {details.image ? (
                <Image
                  src={resolveIpfsUrl(details.image)}
                  alt={details.name ?? ""}
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-slate-600" />
                </div>
              )}
            </div>

            {/* Detalhes */}
            <div className="flex-1 pt-2 md:pt-14">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-black">
                      {details.name ?? "—"}
                    </h1>
                    <span className="text-slate-500 text-sm font-mono bg-slate-800 px-2 py-0.5 rounded">
                      {details.symbol}
                    </span>
                  </div>
                  {details.description && (
                    <p className="text-slate-400 text-sm max-w-xl">
                      {details.description}
                    </p>
                  )}
                </div>

                {/* Botão de mint */}
                {isConnected && (
                  <button
                    onClick={() => setShowMintModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all whitespace-nowrap shrink-0"
                  >
                    <Plus size={18} /> Mintar NFT — {details.mintPriceEth} ETH
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 mb-10">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-xs mb-1">Mintados</p>
              <p className="text-2xl font-bold">{totalSupply}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-xs mb-1">Supply máximo</p>
              <p className="text-2xl font-bold">
                {details.maxSupply?.toString() ?? "—"}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-xs mb-1">Preço de mint</p>
              <p className="text-2xl font-bold">
                {details.mintPriceEth ?? "—"} ETH
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-xs mb-1">Criador</p>
              <div className="flex items-center gap-1.5 mt-1">
                {isOwner && (
                  <ShieldCheck size={14} className="text-green-500" />
                )}
                <p className="font-mono text-sm font-bold truncate">
                  {details.owner
                    ? `${details.owner.slice(0, 6)}...${details.owner.slice(-4)}`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de progresso do supply */}
          {details.maxSupply && details.maxSupply > 0 && (
            <div className="mb-10">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>{totalSupply} mintados</span>
                <span>{supplyPercent}% do supply</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${supplyPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid de NFTs */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            NFTs da Coleção
            {totalSupply > 0 && (
              <span className="ml-2 text-sm text-slate-500 font-normal">
                ({totalSupply})
              </span>
            )}
          </h2>
          <a
            href={`https://sepolia.etherscan.io/address/${collectionAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Ver contrato <ExternalLink size={12} />
          </a>
        </div>

        {isLoadingNFTs ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="aspect-square bg-slate-800 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-800 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl">
            <Layers size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 mb-4">
              Nenhum NFT mintado ainda nesta coleção.
            </p>
            {isConnected && (
              <button
                onClick={() => setShowMintModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
              >
                <Plus size={16} /> Ser o primeiro a mintar
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {nfts.map((nft) => (
              <NFTCard key={nft.tokenId} nft={nft} />
            ))}
          </div>
        )}
      </div>

      {/* Feedback de mint bem-sucedido */}
      {mintSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-500/10 border border-green-500 text-green-400 rounded-2xl p-4 flex items-center gap-3 shadow-xl z-40">
          <ShieldCheck size={20} />
          <div>
            <p className="font-bold text-sm">NFT Mintado!</p>
            <a
              href={`https://sepolia.etherscan.io/tx/${mintSuccess}`}
              target="_blank"
              className="text-xs underline"
            >
              Ver no Etherscan
            </a>
          </div>
          <button
            onClick={() => setMintSuccess(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal de Mint */}
      {showMintModal && details.mintPriceEth && (
        <MintModal
          collectionAddress={collectionAddress as `0x${string}`}
          mintPriceEth={details.mintPriceEth}
          onClose={() => setShowMintModal(false)}
          onSuccess={(hash) => {
            setShowMintModal(false);
            setMintSuccess(hash);
          }}
        />
      )}
    </main>
  );
}
