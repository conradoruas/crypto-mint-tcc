"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
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
  X,
} from "lucide-react";
import {
  useCollectionDetails,
  useCollectionNFTs,
  useMintToCollection,
  CollectionNFTItem,
} from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import Footer from "@/components/Footer";

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
      className="hud-corners group overflow-hidden transition-all"
      style={{ background: "#111111", border: "1px solid #222222" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.borderColor = "#FAFF0040")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.borderColor = "#222222")
      }
    >
      <div className="aspect-square relative" style={{ background: "#222222" }}>
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
            <ImageIcon size={28} style={{ color: "#333333" }} />
          </div>
        )}
      </div>
      <div className="p-3">
        <p
          className="text-xs font-bold mb-1 uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-mono), monospace",
            color: "#FAFF00",
          }}
        >
          #{nft.tokenId.padStart(3, "0")}
        </p>
        <h3 className="font-bold text-sm truncate">{nft.name}</h3>
      </div>
    </Link>
  );
}

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
  const { address } = useConnection();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm p-8 text-center"
        style={{ background: "#111111", border: "1px solid #333333" }}
      >
        <h2
          className="text-2xl font-black mb-2"
          style={{ fontFamily: "var(--font-space), sans-serif" }}
        >
          Mintar NFT
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "#777" }}>
          Você receberá um NFT{" "}
          <strong style={{ color: "#e8e8e8" }}>aleatório</strong> desta coleção.
        </p>

        <div
          className="p-5 mb-6"
          style={{ background: "#222222", border: "1px solid #222222" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-1"
            style={{
              fontFamily: "var(--font-mono), monospace",
              color: "#444",
            }}
          >
            Preço de mint
          </p>
          <p
            className="text-3xl font-black"
            style={{
              fontFamily: "var(--font-space), sans-serif",
              color: "#FAFF00",
            }}
          >
            {mintPriceEth} ETH
          </p>
        </div>

        {!urisLoaded && (
          <div
            className="flex items-start gap-2 p-3 mb-4 text-left"
            style={{
              background: "rgba(255,215,0,0.05)",
              border: "1px solid rgba(255,215,0,0.2)",
            }}
          >
            <AlertTriangle
              size={13}
              style={{ color: "#ffd700" }}
              className="shrink-0 mt-0.5"
            />
            <p
              className="text-xs"
              style={{
                fontFamily: "var(--font-mono), monospace",
                color: "#ffd700",
              }}
            >
              O criador ainda não finalizou o carregamento dos NFTs.
            </p>
          </div>
        )}

        {error && (
          <div
            className="text-sm p-3 mb-4"
            style={{
              fontFamily: "var(--font-mono), monospace",
              background: "rgba(255,45,85,0.05)",
              border: "1px solid rgba(255,45,85,0.3)",
              color: "#ff2d55",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending || isConfirming}
            className="flex-1 font-bold py-3 transition-all"
            style={{
              background: "transparent",
              border: "1px solid #333333",
              color: "#777",
              cursor: isPending || isConfirming ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleMint}
            disabled={isPending || isConfirming || !urisLoaded}
            className="flex-1 font-bold py-3 flex items-center justify-center gap-2 transition-all"
            style={{
              background:
                isPending || isConfirming || !urisLoaded
                  ? "#222222"
                  : "#FAFF00",
              color:
                isPending || isConfirming || !urisLoaded ? "#444" : "#0A0A0A",
              cursor:
                isPending || isConfirming || !urisLoaded
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                {isPending ? "Aguardando..." : "Confirmando..."}
              </>
            ) : (
              <>
                <Plus size={14} />
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

  const { address: userAddress, isConnected } = useConnection();
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
    <div>
      <main
        style={{ minHeight: "100vh", background: "#0A0A0A", color: "#e8e8e8" }}
      >
        <Navbar />

        {/* Banner */}
        <div className="relative">
          <div
            className="h-48 md:h-64 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(250,255,0,0.08), rgba(191,90,242,0.08))",
            }}
          >
            {details.image && (
              <Image
                src={resolveIpfsUrl(details.image)}
                alt={details.name ?? ""}
                fill
                className="object-cover opacity-20 blur-sm"
                sizes="100vw"
              />
            )}
            {/* Scanlines overlay */}
            <div className="scanlines absolute inset-0 pointer-events-none" />
          </div>

          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-6 -mt-12 relative z-10">
              {/* Avatar */}
              <div
                className="w-24 h-24 md:w-32 md:h-32 overflow-hidden shrink-0 relative"
                style={{
                  border: "2px solid #0A0A0A",
                  outline: "1px solid #333333",
                  background: "#222222",
                }}
              >
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
                    <ImageIcon size={32} style={{ color: "#333333" }} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 pt-2 md:pt-14">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1
                        className="text-3xl font-black"
                        style={{ fontFamily: "var(--font-space), sans-serif" }}
                      >
                        {details.name ?? "—"}
                      </h1>
                      <span
                        className="text-sm px-2 py-0.5"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          background: "#222222",
                          border: "1px solid #222222",
                          color: "#444",
                        }}
                      >
                        {details.symbol}
                      </span>
                    </div>
                    {details.description && (
                      <p className="text-sm max-w-xl" style={{ color: "#777" }}>
                        {details.description}
                      </p>
                    )}
                    {isOwner && urisLoaded === false && (
                      <div
                        className="flex items-center gap-2 mt-2 px-3 py-2 w-fit"
                        style={{
                          background: "rgba(255,215,0,0.05)",
                          border: "1px solid rgba(255,215,0,0.2)",
                        }}
                      >
                        <AlertTriangle size={12} style={{ color: "#ffd700" }} />
                        <span
                          className="text-xs"
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            color: "#ffd700",
                          }}
                        >
                          NFTs ainda não carregados na blockchain
                        </span>
                      </div>
                    )}
                  </div>

                  {isConnected && !isSoldOut && (
                    <button
                      onClick={() => setShowMintModal(true)}
                      className="flex items-center gap-2 font-bold px-6 py-3 transition-all whitespace-nowrap shrink-0"
                      style={{
                        background: "#FAFF00",
                        color: "#18181B",
                        borderRadius: "9999px",
                        boxShadow: "0 0 15px rgba(250,255,0,0.2)",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 25px rgba(250,255,0,0.4)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 15px rgba(250,255,0,0.2)")
                      }
                    >
                      <Plus size={16} /> Mintar NFT &mdash;{" "}
                      {details.mintPriceEth} ETH
                    </button>
                  )}
                  {isSoldOut && (
                    <div
                      className="px-6 py-3 text-sm font-bold shrink-0"
                      style={{
                        background: "#222222",
                        border: "1px solid #333333",
                        color: "#444",
                      }}
                    >
                      Supply Esgotado
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 mb-8">
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
                  className="p-4"
                  style={{ background: "#111111", border: "1px solid #222222" }}
                >
                  <p
                    className="text-xs uppercase tracking-widest mb-1"
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      color: "#444",
                    }}
                  >
                    {s.label}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {s.showOwner && (
                      <ShieldCheck size={12} style={{ color: "#00ff88" }} />
                    )}
                    <p
                      className="text-xl font-bold"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      {s.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Supply progress */}
            {details.maxSupply && details.maxSupply > 0 && (
              <div className="mb-10">
                <div
                  className="flex justify-between text-xs mb-2"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    color: "#444",
                  }}
                >
                  <span>{totalSupply} mintados</span>
                  <span>{supplyPercent}% do supply</span>
                </div>
                <div
                  className="h-1 overflow-hidden"
                  style={{ background: "#222222" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${supplyPercent}%`,
                      background: "linear-gradient(90deg, #FAFF00, #00ff88)",
                      boxShadow: "0 0 8px rgba(250,255,0,0.4)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NFT Grid */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold flex items-center gap-2">
              <span style={{ fontFamily: "var(--font-space), sans-serif" }}>
                NFTs da Coleção
              </span>
              {totalSupply > 0 && (
                <span
                  className="text-sm font-normal"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    color: "#444",
                  }}
                >
                  ({totalSupply})
                </span>
              )}
            </h2>
            <a
              href={`https://sepolia.etherscan.io/address/${collectionAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{
                fontFamily: "var(--font-mono), monospace",
                color: "#444",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#FAFF00")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#444")
              }
            >
              Ver contrato <ExternalLink size={11} />
            </a>
          </div>

          {isLoadingNFTs ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={{ border: "1px solid #222222", background: "#111111" }}
                >
                  <div
                    className="aspect-square animate-pulse"
                    style={{ background: "#222222" }}
                  />
                  <div className="p-3 space-y-2">
                    <div
                      className="h-3 rounded-sm animate-pulse w-1/3"
                      style={{ background: "#222222" }}
                    />
                    <div
                      className="h-4 rounded-sm animate-pulse w-3/4"
                      style={{ background: "#222222" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : nfts.length === 0 ? (
            <div
              className="text-center py-20 border border-dashed"
              style={{ borderColor: "#222222" }}
            >
              <Layers
                size={40}
                className="mx-auto mb-3"
                style={{ color: "#333333" }}
              />
              <p
                className="mb-4 text-sm"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  color: "#444",
                }}
              >
                Nenhum NFT mintado ainda nesta coleção.
              </p>
              {isConnected && !isSoldOut && urisLoaded && (
                <button
                  onClick={() => setShowMintModal(true)}
                  className="inline-flex items-center gap-2 font-bold px-5 py-2.5 text-sm transition-all"
                  style={{
                    background: "#FAFF00",
                    color: "#18181B",
                    borderRadius: "9999px",
                  }}
                >
                  <Plus size={14} /> Ser o primeiro a mintar
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {nfts.map((nft) => (
                <NFTCard key={nft.tokenId} nft={nft} />
              ))}
            </div>
          )}
        </div>

        {/* Success toast */}
        {mintSuccess && (
          <div
            className="fixed bottom-6 right-6 flex items-center gap-3 p-4 z-40 shadow-xl"
            style={{
              background: "rgba(0,255,136,0.05)",
              border: "1px solid rgba(0,255,136,0.3)",
              color: "#00ff88",
            }}
          >
            <ShieldCheck size={18} />
            <div>
              <p
                className="font-bold text-sm"
                style={{ fontFamily: "var(--font-space), sans-serif" }}
              >
                NFT Mintado!
              </p>
              <a
                href={`https://sepolia.etherscan.io/tx/${mintSuccess}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                Ver no Etherscan
              </a>
            </div>
            <button
              onClick={() => setMintSuccess(null)}
              className="ml-2 transition-colors"
              style={{ color: "#444" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#00ff88")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#444")
              }
            >
              <X size={14} />
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
      <Footer />
    </div>
  );
}
