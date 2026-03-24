"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Navbar } from "@/components/NavBar";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  useCollectionDetails,
  useCollectionNFTs,
  useMintToCollection,
  CollectionNFTItem,
} from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

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
            sizes="(max-width: 640px) 50vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className="text-slate-700" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-blue-400 font-medium mb-1">
          #{nft.tokenId.padStart(3, "0")}
        </p>
        <h3 className="font-bold text-sm truncate">{nft.name}</h3>
      </div>
    </Link>
  );
}

// ─── Modal de Mint — só paga e recebe NFT aleatório ───
function MintModal({
  collectionAddress,
  mintPriceEth,
  urisLoaded,
  onClose,
  onSuccess,
}: {
  collectionAddress: `0x${string}`;
  mintPriceEth: string;
  urisLoaded: boolean;
  onClose: () => void;
  onSuccess: (hash: string) => void;
}) {
  const { address } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const { mint, isPending, isConfirming, isSuccess, hash } =
    useMintToCollection();

  useEffect(() => {
    if (isSuccess && hash) onSuccess(hash);
  }, [isSuccess, hash]);

  const handleMint = async () => {
    setError(null);
    if (!address) {
      setError("Carteira não conectada.");
      return;
    }
    if (!urisLoaded) {
      setError("Coleção ainda não preparada pelo criador.");
      return;
    }
    try {
      await mint(collectionAddress, mintPriceEth, address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-8 text-center">
        <h2 className="text-2xl font-black mb-2">Mintar NFT</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Você receberá um NFT <strong className="text-white">aleatório</strong>{" "}
          desta coleção.
        </p>

        <div className="bg-slate-800 rounded-2xl p-5 mb-6">
          <p className="text-slate-400 text-xs mb-1">Preço de mint</p>
          <p className="text-3xl font-black">{mintPriceEth} ETH</p>
        </div>

        {!urisLoaded && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-left">
            <AlertTriangle
              size={14}
              className="text-yellow-400 shrink-0 mt-0.5"
            />
            <p className="text-xs text-yellow-400">
              O criador ainda não finalizou o carregamento dos NFTs.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending || isConfirming}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleMint}
            disabled={isPending || isConfirming || !urisLoaded}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {isPending ? "Aguardando..." : "Confirmando..."}
              </>
            ) : (
              <>
                <Plus size={16} />
                Mintar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const { address: collectionAddr } = useParams();
  const collectionAddress =
    (Array.isArray(collectionAddr) ? collectionAddr[0] : collectionAddr) ?? "";

  const { address: userAddress, isConnected } = useAccount();
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  const details = useCollectionDetails(collectionAddress);
  const {
    nfts,
    isLoading: isLoadingNFTs,
    totalSupply,
  } = useCollectionNFTs(collectionAddress);

  const { data: urisLoadedData } = useReadContract({
    address: collectionAddress as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "urisLoaded",
    query: { enabled: !!collectionAddress },
  });
  const urisLoaded = urisLoadedData as boolean | undefined;

  const isOwner =
    userAddress &&
    details.owner &&
    userAddress.toLowerCase() === details.owner.toLowerCase();
  const supplyPercent =
    details.maxSupply && details.maxSupply > 0
      ? Number((BigInt(totalSupply) * BigInt(100)) / details.maxSupply)
      : 0;
  const isSoldOut =
    details.maxSupply && BigInt(totalSupply) >= details.maxSupply;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      {/* Banner */}
      <div className="relative">
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

            {/* Info */}
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
                  {isOwner && urisLoaded === false && (
                    <div className="flex items-center gap-2 mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 w-fit">
                      <AlertTriangle size={13} className="text-yellow-400" />
                      <span className="text-xs text-yellow-400">
                        NFTs ainda não carregados na blockchain
                      </span>
                    </div>
                  )}
                </div>

                {isConnected && !isSoldOut && (
                  <button
                    onClick={() => setShowMintModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all whitespace-nowrap shrink-0"
                  >
                    <Plus size={18} /> Mintar NFT — {details.mintPriceEth} ETH
                  </button>
                )}
                {isSoldOut && (
                  <div className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-sm font-bold shrink-0">
                    Supply Esgotado
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 mb-8">
            {[
              { label: "Mintados", value: totalSupply },
              {
                label: "Supply Máximo",
                value: details.maxSupply?.toString() ?? "—",
              },
              {
                label: "Preço de Mint",
                value: details.mintPriceEth
                  ? `${details.mintPriceEth} ETH`
                  : "—",
              },
              {
                label: "Criador",
                value: details.owner
                  ? `${details.owner.slice(0, 6)}...${details.owner.slice(-4)}`
                  : "—",
                showOwner: !!isOwner,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4"
              >
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <div className="flex items-center gap-1.5">
                  {s.showOwner && (
                    <ShieldCheck size={13} className="text-green-500" />
                  )}
                  <p className="text-xl font-bold font-mono">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Progresso */}
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
            {Array.from({ length: 8 }).map((_, i) => (
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
            {isConnected && !isSoldOut && urisLoaded && (
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

      {/* Toast */}
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

      {showMintModal && details.mintPriceEth && (
        <MintModal
          collectionAddress={collectionAddress as `0x${string}`}
          mintPriceEth={details.mintPriceEth}
          urisLoaded={urisLoaded ?? false}
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
