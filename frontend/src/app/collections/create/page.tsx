"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useReadContract } from "wagmi";
import { zeroAddress } from "viem";
import { Navbar } from "@/components/navbar";
import Footer from "@/components/Footer";
import { WalletGuard } from "@/components/WalletGuard";
import {
  FACTORY_ADDRESS,
  NFT_COLLECTION_FACTORY_ABI,
} from "@/constants/contracts";
import type { CreateCollectionErrors } from "@/lib/schemas";
import { formatTransactionError } from "@/lib/txErrors";
import { usePublishCollectionUris } from "@/hooks/collections/usePublishCollectionUris";
import { CreateCollectionForm } from "./CreateCollectionForm";
import {
  CreateCollectionCompleteStep,
  CreateCollectionSeedStep,
  CreateCollectionUrisStep,
} from "./CreateCollectionStatusViews";
import { useCollectionDeploymentFlow } from "./useCollectionDeploymentFlow";
import { useCreateCollectionDraftManager } from "./useCreateCollectionDraftManager";
import { useSeedCommitmentFlow } from "./useSeedCommitmentFlow";

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      {children}
    </main>
  );
}

export default function CreateCollectionPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const drafts = useCreateCollectionDraftManager();
  const form = drafts.form;

  const setError = useCallback(
    (message: string | null) =>
      drafts.dispatch({ type: "SET_ERROR", error: message }),
    [drafts],
  );
  const setFieldErrors = useCallback(
    (errors: CreateCollectionErrors) =>
      drafts.dispatch({ type: "SET_FIELD_ERRORS", errors }),
    [drafts],
  );

  const deployment = useCollectionDeploymentFlow({
    form,
    setError,
    setFieldErrors,
  });

  const uriPublishing = usePublishCollectionUris();
  const seedFlow = useSeedCommitmentFlow(setError);

  const { data: creatorCollectionIds } = useReadContract({
    address: FACTORY_ADDRESS ?? zeroAddress,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address as `0x${string}`],
    query: {
      enabled: !!FACTORY_ADDRESS && !!deployment.collectionCreated && !!address,
      refetchInterval: 2_000,
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

  const isLoading =
    deployment.isUploadingCover ||
    deployment.isCreating ||
    deployment.isConfirmingCreate ||
    uriPublishing.isUploading ||
    uriPublishing.isWalletPending ||
    uriPublishing.isConfirming ||
    seedFlow.isCommittingSeed ||
    seedFlow.isConfirmingSeed;

  const handleLoadUris = useCallback(async () => {
    if (!deployedAddress) {
      return;
    }

    setError(null);

    try {
      await uriPublishing.publishUris({
        collectionAddress: deployedAddress,
        drafts: form.nfts.map((n) => ({
          name: n.name,
          description: n.description,
          file: n.file,
          attributes: n.attributes,
        })),
      });
    } catch (cause) {
      setError(
        formatTransactionError(
          cause,
          "Could not publish metadata on-chain. Try again.",
        ),
      );
    }
  }, [deployedAddress, form.nfts, setError, uriPublishing]);

  const handleCommitSeed = useCallback(() => {
    if (deployedAddress) {
      void seedFlow.commitSeed(deployedAddress);
    }
  }, [deployedAddress, seedFlow]);

  const handleUpdateField = useCallback(
    (field: "name" | "symbol" | "description" | "mintPrice", value: string) => {
      drafts.dispatch({
        type:
          field === "name"
            ? "SET_NAME"
            : field === "symbol"
              ? "SET_SYMBOL"
              : field === "description"
                ? "SET_DESCRIPTION"
                : "SET_MINT_PRICE",
        value,
      });
    },
    [drafts],
  );

  const handleClearFieldError = useCallback(
    (field: keyof CreateCollectionErrors) =>
      drafts.dispatch({ type: "CLEAR_FIELD_ERROR", field }),
    [drafts],
  );

  if (!isConnected) {
    return (
      <PageShell>
        <WalletGuard message="Connect your wallet to deploy new NFT collections." />
      </PageShell>
    );
  }

  if (seedFlow.seedCommitted) {
    return (
      <PageShell>
        <CreateCollectionCompleteStep
          nftCount={form.nfts.length}
          generatedSeed={seedFlow.generatedSeed}
          seedCopied={seedFlow.seedCopied}
          onDownloadSeed={seedFlow.downloadSeed}
          onCopySeed={seedFlow.copySeed}
          onViewCollections={() => router.push("/collections")}
          onCreateAnother={() => router.push("/collections/create")}
        />
      </PageShell>
    );
  }

  if (uriPublishing.isSuccess) {
    return (
      <PageShell>
        <CreateCollectionSeedStep
          error={form.error}
          isBusy={isLoading || !deployedAddress}
          isCommittingSeed={seedFlow.isCommittingSeed}
          isConfirmingSeed={seedFlow.isConfirmingSeed}
          generatedSeed={seedFlow.generatedSeed}
          seedCopied={seedFlow.seedCopied}
          loadURIsHash={uriPublishing.txHash}
          onCommitSeed={handleCommitSeed}
          onDownloadSeed={seedFlow.downloadSeed}
          onCopySeed={seedFlow.copySeed}
        />
      </PageShell>
    );
  }

  if (deployment.collectionCreated) {
    return (
      <PageShell>
        <CreateCollectionUrisStep
          nftCount={form.nfts.length}
          deployedAddress={deployedAddress}
          createHash={deployment.createHash}
          uploadProgress={uriPublishing.progress}
          isUploadingNFTs={uriPublishing.isUploading}
          isLoadingURIs={uriPublishing.isWalletPending}
          isConfirmingLoad={uriPublishing.isConfirming}
          error={form.error}
          isBusy={isLoading}
          onLoadUris={handleLoadUris}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <CreateCollectionForm
        form={form}
        pagedNFTs={drafts.pagedNFTs}
        totalPages={drafts.totalPages}
        isLoading={isLoading}
        isCreating={deployment.isCreating}
        isConfirmingCreate={deployment.isConfirmingCreate}
        isUploadingCover={deployment.isUploadingCover}
        onSetCoverFile={drafts.setCoverFile}
        onUpdateField={handleUpdateField}
        onClearFieldError={handleClearFieldError}
        onAddNFT={drafts.addNFT}
        onRemoveNFT={drafts.removeNFT}
        onUpdateNFTField={drafts.updateNFTField}
        onSetNFTFile={drafts.setNFTFile}
        onSetPage={drafts.setPage}
        onSetTraitSchema={drafts.setTraitSchema}
        onSetNFTAttributes={drafts.setNFTAttributes}
        onBulkMetadataFileChange={drafts.handleBulkMetadataFileChange}
        onBulkImageFilesChange={drafts.handleBulkImageFilesChange}
        onParseBulkNFTs={drafts.parseBulkNFTs}
        onSubmit={deployment.createCollection}
      />
      <Footer />
    </PageShell>
  );
}
