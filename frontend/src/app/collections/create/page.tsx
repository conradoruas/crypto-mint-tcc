"use client";

import Image from "next/image";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useConnection,
  useReadContract,
  useSignMessage,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  Upload,
  Plus,
  Loader2,
  Info,
  X,
  Image as ImageIcon,
  CheckCircle,
  Layers,
} from "lucide-react";
import { useCreateCollection } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";
import Footer from "@/components/Footer";
import {
  createCollectionSchema,
  getZodErrors,
  type CreateCollectionErrors,
} from "@/lib/schemas";
import { formatTransactionError } from "@/lib/txErrors";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import { buildUploadAuthHeaders } from "@/lib/uploadAuthClient";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";

const FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS as `0x${string}`;

interface NFTDraft {
  id: number;
  name: string;
  description: string;
  file: File | null;
  previewUrl: string;
}

const inputClass =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

const inputErrorClass =
  "w-full bg-surface-container-lowest border border-error/40 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-error transition-all placeholder:text-on-surface-variant/40";

const uploadButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-[11px] font-headline font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-error">{msg}</p>;
}

export default function CreateCollectionPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  const getAuthHeaders = useCallback(
    (pathname: string) => {
      if (!address) throw new Error("Wallet required");
      return buildUploadAuthHeaders(signMessageAsync, address, pathname);
    },
    [signMessageAsync, address],
  );

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      const headers = await getAuthHeaders(UPLOAD_API_PATHS.image);
      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
        headers,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      if (!data.uri) throw new Error("Invalid URI");
      return data.uri;
    },
    [getAuthHeaders],
  );

  const uploadMetadata = useCallback(
    async (
      name: string,
      description: string,
      imageUri: string,
    ): Promise<string> => {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders(UPLOAD_API_PATHS.profile)),
      };
      const res = await fetch("/api/upload-profile", {
        method: "POST",
        headers,
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
    },
    [getAuthHeaders],
  );

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [mintPrice, setMintPrice] = useState("0.0001");
  const [nfts, setNfts] = useState<NFTDraft[]>([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingNFTs, setIsUploadingNFTs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreateCollectionErrors>({});

  const {
    createCollection,
    isPending: isCreating,
    isConfirming: isConfirmingCreate,
    isSuccess: collectionCreated,
    hash: createHash,
  } = useCreateCollection();

  const { mutateAsync, isPending: isLoadingURIs } = useWriteContract();
  const [loadURIsHash, setLoadURIsHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirmingLoad, isSuccess: urisLoaded } =
    useWaitForTransactionReceipt({ hash: loadURIsHash });

  const { data: creatorCollectionIds } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address as `0x${string}`],
    query: { enabled: !!collectionCreated && !!address, refetchInterval: 2000 },
  });

  const lastIndex = creatorCollectionIds
    ? (creatorCollectionIds as bigint[])[
        (creatorCollectionIds as bigint[]).length - 1
      ]
    : undefined;

  const { data: lastCollectionData } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCollection",
    args: [lastIndex ?? BigInt(0)],
    query: { enabled: lastIndex !== undefined },
  });

  const deployedAddress =
    (lastCollectionData as { contractAddress: `0x${string}` } | undefined)
      ?.contractAddress ?? null;

  const isLoading =
    isUploadingCover ||
    isCreating ||
    isConfirmingCreate ||
    isUploadingNFTs ||
    isLoadingURIs ||
    isConfirmingLoad;

  const addNFT = () =>
    setNfts((prev) => [
      ...prev,
      { id: Date.now(), name: "", description: "", file: null, previewUrl: "" },
    ]);

  const removeNFT = (id: number) =>
    setNfts((prev) => prev.filter((n) => n.id !== id));

  const updateNFT = (
    id: number,
    field: keyof NFTDraft,
    value: string | File | null,
  ) =>
    setNfts((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (field === "file" && value instanceof File)
          return { ...n, file: value, previewUrl: URL.createObjectURL(value) };
        return { ...n, [field]: value };
      }),
    );

  const handleCreateCollection = async () => {
    setError(null);
    const errors = getZodErrors(createCollectionSchema, {
      name,
      symbol,
      description: description || undefined,
      mintPrice,
    }) as CreateCollectionErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!coverFile) {
      setError("Select a cover image.");
      return;
    }
    if (!isConnected) {
      setError("Connect your wallet.");
      return;
    }
    if (nfts.length === 0) {
      setError("Add at least 1 NFT to the collection.");
      return;
    }
    if (nfts.some((n) => !n.name || !n.file)) {
      setError("All NFTs need a name and image.");
      return;
    }
    try {
      setIsUploadingCover(true);
      const coverUri = await uploadImage(coverFile);
      setIsUploadingCover(false);
      await createCollection({
        name,
        symbol: symbol.toUpperCase(),
        description,
        image: coverUri,
        maxSupply: nfts.length,
        mintPrice,
      });
    } catch (e) {
      setError(
        formatTransactionError(
          e,
          "Could not create collection. Check uploads and try again.",
        ),
      );
      setIsUploadingCover(false);
    }
  };

  const handleLoadURIs = async (addr: `0x${string}`) => {
    setError(null);
    try {
      setIsUploadingNFTs(true);
      const uris: string[] = [];
      for (let i = 0; i < nfts.length; i++) {
        setUploadProgress(Math.round((i / nfts.length) * 90));
        const nft = nfts[i];
        const imageUri = await uploadImage(nft.file!);
        const metaUri = await uploadMetadata(
          nft.name,
          nft.description,
          imageUri,
        );
        uris.push(metaUri);
      }
      setUploadProgress(95);
      setIsUploadingNFTs(false);
      if (!address || !publicClient) {
        throw new Error("Connect your wallet.");
      }
      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: address,
        address: addr,
        abi: NFT_COLLECTION_ABI,
        functionName: "loadTokenURIs",
        args: [uris],
      });
      const tx = await mutateAsync({
        address: addr,
        abi: NFT_COLLECTION_ABI,
        functionName: "loadTokenURIs",
        args: [uris],
        gas,
      });
      setLoadURIsHash(tx);
      setUploadProgress(100);
    } catch (e) {
      setError(
        formatTransactionError(
          e,
          "Could not publish metadata on-chain. Try again.",
        ),
      );
      setIsUploadingNFTs(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (urisLoaded) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <div className="max-w-lg mx-auto px-8 py-32 text-center">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-primary/5 border border-primary/20 rounded-sm">
            <CheckCircle size={36} className="text-primary" />
          </div>
          <span className="text-xs font-headline font-bold tracking-[0.3em] text-primary uppercase block mb-3">
            Deploy Complete
          </span>
          <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
            Collection Ready!
          </h1>
          <p className="mb-2 text-sm text-on-surface-variant">
            {nfts.length} NFTs loaded and ready to mint.
          </p>
          {loadURIsHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${loadURIsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-8 text-sm text-primary hover:text-primary-container transition-colors font-mono underline"
            >
              View on Etherscan
            </a>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push("/collections")}
              className="font-headline font-bold px-6 py-3 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed text-sm uppercase tracking-wider hover:brightness-110 transition-all"
            >
              View Collections
            </button>
            <button
              onClick={() => router.push("/collections/create")}
              className="font-headline font-bold px-6 py-3 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-all text-sm uppercase tracking-wider"
            >
              Create Another
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Deployed, needs loadTokenURIs ───────────────────────────────────────────
  if (collectionCreated && !urisLoaded) {
    return (
      <main className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <div className="max-w-xl mx-auto px-8 py-32 text-center">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-secondary/5 border border-secondary/20 rounded-sm">
            <CheckCircle size={36} className="text-secondary" />
          </div>
          <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase block mb-3">
            Contract Deployed
          </span>
          <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
            Collection Deployed!
          </h1>
          <p className="mb-6 text-sm text-on-surface-variant">
            Now load the {nfts.length} NFTs onto the blockchain to enable
            minting.
          </p>

          {deployedAddress ? (
            <div className="p-4 mb-6 text-left bg-surface-container-low border border-outline-variant/10 rounded-sm">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                Deployed Contract
              </p>
              <p className="text-xs font-mono text-primary break-all">
                {deployedAddress}
              </p>
            </div>
          ) : (
            <div className="p-4 mb-6 flex items-center gap-3 bg-surface-container-low border border-outline-variant/10 rounded-sm">
              <Loader2
                size={14}
                className="animate-spin shrink-0 text-on-surface-variant/50"
              />
              <p className="text-xs text-on-surface-variant">
                Detecting contract address...
              </p>
            </div>
          )}

          {createHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${createHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-6 text-sm text-primary hover:text-primary-container transition-colors font-mono underline"
            >
              View deploy on Etherscan
            </a>
          )}

          {(isUploadingNFTs || isLoadingURIs || isConfirmingLoad) && (
            <div className="mb-6 text-left">
              <div className="flex justify-between text-xs text-on-surface-variant mb-2 uppercase tracking-widest">
                <span>
                  {isUploadingNFTs
                    ? `Uploading NFTs to IPFS... (${uploadProgress}%)`
                    : isLoadingURIs
                      ? "Awaiting wallet..."
                      : "Confirming on blockchain..."}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1 bg-surface-container-high overflow-hidden rounded-full">
                <div
                  className="h-full transition-all bg-gradient-to-r from-primary to-secondary"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm p-4 mb-4 bg-error/5 border border-error/20 text-error rounded-sm">
              {error}
            </div>
          )}

          <div className="relative group overflow-hidden">
            <button
              onClick={() => deployedAddress && handleLoadURIs(deployedAddress)}
              disabled={isLoading || !deployedAddress}
              className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
                isLoading || !deployedAddress
                  ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
              }`}
            >
              {!isLoading && deployedAddress && (
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              )}
              {isLoading || !deployedAddress ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  {!deployedAddress
                    ? "Awaiting address..."
                    : isUploadingNFTs
                      ? `Uploading NFTs... ${uploadProgress}%`
                      : isLoadingURIs
                        ? "Awaiting wallet..."
                        : "Confirming..."}
                </>
              ) : (
                <>
                  <Upload size={18} /> Load {nfts.length} NFTs onto Blockchain
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <div className="pt-32 pb-20 max-w-[1920px] mx-auto px-8">
        {/* Page Header */}
        <header className="mb-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase">
              Collection Factory · Sepolia
            </span>
          </div>
          <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tighter text-on-surface mb-4 leading-none uppercase">
            New <span className="text-primary italic">Collection</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-lg font-light leading-relaxed">
            Define your collection metadata and add all NFTs available for
            minting.
          </p>
        </header>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Section 01: Collection Data */}
          <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6">
            <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3">
              <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest">
                01
              </span>
              Collection Data
            </h2>

            {/* Cover image */}
            <div>
              <label className="block text-[10px] font-headline font-bold mb-3 uppercase tracking-widest text-on-surface-variant">
                Cover Image *
              </label>
              <input
                type="file"
                id="cover-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setCoverFile(f);
                  setCoverPreview(f ? URL.createObjectURL(f) : "");
                }}
              />
              <label
                htmlFor="cover-upload"
                className={`block p-8 text-center cursor-pointer transition-all border rounded-sm focus-within:ring-2 focus-within:ring-primary/30 ${
                  coverFile
                    ? "border-primary/40 bg-primary/5"
                    : "border-dashed border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-lowest"
                }`}
              >
                {coverPreview ? (
                  <div className="relative h-40">
                    <Image
                      src={coverPreview}
                      alt="Cover Preview"
                      fill
                      className="object-contain rounded-sm"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload
                      className="mx-auto text-on-surface-variant/40"
                      size={24}
                    />
                    <span className={`${uploadButtonClass} border-outline-variant/25 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary`}>
                      Select Cover Image
                    </span>
                    <p className="text-[11px] text-on-surface-variant/60 uppercase tracking-widest">
                      PNG, JPG or WEBP
                    </p>
                  </div>
                )}
                {coverFile && (
                  <p className="text-xs mt-3 text-primary font-headline font-bold uppercase tracking-widest break-all">
                    ✓ {coverFile.name}
                  </p>
                )}
              </label>
            </div>

            {/* Name + Symbol */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="col-name"
                  className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
                >
                  Name *
                </label>
                <input
                  id="col-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  className={fieldErrors.name ? inputErrorClass : inputClass}
                  placeholder="e.g. Cyber Monkeys"
                />
                <FieldError msg={fieldErrors.name} />
              </div>
              <div>
                <label
                  htmlFor="col-symbol"
                  className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
                >
                  Symbol *
                </label>
                <input
                  id="col-symbol"
                  type="text"
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value.toUpperCase());
                    setFieldErrors((p) => ({ ...p, symbol: undefined }));
                  }}
                  maxLength={8}
                  className={`${fieldErrors.symbol ? inputErrorClass : inputClass} uppercase`}
                  placeholder="e.g. CYBM"
                />
                <FieldError msg={fieldErrors.symbol} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="col-description"
                className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
              >
                Description
              </label>
              <textarea
                id="col-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setFieldErrors((p) => ({ ...p, description: undefined }));
                }}
                className={`${fieldErrors.description ? inputErrorClass : inputClass} h-24 resize-none`}
                placeholder="Describe your collection..."
              />
              <FieldError msg={fieldErrors.description} />
            </div>

            {/* Mint price */}
            <div>
              <label
                htmlFor="col-mint-price"
                className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
              >
                Mint Price (ETH) *
              </label>
              <input
                id="col-mint-price"
                type="number"
                step="0.0001"
                min="0.0001"
                value={mintPrice}
                onChange={(e) => {
                  setMintPrice(e.target.value);
                  setFieldErrors((p) => ({ ...p, mintPrice: undefined }));
                }}
                className={fieldErrors.mintPrice ? inputErrorClass : inputClass}
                placeholder="0.0001"
              />
              <FieldError msg={fieldErrors.mintPrice} />
            </div>

            {/* Info callout */}
            <div className="glass-panel border-l-2 border-primary/40 border border-outline-variant/10 p-4 flex items-start gap-3">
              <Info size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Max supply is determined by the number of NFTs added below. Each
                user receives a{" "}
                <strong className="text-on-surface font-semibold">
                  random NFT
                </strong>{" "}
                when minting.
              </p>
            </div>
          </div>

          {/* Section 02: NFTs */}
          <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3">
                  <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary uppercase tracking-widest">
                    02
                  </span>
                  Collection NFTs
                </h2>
                <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest">
                  {nfts.length === 0
                    ? "Add the NFTs available for minting."
                    : `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""} added`}
                </p>
              </div>
              <button
                onClick={addNFT}
                className="flex items-center gap-2 text-xs font-headline font-bold uppercase tracking-widest px-4 py-2 border border-outline-variant/20 text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all rounded-sm"
              >
                <Plus size={12} /> Add NFT
              </button>
            </div>

            {nfts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-outline-variant/20 rounded-sm">
                <ImageIcon
                  size={36}
                  className="mx-auto mb-3 text-on-surface-variant/20"
                />
                <p className="text-sm text-on-surface-variant mb-4">
                  No NFTs added yet
                </p>
                <button
                  onClick={addNFT}
                  className="inline-flex items-center gap-2 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
                >
                  <Plus size={13} /> Add First NFT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {nfts.map((nft, index) => (
                  <div
                    key={nft.id}
                    className="p-4 bg-surface-container border border-outline-variant/10 rounded-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 relative">
                        <input
                          type="file"
                          id={`nft-file-${nft.id}`}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            updateNFT(
                              nft.id,
                              "file",
                              e.target.files?.[0] || null,
                            )
                          }
                        />
                        <label
                          htmlFor={`nft-file-${nft.id}`}
                          className={`w-24 h-24 relative flex items-center justify-center cursor-pointer overflow-hidden rounded-sm transition-all border focus-within:ring-2 focus-within:ring-primary/30 ${
                            nft.file
                              ? "border-primary/40 bg-primary/5"
                              : "border-dashed border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-lowest"
                          }`}
                        >
                          {nft.previewUrl ? (
                            <Image
                              src={nft.previewUrl}
                              alt="NFT Preview"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 300px"
                            />
                          ) : (
                            <div className="text-center px-1">
                              <Upload
                                size={14}
                                className="mx-auto mb-1 text-on-surface-variant/40"
                              />
                              <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-on-surface-variant/70">
                                Add Image
                              </span>
                            </div>
                          )}
                        </label>
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-headline font-bold text-on-surface-variant shrink-0 uppercase tracking-widest">
                            #{String(index + 1).padStart(3, "0")}
                          </span>
                          <input
                            type="text"
                            value={nft.name}
                            onChange={(e) =>
                              updateNFT(nft.id, "name", e.target.value)
                            }
                            className={`${inputClass} flex-1`}
                            placeholder="NFT Name *"
                          />
                        </div>
                        <textarea
                          value={nft.description}
                          onChange={(e) =>
                            updateNFT(nft.id, "description", e.target.value)
                          }
                          className={`${inputClass} h-16 resize-none`}
                          placeholder="Description (optional)"
                        />
                      </div>

                      <button
                        onClick={() => removeNFT(nft.id)}
                        className="shrink-0 p-1.5 text-on-surface-variant/30 hover:text-error transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addNFT}
                  className="w-full py-3 text-xs flex items-center justify-center gap-2 transition-all border border-dashed border-outline-variant/10 text-on-surface-variant/40 hover:border-primary/30 hover:text-primary rounded-sm font-headline font-bold uppercase tracking-widest"
                >
                  <Plus size={12} /> Add Another NFT
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm p-4 bg-error/5 border border-error/20 text-error rounded-sm">
              {error}
            </div>
          )}

          <div className="relative group overflow-hidden">
            <button
              onClick={handleCreateCollection}
              disabled={isLoading || nfts.length === 0}
              className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
                isLoading || nfts.length === 0
                  ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
              }`}
            >
              {!isLoading && nfts.length > 0 && (
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              )}
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Layers size={18} />
              )}
              {isUploadingCover
                ? "Uploading cover to IPFS..."
                : isCreating
                  ? "Awaiting wallet..."
                  : isConfirmingCreate
                    ? "Deploying contract..."
                    : `Create Collection with ${nfts.length} NFT${nfts.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    </main>
  );
}
