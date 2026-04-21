"use client";

import Image from "next/image";
import { useEffect, useCallback, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  useConnection,
  useReadContract,
  useSignMessage,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { Navbar } from "@/components/navbar";
import { WalletGuard } from "@/components/WalletGuard";
import {
  Upload,
  Plus,
  Loader2,
  Info,
  X,
  Image as ImageIcon,
  CheckCircle,
  Layers,
  ShieldCheck,
  Download,
} from "lucide-react";
import { useCreateCollection } from "@/hooks/collections";
import {
  FACTORY_ADDRESS,
  NFT_COLLECTION_ABI,
  NFT_COLLECTION_FACTORY_ABI,
} from "@/constants/contracts";
import Footer from "@/components/Footer";
import { createCollectionSchema, getZodErrors } from "@/lib/schemas";
import type { CreateCollectionErrors } from "@/lib/schemas";
import { keccak256, zeroAddress } from "viem";
import { formatTransactionError } from "@/lib/txErrors";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import pLimit from "p-limit";
import { useCollectionForm, type NFTDraft } from "./useCollectionForm";
import {
  createUploadAuthHeaders,
  uploadImageFile,
  uploadNftMetadata,
} from "@/lib/uploadClient";

interface BulkMetadataItem {
  name?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
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
    createUploadAuthHeaders(signMessageAsync, address),
    [signMessageAsync, address],
  );

  const uploadImage = useCallback(
    async (file: File): Promise<string> => uploadImageFile(file, getAuthHeaders),
    [getAuthHeaders],
  );

  const uploadMetadata = useCallback(
    async (
      name: string,
      description: string,
      imageUri: string,
    ): Promise<string> =>
      uploadNftMetadata({ name, description, imageUri }, getAuthHeaders),
    [getAuthHeaders],
  );

  const [form, dispatch] = useCollectionForm();
  const {
    coverFile, coverPreview, name, symbol, description, mintPrice,
    nfts, currentPage,
    isUploadingCover, isUploadingNFTs, isBulkProcessing, uploadProgress,
    bulkMetadataFile, bulkImageFiles, bulkMetadataName, bulkImageNames,
    error, bulkParsingError, fieldErrors, hasMounted,
  } = form;

  const NFTs_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(nfts.length / NFTs_PER_PAGE));
  const pagedNFTs = nfts.slice(
    (currentPage - 1) * NFTs_PER_PAGE,
    currentPage * NFTs_PER_PAGE,
  );

  useEffect(() => { dispatch({ type: "MOUNTED" }); }, [dispatch]);

  useEffect(() => {
    if (currentPage > totalPages) dispatch({ type: "SET_PAGE", page: totalPages });
  }, [currentPage, totalPages, dispatch]);

  const {
    createCollection,
    isPending: isCreating,
    isConfirming: isConfirmingCreate,
    isSuccess: collectionCreated,
    hash: createHash,
  } = useCreateCollection();

  const { mutateAsync, isPending: isTxPending } = useWriteContract();
  const [loadURIsHash, setLoadURIsHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirmingLoad, isSuccess: urisLoaded } =
    useWaitForTransactionReceipt({ hash: loadURIsHash });

  const [commitSeedHash, setCommitSeedHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirmingSeed, isSuccess: seedCommitted } =
    useWaitForTransactionReceipt({ hash: commitSeedHash });
  const [generatedSeed, setGeneratedSeed] = useState<`0x${string}` | null>(null);
  const [seedCopied, setSeedCopied] = useState(false);
  const [isCommittingSeed, setIsCommittingSeed] = useState(false);

  const { data: creatorCollectionIds } = useReadContract({
    address: FACTORY_ADDRESS ?? zeroAddress,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address as `0x${string}`],
    query: {
      enabled: !!FACTORY_ADDRESS && !!collectionCreated && !!address,
      refetchInterval: 2000,
    },
  });

  const lastIndex = creatorCollectionIds
    ? (creatorCollectionIds as bigint[])[
    (creatorCollectionIds as bigint[]).length - 1
    ]
    : undefined;

  const { data: lastCollectionData } = useReadContract({
    address: FACTORY_ADDRESS ?? zeroAddress,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCollection",
    args: [lastIndex ?? BigInt(0)],
    query: { enabled: !!FACTORY_ADDRESS && lastIndex !== undefined },
  });

  const deployedAddress =
    (lastCollectionData as { contractAddress: `0x${string}` } | undefined)
      ?.contractAddress ?? null;

  const isLoadingURIs = isTxPending;
  const isLoading =
    isUploadingCover ||
    isCreating ||
    isConfirmingCreate ||
    isUploadingNFTs ||
    isLoadingURIs ||
    isConfirmingLoad ||
    isCommittingSeed ||
    isConfirmingSeed;

  const addNFT = () => dispatch({ type: "ADD_NFT" });
  const removeNFT = (id: number) => dispatch({ type: "REMOVE_NFT", id });
  const updateNFT = (id: number, field: keyof NFTDraft, value: string | File | null) =>
    dispatch({ type: "UPDATE_NFT", id, field, value });

  const handleBulkMetadataFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    dispatch({ type: "SET_BULK_METADATA_FILE", file, name: file?.name ?? "" });
  };

  const handleBulkImageFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    dispatch({ type: "SET_BULK_IMAGE_FILES", files, names: files.map((f) => f.name) });
  };

  const handleParseBulkNFTs = async () => {
    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_BULK_PARSING_ERROR", error: null });

    if (!bulkMetadataFile) {
      dispatch({ type: "SET_ERROR", error: "Please select a metadata JSON file." });
      return;
    }
    if (bulkImageFiles.length === 0) {
      dispatch({ type: "SET_ERROR", error: "Please select matching image files for bulk import." });
      return;
    }

    dispatch({ type: "SET_BULK_PROCESSING", value: true });
    try {
      const text = await bulkMetadataFile.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) {
        throw new Error("Bulk metadata must be an array of objects.");
      }

      const parsedNFTs = json.map(
        (item: BulkMetadataItem, idx: number) => {
          const nftName = String(item.name ?? "").trim();
          const nftDescription = String(item.description ?? "").trim();
          const imageName = String(item.image ?? "").trim();

          if (!nftName || !imageName) {
            throw new Error(
              `Entry ${idx + 1} must contain 'name' and 'image' fields.`,
            );
          }

          const imageFile = bulkImageFiles.find(
            (file) =>
              file.name === imageName ||
              file.name === imageName.replace(/^.*[\\/]/, ""),
          );

          if (!imageFile) {
            throw new Error(
              `Image '${imageName}' for entry ${idx + 1} not found in uploaded images.`,
            );
          }

          return {
            id: Date.now() + idx,
            name: nftName,
            description: nftDescription,
            file: imageFile,
            previewUrl: URL.createObjectURL(imageFile),
          };
        },
      );

      dispatch({ type: "SET_NFTS", nfts: parsedNFTs });
      dispatch({ type: "SET_ERROR", error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse bulk metadata.";
      dispatch({ type: "SET_BULK_PARSING_ERROR", error: message });
    } finally {
      dispatch({ type: "SET_BULK_PROCESSING", value: false });
    }
  };

  const handleCreateCollection = async () => {
    dispatch({ type: "SET_ERROR", error: null });
    const errors = getZodErrors(createCollectionSchema, {
      name,
      symbol,
      description: description || undefined,
      mintPrice,
    }) as CreateCollectionErrors;
    dispatch({ type: "SET_FIELD_ERRORS", errors });
    if (Object.keys(errors).length > 0) return;
    if (!coverFile) {
      dispatch({ type: "SET_ERROR", error: "Select a cover image." });
      return;
    }
    if (!isConnected) {
      dispatch({ type: "SET_ERROR", error: "Connect your wallet." });
      return;
    }
    if (nfts.length === 0) {
      dispatch({ type: "SET_ERROR", error: "Add at least 1 NFT to the collection." });
      return;
    }
    if (nfts.some((n) => !n.name || !n.file)) {
      dispatch({ type: "SET_ERROR", error: "All NFTs need a name and image." });
      return;
    }
    try {
      dispatch({ type: "SET_UPLOADING_COVER", value: true });
      const coverUri = await uploadImage(coverFile);
      dispatch({ type: "SET_UPLOADING_COVER", value: false });
      await createCollection({
        name,
        symbol: symbol.toUpperCase(),
        description,
        image: coverUri,
        maxSupply: nfts.length,
        mintPrice,
      });
    } catch (e) {
      dispatch({
        type: "SET_ERROR",
        error: formatTransactionError(e, "Could not create collection. Check uploads and try again."),
      });
      dispatch({ type: "SET_UPLOADING_COVER", value: false });
    }
  };

  const handleLoadURIs = async (addr: `0x${string}`) => {
    dispatch({ type: "SET_ERROR", error: null });
    try {
      dispatch({ type: "SET_UPLOADING_NFTS", value: true });
      const limit = pLimit(5);
      let completed = 0;
      const uris: string[] = await Promise.all(
        nfts.map((nft) =>
          limit(async () => {
            if (!nft.file) throw new Error(`NFT "${nft.name}" is missing an image file`);
            const imageUri = await uploadImage(nft.file);
            const metaUri = await uploadMetadata(nft.name, nft.description, imageUri);
            completed++;
            dispatch({ type: "SET_UPLOAD_PROGRESS", value: Math.round((completed / nfts.length) * 90) });
            return metaUri;
          }),
        ),
      );
      dispatch({ type: "SET_UPLOAD_PROGRESS", value: 95 });
      dispatch({ type: "SET_UPLOADING_NFTS", value: false });
      if (!address || !publicClient) throw new Error("Connect your wallet.");
      if (uris.length === 0) throw new Error("No NFT metadata URIs to load.");

      const CHUNK_LOAD_SIZE = 200;
      let lastTxHash: `0x${string}` | undefined;

      if (uris.length <= CHUNK_LOAD_SIZE) {
        const gas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: addr,
          abi: NFT_COLLECTION_ABI,
          functionName: "loadTokenURIs",
          args: [uris],
        });
        lastTxHash = await mutateAsync({
          address: addr,
          abi: NFT_COLLECTION_ABI,
          functionName: "loadTokenURIs",
          args: [uris],
          gas,
        });
      } else {
        for (let i = 0; i < uris.length; i += CHUNK_LOAD_SIZE) {
          const chunk = uris.slice(i, i + CHUNK_LOAD_SIZE);
          dispatch({
            type: "SET_UPLOAD_PROGRESS",
            value: 95 + Math.round(((i + chunk.length) / uris.length) * 5),
          });
          const gas = await estimateContractGasWithBuffer(publicClient, {
            account: address,
            address: addr,
            abi: NFT_COLLECTION_ABI,
            functionName: "appendTokenURIs",
            args: [chunk],
          });
          lastTxHash = await mutateAsync({
            address: addr,
            abi: NFT_COLLECTION_ABI,
            functionName: "appendTokenURIs",
            args: [chunk],
            gas,
          });
        }
      }

      if (lastTxHash) setLoadURIsHash(lastTxHash);
      dispatch({ type: "SET_UPLOAD_PROGRESS", value: 100 });
    } catch (e) {
      dispatch({
        type: "SET_ERROR",
        error: formatTransactionError(e, "Could not publish metadata on-chain. Try again."),
      });
      dispatch({ type: "SET_UPLOADING_NFTS", value: false });
    }
  };

  const handleCommitSeed = async (addr: `0x${string}`) => {
    dispatch({ type: "SET_ERROR", error: null });
    if (!address || !publicClient) {
      dispatch({ type: "SET_ERROR", error: "Connect your wallet." });
      return;
    }
    try {
      setIsCommittingSeed(true);
      const seedBytes = crypto.getRandomValues(new Uint8Array(32));
      const seed = `0x${Array.from(seedBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;
      const commitment = keccak256(seed);
      setGeneratedSeed(seed);

      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: address,
        address: addr,
        abi: NFT_COLLECTION_ABI,
        functionName: "commitMintSeed",
        args: [commitment],
      });
      const hash = await mutateAsync({
        address: addr,
        abi: NFT_COLLECTION_ABI,
        functionName: "commitMintSeed",
        args: [commitment],
        gas,
      });
      setCommitSeedHash(hash);
    } catch (e) {
      setGeneratedSeed(null);
      dispatch({ type: "SET_ERROR", error: formatTransactionError(e, "Could not commit mint seed. Try again.") });
    } finally {
      setIsCommittingSeed(false);
    }
  };

  const handleDownloadSeed = () => {
    if (!generatedSeed) return;
    const blob = new Blob(
      [JSON.stringify({ seed: generatedSeed, commitment: keccak256(generatedSeed) }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mint-seed.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySeed = async () => {
    if (!generatedSeed) return;
    await navigator.clipboard.writeText(generatedSeed);
    setSeedCopied(true);
    setTimeout(() => setSeedCopied(false), 2000);
  };

  // ── Render Logic ───────────────────────────────────────────────────────────

  // Universal Navbar and standard layout wrapper
  const pageWrapper = (content: React.ReactNode) => (
    <main className="min-h-screen bg-background text-on-surface text-on-surface">
      <Navbar />
      {content}
    </main>
  );

  // 1. Wallet Guard (High priority)
  if (!isConnected) {
    return pageWrapper(
      <WalletGuard message="Connect your wallet to deploy new NFT collections." />,
    );
  }

  // 2. All done — seed committed
  if (seedCommitted) {
    return pageWrapper(
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
        <p className="mb-6 text-sm text-on-surface-variant">
          {nfts.length} NFTs loaded and minting is unlocked. Keep your reveal
          seed safe — you will need it to call{" "}
          <code className="font-mono text-primary">revealMintSeed</code> after
          the sale closes.
        </p>
        {generatedSeed && (
          <div className="mb-6 p-4 text-left bg-surface-container-low border border-outline-variant/10 rounded-sm space-y-3">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
              Your Reveal Seed (save this!)
            </p>
            <p className="text-xs font-mono text-primary break-all">
              {generatedSeed}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadSeed}
                className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
              >
                <Download size={12} /> Download JSON
              </button>
              <button
                onClick={handleCopySeed}
                className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:border-outline transition-all"
              >
                {seedCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
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
      </div>,
    );
  }

  // 3. URIs loaded — needs commitMintSeed before minting is possible
  if (urisLoaded && !seedCommitted) {
    return pageWrapper(
      <div className="max-w-xl mx-auto px-8 py-32 text-center">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-secondary/5 border border-secondary/20 rounded-sm">
          <ShieldCheck size={36} className="text-secondary" />
        </div>
        <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase block mb-3">
          Step 3 of 3
        </span>
        <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
          Commit Mint Seed
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant leading-relaxed">
          A random seed commitment must be submitted on-chain before minting is
          unlocked. A unique seed will be generated in your browser and its
          hash committed to the contract. Save the seed — you need it to reveal
          randomness after the sale closes.
        </p>

        <div className="p-4 mb-6 text-left bg-surface-container-low border border-outline-variant/10 rounded-sm space-y-2">
          <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
            Why is this needed?
          </p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            The contract uses commit-reveal randomness to assign NFT IDs fairly.
            The commitment is a hash of your secret seed; the seed itself is
            revealed only after all mints are done, preventing manipulation.
          </p>
        </div>

        {generatedSeed && (
          <div className="mb-6 p-4 text-left bg-primary/5 border border-primary/20 rounded-sm space-y-3">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary">
              Generated Seed — Save Before Confirming
            </p>
            <p className="text-xs font-mono text-primary break-all">
              {generatedSeed}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadSeed}
                className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
              >
                <Download size={12} /> Download JSON
              </button>
              <button
                onClick={handleCopySeed}
                className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:border-outline transition-all"
              >
                {seedCopied ? "Copied!" : "Copy Seed"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm p-4 mb-4 bg-error/5 border border-error/20 text-error rounded-sm">
            {error}
          </div>
        )}

        {loadURIsHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${loadURIsHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 text-sm text-primary hover:text-primary-container transition-colors font-mono underline"
          >
            View load URIs tx on Etherscan
          </a>
        )}

        <button
          onClick={() => deployedAddress && handleCommitSeed(deployedAddress)}
          disabled={isLoading || !deployedAddress}
          className={`w-full font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
            isLoading || !deployedAddress
              ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
              : "bg-gradient-to-r from-secondary to-primary text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              {isCommittingSeed
                ? "Awaiting wallet..."
                : isConfirmingSeed
                  ? "Confirming on blockchain..."
                  : "Working..."}
            </>
          ) : (
            <>
              <ShieldCheck size={18} /> Generate Seed & Commit
            </>
          )}
        </button>
      </div>,
    );
  }

  // 4. Deployed, needs loadTokenURIs
  if (collectionCreated && !urisLoaded) {
    return pageWrapper(
      <div className="max-w-xl mx-auto px-8 py-32 text-center">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-secondary/5 border border-secondary/20 rounded-sm">
          <CheckCircle size={36} className="text-secondary" />
        </div>
        <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase block mb-3">
          Step 2 of 3 · Contract Deployed
        </span>
        <h1 className="font-headline text-4xl font-bold tracking-tighter mb-3 uppercase">
          Collection Deployed!
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Now load the {nfts.length} NFTs onto the blockchain. A mint seed
          commitment step will follow.
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
            className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${isLoading || !deployedAddress
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
      </div>,
    );
  }

  // 4. Main form
  return pageWrapper(
    <div className="pt-32 pb-20 max-w-[1920px] mx-auto px-8">
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
        <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6">
          <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3">
            <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest">
              01
            </span>
            Collection Data
          </h2>

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
                dispatch({ type: "SET_COVER", file: f, preview: f ? URL.createObjectURL(f) : "" });
              }}
            />
            <label
              htmlFor="cover-upload"
              className={`block p-8 text-center cursor-pointer transition-all border rounded-sm focus-within:ring-2 focus-within:ring-primary/30 ${coverFile
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
                  <span
                    className={`${uploadButtonClass} border-outline-variant/25 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary`}
                  >
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
                  dispatch({ type: "SET_NAME", value: e.target.value });
                  dispatch({ type: "CLEAR_FIELD_ERROR", field: "name" });
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
                  dispatch({ type: "SET_SYMBOL", value: e.target.value.toUpperCase() });
                  dispatch({ type: "CLEAR_FIELD_ERROR", field: "symbol" });
                }}
                maxLength={8}
                className={`${fieldErrors.symbol ? inputErrorClass : inputClass
                  } uppercase`}
                placeholder="e.g. CYBM"
              />
              <FieldError msg={fieldErrors.symbol} />
            </div>
          </div>

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
                dispatch({ type: "SET_DESCRIPTION", value: e.target.value });
                dispatch({ type: "CLEAR_FIELD_ERROR", field: "description" });
              }}
              className={`${fieldErrors.description ? inputErrorClass : inputClass
                } h-24 resize-none`}
              placeholder="Describe your collection..."
            />
            <FieldError msg={fieldErrors.description} />
          </div>

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
                dispatch({ type: "SET_MINT_PRICE", value: e.target.value });
                dispatch({ type: "CLEAR_FIELD_ERROR", field: "mintPrice" });
              }}
              className={fieldErrors.mintPrice ? inputErrorClass : inputClass}
              placeholder="0.0001"
            />
            <FieldError msg={fieldErrors.mintPrice} />
          </div>

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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {hasMounted ? (
              <>
                <label className="block text-xs text-on-surface-variant">
                  Bulk metadata file (.json array)
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="application/json"
                      onChange={handleBulkMetadataFileChange}
                      className="w-full rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none cursor-pointer"
                      disabled={
                        isBulkProcessing || isUploadingNFTs || isLoading
                      }
                    />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {bulkMetadataName
                        ? `Selecionado: ${bulkMetadataName}`
                        : "Nenhum arquivo JSON selecionado"}
                    </p>
                  </div>
                </label>

                <label className="block text-xs text-on-surface-variant">
                  Bulk images (.png, .jpg, etc.)
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBulkImageFilesChange}
                      multiple
                      className="w-full rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none cursor-pointer"
                      disabled={
                        isBulkProcessing || isUploadingNFTs || isLoading
                      }
                    />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {bulkImageNames.length > 0
                        ? `Selecionadas: ${bulkImageNames.join(", ")}`
                        : "Nenhuma imagem selecionada"}
                    </p>
                  </div>
                </label>
              </>
            ) : (
              <>
                <div className="h-28 rounded-sm border border-outline-variant/20 bg-surface-container" />
                <div className="h-28 rounded-sm border border-outline-variant/20 bg-surface-container" />
              </>
            )}
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <button
              onClick={handleParseBulkNFTs}
              disabled={isBulkProcessing || isUploadingNFTs || isLoading}
              className="py-2 px-3 font-semibold text-xs rounded-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
            >
              {isBulkProcessing ? "Parsing bulk metadata..." : "Load bulk NFTs"}
            </button>
            {bulkParsingError && (
              <p className="text-xs text-error">{bulkParsingError}</p>
            )}
          </div>
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
            {pagedNFTs.map((nft, index) => (
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
                        updateNFT(nft.id, "file", e.target.files?.[0] || null)
                      }
                    />
                    <label
                      htmlFor={`nft-file-${nft.id}`}
                      className={`w-24 h-24 relative flex items-center justify-center cursor-pointer overflow-hidden rounded-sm transition-all border focus-within:ring-2 focus-within:ring-primary/30 ${nft.file
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
                        #
                        {String(
                          (currentPage - 1) * NFTs_PER_PAGE + index + 1,
                        ).padStart(3, "0")}
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

            <div className="flex items-center justify-between px-2 py-1 text-xs text-on-surface-variant bg-surface-container-high rounded-sm">
              <button
                onClick={() => dispatch({ type: "SET_PAGE", page: Math.max(1, currentPage - 1) })}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded-sm border border-outline-variant/20 hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() =>
                  dispatch({ type: "SET_PAGE", page: Math.min(totalPages, currentPage + 1) })
                }
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded-sm border border-outline-variant/20 hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

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

      <div className="flex justify-center pt-2 pb-8">
        <div className="relative group overflow-hidden rounded-sm">
        <button
          onClick={handleCreateCollection}
          disabled={isLoading || nfts.length === 0}
          className={`relative overflow-hidden font-headline font-bold px-10 py-3.5 flex items-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${isLoading || nfts.length === 0
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
                : `Create Collection with ${nfts.length} NFT${nfts.length !== 1 ? "s" : ""
                }`}
        </button>
        </div>
      </div>
      <Footer />
    </div>,
  );
}
