"use client";

import { useMemo, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { useCollectionDetails, useCollectionNFTs } from "@/hooks/collections";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { useCollectionOwnerActions } from "./useCollectionOwnerActions";

export function useCollectionPageCoordinator(collectionAddress: string) {
  const { address: userAddress, isConnected } = useConnection();
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [didLoadUrisLocally, setDidLoadUrisLocally] = useState(false);

  const details = useCollectionDetails(collectionAddress);
  const nftState = useCollectionNFTs(collectionAddress);

  const { data: urisLoadedData, refetch: refetchUrisLoaded } = useReadContract({
    address: collectionAddress as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "urisLoaded",
    query: { enabled: !!collectionAddress },
  });
  const urisLoaded = (urisLoadedData as boolean | undefined) || didLoadUrisLocally;

  const { data: mintSeedCommittedData, refetch: refetchMintSeedCommitted } =
    useReadContract({
      address: collectionAddress as `0x${string}`,
      abi: NFT_COLLECTION_ABI,
      functionName: "mintSeedCommitted",
      query: { enabled: !!collectionAddress },
    });
  const mintSeedCommitted = Boolean(mintSeedCommittedData);

  const ownerActions = useCollectionOwnerActions(
    collectionAddress as `0x${string}`,
    userAddress,
    refetchMintSeedCommitted,
  );

  const isOwner = Boolean(
    userAddress &&
      details.owner &&
      userAddress.toLowerCase() === details.owner.toLowerCase(),
  );

  const supplyPercent = useMemo(() => {
    if (!details.maxSupply || details.maxSupply <= 0n) {
      return 0;
    }

    return Number(
      (BigInt(nftState.totalSupply) * BigInt(100)) / details.maxSupply,
    );
  }, [details.maxSupply, nftState.totalSupply]);

  const isSoldOut = Boolean(
    details.maxSupply && BigInt(nftState.totalSupply) >= details.maxSupply,
  );

  const bannerImage = details.image ? resolveIpfsUrl(details.image) : null;

  const handleLoadSuccess = () => {
    setDidLoadUrisLocally(true);
    refetchUrisLoaded();
  };

  return {
    userAddress,
    isConnected,
    showMintModal,
    setShowMintModal,
    mintSuccess,
    setMintSuccess,
    details,
    nftState,
    urisLoaded,
    mintSeedCommitted,
    ownerActions,
    isOwner,
    supplyPercent,
    isSoldOut,
    bannerImage,
    handleLoadSuccess,
  };
}
