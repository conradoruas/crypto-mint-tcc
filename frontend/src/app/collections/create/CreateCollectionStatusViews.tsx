"use client";

import { CheckCircle, Download, Loader2, ShieldCheck, Upload } from "lucide-react";
import { buildEtherscanTxUrl } from "@/lib/externalLinks";

type SeedActionsProps = {
  generatedSeed: `0x${string}` | null;
  seedCopied: boolean;
  onDownloadSeed: () => void;
  onCopySeed: () => void | Promise<void>;
};

function SeedActions({
  generatedSeed,
  seedCopied,
  onDownloadSeed,
  onCopySeed,
}: SeedActionsProps) {
  if (!generatedSeed) {
    return null;
  }

  return (
    <div className="mb-6 p-4 text-left bg-primary/5 border border-primary/20 rounded-sm space-y-3">
      <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary">
        Generated Seed
      </p>
      <p className="text-xs font-mono text-primary break-all">{generatedSeed}</p>
      <div className="flex gap-2">
        <button
          onClick={onDownloadSeed}
          className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
        >
          <Download size={12} /> Download JSON
        </button>
        <button
          onClick={onCopySeed}
          className="flex items-center gap-1.5 text-xs font-headline font-bold px-3 py-1.5 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:border-outline transition-all"
        >
          {seedCopied ? "Copied!" : "Copy Seed"}
        </button>
      </div>
    </div>
  );
}

export function CreateCollectionUrisStep(props: {
  nftCount: number;
  deployedAddress: `0x${string}` | null;
  createHash?: `0x${string}`;
  uploadProgress: number;
  isUploadingNFTs: boolean;
  isLoadingURIs: boolean;
  isConfirmingLoad: boolean;
  error: string | null;
  isBusy: boolean;
  onLoadUris: () => void;
}) {
  const {
    nftCount,
    deployedAddress,
    createHash,
    uploadProgress,
    isUploadingNFTs,
    isLoadingURIs,
    isConfirmingLoad,
    error,
    isBusy,
    onLoadUris,
  } = props;
  const createTxUrl = buildEtherscanTxUrl(createHash);

  return (
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
        Now load the {nftCount} NFTs onto the blockchain. A mint seed
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

      {createTxUrl && (
        <a
          href={createTxUrl}
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

      <button
        onClick={onLoadUris}
        disabled={isBusy || !deployedAddress}
        className={`w-full relative overflow-hidden font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
          isBusy || !deployedAddress
            ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
            : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
        }`}
      >
        {isBusy || !deployedAddress ? (
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
            <Upload size={18} /> Load {nftCount} NFTs onto Blockchain
          </>
        )}
      </button>
    </div>
  );
}

export function CreateCollectionSeedStep(props: {
  error: string | null;
  isBusy: boolean;
  isCommittingSeed: boolean;
  isConfirmingSeed: boolean;
  generatedSeed: `0x${string}` | null;
  seedCopied: boolean;
  loadURIsHash?: `0x${string}`;
  onCommitSeed: () => void;
  onDownloadSeed: () => void;
  onCopySeed: () => void | Promise<void>;
}) {
  const {
    error,
    isBusy,
    isCommittingSeed,
    isConfirmingSeed,
    generatedSeed,
    seedCopied,
    loadURIsHash,
    onCommitSeed,
    onDownloadSeed,
    onCopySeed,
  } = props;
  const loadUrisTxUrl = buildEtherscanTxUrl(loadURIsHash);

  return (
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
        unlocked. Save the seed so you can reveal randomness after the sale
        closes.
      </p>

      <SeedActions
        generatedSeed={generatedSeed}
        seedCopied={seedCopied}
        onDownloadSeed={onDownloadSeed}
        onCopySeed={onCopySeed}
      />

      {error && (
        <div className="text-sm p-4 mb-4 bg-error/5 border border-error/20 text-error rounded-sm">
          {error}
        </div>
      )}

      {loadUrisTxUrl && (
        <a
          href={loadUrisTxUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6 text-sm text-primary hover:text-primary-container transition-colors font-mono underline"
        >
          View load URIs tx on Etherscan
        </a>
      )}

      <button
        onClick={onCommitSeed}
        disabled={isBusy}
        className={`w-full font-headline font-bold py-5 flex items-center justify-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
          isBusy
            ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
            : "bg-gradient-to-r from-secondary to-primary text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
        }`}
      >
        {isBusy ? (
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
    </div>
  );
}

export function CreateCollectionCompleteStep(props: {
  nftCount: number;
  generatedSeed: `0x${string}` | null;
  seedCopied: boolean;
  onDownloadSeed: () => void;
  onCopySeed: () => void | Promise<void>;
  onViewCollections: () => void;
  onCreateAnother: () => void;
}) {
  const {
    nftCount,
    generatedSeed,
    seedCopied,
    onDownloadSeed,
    onCopySeed,
    onViewCollections,
    onCreateAnother,
  } = props;

  return (
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
        {nftCount} NFTs loaded and minting is unlocked. Keep your reveal seed
        safe for the later reveal step.
      </p>

      <SeedActions
        generatedSeed={generatedSeed}
        seedCopied={seedCopied}
        onDownloadSeed={onDownloadSeed}
        onCopySeed={onCopySeed}
      />

      <div className="flex gap-4 justify-center">
        <button
          onClick={onViewCollections}
          className="font-headline font-bold px-6 py-3 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed text-sm uppercase tracking-wider hover:brightness-110 transition-all"
        >
          View Collections
        </button>
        <button
          onClick={onCreateAnother}
          className="font-headline font-bold px-6 py-3 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-all text-sm uppercase tracking-wider"
        >
          Create Another
        </button>
      </div>
    </div>
  );
}
