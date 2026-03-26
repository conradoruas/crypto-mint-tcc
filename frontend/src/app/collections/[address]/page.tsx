"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useConnection,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Navbar } from "@/components/NavBar";
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
  CheckCircle2,
  Upload,
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

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  if (!data.uri) throw new Error("Invalid URI");
  return data.uri;
}

async function uploadMetadata(
  name: string,
  description: string,
  imageUri: string,
): Promise<string> {
  const res = await fetch("/api/upload-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description: description || "",
      image: imageUri,
      address: `nft-${Date.now()}`,
    }),
  });
  if (!res.ok) throw new Error(`Metadata upload failed: ${res.status}`);
  const data = await res.json();
  if (!data.uri) throw new Error("Invalid URI");
  return data.uri;
}

// ─── Load NFTs panel (owner only, shown when urisLoaded === false) ────────────

interface NFTLoadDraft {
  name: string;
  description: string;
  file: File | null;
  previewUrl: string;
}

function LoadNFTsPanel({
  collectionAddress,
  maxSupply,
  onSuccess,
}: {
  collectionAddress: `0x${string}`;
  maxSupply: number;
  onSuccess: () => void;
}) {
  // Inicializa o array com o número exato de slots (maxSupply)
  const [nftDrafts, setNftDrafts] = useState<NFTLoadDraft[]>(
    Array(maxSupply)
      .fill(null)
      .map(() => ({
        name: "",
        description: "",
        file: null,
        previewUrl: "",
      })),
  );

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useWriteContract();
  const [loadHash, setLoadHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: loadHash,
  });

  useEffect(() => {
    if (isSuccess) onSuccess();
  }, [isSuccess, onSuccess]);

  const updateNFT = (index: number, field: keyof NFTLoadDraft, value: string | File) => {
    setNftDrafts((prev) =>
      prev.map((nft, i) => {
        if (i !== index) return nft;
        if (field === "file" && value instanceof File) {
          return {
            ...nft,
            file: value,
            previewUrl: URL.createObjectURL(value),
          };
        }
        return { ...nft, [field]: value };
      }),
    );
  };

  const handleLoad = async () => {
    // Validação: Todos precisam de nome e arquivo
    const isInvalid = nftDrafts.some((n) => !n.name || !n.file);
    if (isInvalid) {
      setError("Todos os NFTs precisam de um nome e uma imagem.");
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const uris: string[] = [];
      for (let i = 0; i < nftDrafts.length; i++) {
        setProgress(Math.round((i / nftDrafts.length) * 90));
        const nft = nftDrafts[i];

        // 1. Upload da Imagem
        const imageUri = await uploadImage(nft.file!);
        // 2. Upload do Metadado (agora com descrição)
        const metaUri = await uploadMetadata(
          nft.name,
          nft.description,
          imageUri,
        );

        uris.push(metaUri);
      }

      setProgress(95);
      setIsUploading(false);

      const tx = await mutateAsync({
        address: collectionAddress,
        abi: NFT_COLLECTION_ABI,
        functionName: "loadTokenURIs",
        args: [uris],
        gas: BigInt(500000 + uris.length * 30000),
      });
      setLoadHash(tx);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar NFTs.");
      setIsUploading(false);
    }
  };

  const busy = isUploading || isPending || isConfirming;
  const inputClass =
    "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-2 rounded-sm text-xs focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

  return (
    <div className="max-w-7xl mx-auto px-4 mb-10">
      <div className="bg-surface-container-low border border-secondary/30 p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-8">
          <AlertTriangle size={20} className="text-secondary shrink-0 mt-1" />
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase tracking-tight">
              Configuração Final da Coleção
            </h3>
            <p className="text-sm text-on-surface-variant">
              Preencha os detalhes dos {maxSupply} NFTs para habilitar o minting
              na blockchain.
            </p>
          </div>
        </div>

        {/* NFT Form Grid */}
        <div className="space-y-4 mb-8">
          {nftDrafts.map((nft, index) => (
            <div
              key={index}
              className="p-4 bg-surface-container border border-outline-variant/10 flex flex-col md:flex-row gap-4 items-start"
            >
              {/* Image Upload Area */}
              <div className="shrink-0">
                <input
                  type="file"
                  id={`nft-load-file-${index}`}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateNFT(index, "file", file);
                  }}
                  disabled={busy}
                />
                <label
                  htmlFor={`nft-load-file-${index}`}
                  className={`w-24 h-24 flex items-center justify-center cursor-pointer overflow-hidden border ${
                    nft.file
                      ? "border-primary/40"
                      : "border-dashed border-outline-variant/20 hover:border-secondary/40"
                  } transition-all`}
                >
                  {nft.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={nft.previewUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <Upload
                        size={16}
                        className="mx-auto mb-1 text-on-surface-variant/30"
                      />
                      <span className="text-[8px] uppercase font-bold text-on-surface-variant/50">
                        Imagem *
                      </span>
                    </div>
                  )}
                </label>
              </div>

              {/* Text Inputs Area */}
              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-headline font-bold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-1">
                    #{String(index + 1).padStart(3, "0")}
                  </span>
                  <input
                    type="text"
                    value={nft.name}
                    onChange={(e) => updateNFT(index, "name", e.target.value)}
                    className={inputClass}
                    placeholder="Nome do NFT *"
                    disabled={busy}
                  />
                </div>
                <textarea
                  value={nft.description}
                  onChange={(e) =>
                    updateNFT(index, "description", e.target.value)
                  }
                  className={`${inputClass} h-16 resize-none`}
                  placeholder="Descrição (opcional)"
                  disabled={busy}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Status e Ações */}
        {busy && (
          <div className="mb-6">
            <div className="flex justify-between text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest">
              <span>
                {isUploading
                  ? `IPFS: ${progress}%`
                  : isPending
                    ? "Carteira..."
                    : "Blockchain..."}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs p-4 mb-6 bg-error/5 border border-error/20 text-error flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button
          onClick={handleLoad}
          disabled={busy}
          className="w-full font-headline font-bold py-4 flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all bg-secondary text-on-secondary hover:brightness-110 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Upload size={18} />
          )}
          {busy ? "Processando..." : `Finalizar e Carregar ${maxSupply} NFTs`}
        </button>
      </div>
    </div>
  );
}

// ─── NFT card ─────────────────────────────────────────────────────────────────

function NFTCard({
  nft,
  collectionName,
}: {
  nft: CollectionNFTItem;
  collectionName: string;
}) {
  return (
    <Link
      href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
      className="group bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 overflow-hidden transition-all duration-300"
    >
      <div className="aspect-square relative bg-surface-container-high">
        {nft.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className="text-on-surface-variant/30" />
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-1 truncate">
          {collectionName}
        </p>
        <h3 className="font-headline font-bold text-lg truncate text-on-surface group-hover:text-primary transition-colors">
          {nft.name}
        </h3>
        <p className="text-on-surface-variant text-xs mt-1">
          #{nft.tokenId.padStart(3, "0")}
        </p>
      </div>
    </Link>
  );
}

// ─── Mint modal ───────────────────────────────────────────────────────────────

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
  }, [isSuccess, hash, onSuccess]);

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

  const busy = isPending || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-container border border-outline-variant/30 p-8 text-center">
        <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">
          Mintar NFT
        </h2>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
          Você receberá um NFT{" "}
          <strong className="text-on-surface">aleatório</strong> desta coleção.
        </p>

        <div className="bg-surface-container-high border border-outline-variant/20 p-5 mb-6">
          <p className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant mb-1">
            Preço de mint
          </p>
          <p className="font-headline text-3xl font-bold text-primary">
            {mintPriceEth} ETH
          </p>
        </div>

        {!urisLoaded && (
          <div className="flex items-start gap-2 p-3 mb-4 text-left bg-secondary/5 border border-secondary/20">
            <AlertTriangle
              size={13}
              className="text-secondary shrink-0 mt-0.5"
            />
            <p className="text-xs text-secondary">
              O criador ainda não finalizou o carregamento dos NFTs.
            </p>
          </div>
        )}

        {error && (
          <div className="text-sm p-3 mb-4 bg-error/5 border border-error/30 text-error">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 font-bold py-3 border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleMint}
            disabled={busy || !urisLoaded}
            className="flex-1 font-bold py-3 flex items-center justify-center gap-2 transition-all bg-primary text-on-primary hover:bg-primary-dim disabled:bg-surface-container-high disabled:text-on-surface-variant/40 disabled:cursor-not-allowed"
          >
            {busy ? (
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { address: collectionAddr } = useParams();
  const collectionAddress =
    (Array.isArray(collectionAddr) ? collectionAddr[0] : collectionAddr) ?? "";

  const { address: userAddress, isConnected } = useConnection();
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const details = useCollectionDetails(collectionAddress);
  const {
    nfts,
    isLoading: isLoadingNFTs,
    totalSupply,
  } = useCollectionNFTs(collectionAddress);

  const { data: urisLoadedData, refetch: refetchUrisLoaded } = useReadContract({
    address: collectionAddress as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "urisLoaded",
    query: { enabled: !!collectionAddress },
  });
  const urisLoaded = (urisLoadedData as boolean | undefined) || loadSuccess;

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

  const bannerImage = details.image ? resolveIpfsUrl(details.image) : null;

  const handleLoadSuccess = () => {
    setLoadSuccess(true);
    refetchUrisLoaded();
  };

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Navbar />

      {/* Banner */}
      <div className="relative">
        <div className="h-48 md:h-64 relative overflow-hidden bg-surface-container-low">
          {bannerImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerImage}
              alt={details.name ?? ""}
              className="w-full h-full object-cover opacity-20 blur-sm scale-110"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          {!bannerImage && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6 -mt-12 relative z-10">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 relative border-4 border-background bg-surface-container-high overflow-hidden">
              {bannerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerImage}
                  alt={details.name ?? ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-on-surface-variant/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2 md:pt-14">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="font-headline text-3xl font-bold text-on-surface">
                      {details.name ?? "—"}
                    </h1>
                    <span className="text-[10px] font-headline uppercase tracking-widest px-2 py-0.5 bg-surface-container border border-outline-variant/20 text-on-surface-variant">
                      {details.symbol}
                    </span>
                  </div>
                  {details.description && (
                    <p className="text-sm text-on-surface-variant max-w-xl">
                      {details.description}
                    </p>
                  )}
                  {isOwner && !urisLoaded && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 w-fit bg-secondary/5 border border-secondary/20">
                      <AlertTriangle size={12} className="text-secondary" />
                      <span className="text-xs text-secondary">
                        NFTs ainda não carregados na blockchain
                      </span>
                    </div>
                  )}
                </div>

                {isConnected && !isSoldOut && urisLoaded && (
                  <button
                    onClick={() => setShowMintModal(true)}
                    className="flex items-center gap-2 font-bold px-6 py-3 bg-primary text-on-primary hover:bg-primary-dim transition-colors whitespace-nowrap shrink-0 neon-glow-primary"
                  >
                    <Plus size={16} /> Mintar NFT &mdash; {details.mintPriceEth}{" "}
                    ETH
                  </button>
                )}
                {isSoldOut && (
                  <div className="px-6 py-3 text-sm font-bold shrink-0 bg-surface-container border border-outline-variant/20 text-on-surface-variant/40">
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
                className="p-4 bg-surface-container-low border border-outline-variant/20"
              >
                <p className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant mb-1">
                  {s.label}
                </p>
                <div className="flex items-center gap-1.5">
                  {s.showOwner && (
                    <ShieldCheck size={12} className="text-primary" />
                  )}
                  <p className="font-headline text-xl font-bold text-on-surface">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Supply progress */}
          {details.maxSupply && details.maxSupply > 0 && (
            <div className="mb-10">
              <div className="flex justify-between text-[10px] text-on-surface-variant mb-2">
                <span>{totalSupply} mintados</span>
                <span>{supplyPercent}% do supply</span>
              </div>
              <div className="h-1 bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                  style={{ width: `${supplyPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Load NFTs panel — owner only, while urisLoaded is false */}
      {isOwner && !urisLoaded && details.maxSupply && details.maxSupply > 0 && (
        <LoadNFTsPanel
          collectionAddress={collectionAddress as `0x${string}`}
          maxSupply={Number(details.maxSupply)}
          onSuccess={handleLoadSuccess}
        />
      )}

      {/* NFT Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline font-bold flex items-center gap-2 text-on-surface">
            NFTs da Coleção
            {totalSupply > 0 && (
              <span className="text-sm font-normal text-on-surface-variant">
                ({totalSupply})
              </span>
            )}
          </h2>
          <a
            href={`https://sepolia.etherscan.io/address/${collectionAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            Ver contrato <ExternalLink size={11} />
          </a>
        </div>

        {isLoadingNFTs ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border border-outline-variant/20 bg-surface-container-low overflow-hidden"
              >
                <div className="aspect-square bg-surface-container-high animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-surface-container-high animate-pulse w-1/3" />
                  <div className="h-4 bg-surface-container-high animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-outline-variant/20">
            <Layers
              size={40}
              className="mx-auto mb-3 text-on-surface-variant/20"
            />
            <p className="text-sm text-on-surface-variant mb-4">
              Nenhum NFT mintado ainda nesta coleção.
            </p>
            {isConnected && !isSoldOut && urisLoaded && (
              <button
                onClick={() => setShowMintModal(true)}
                className="inline-flex items-center gap-2 font-bold px-5 py-2.5 text-sm bg-primary text-on-primary hover:bg-primary-dim transition-colors neon-glow-primary"
              >
                <Plus size={14} /> Ser o primeiro a mintar
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
            {nfts.map((nft) => (
              <NFTCard
                key={nft.tokenId}
                nft={nft}
                collectionName={details.name ?? ""}
              />
            ))}
          </div>
        )}
      </div>

      {/* Success toast — mint */}
      {mintSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 p-4 z-40 shadow-xl bg-surface-container border border-primary/30">
          <CheckCircle2 size={18} className="text-primary shrink-0" />
          <div>
            <p className="font-headline font-bold text-sm text-on-surface">
              NFT Mintado!
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${mintSuccess}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              Ver no Etherscan
            </a>
          </div>
          <button
            onClick={() => setMintSuccess(null)}
            className="ml-2 text-on-surface-variant hover:text-on-surface transition-colors"
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

      <Footer />
    </div>
  );
}
