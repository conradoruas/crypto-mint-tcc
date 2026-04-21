"use client";

import { useCallback } from "react";
import { useConnection } from "wagmi";
import type { NFTItem } from "@/types/nft";
import {
  useAcceptOffer,
  useBuyNFT,
  useCancelListing,
  useCancelOffer,
  useListNFT,
  useMakeOffer,
  useMyOffer,
  useNFTListing,
  useNFTOffers,
} from "@/hooks/marketplace";
import { useFavorite, useIsFavorited } from "@/hooks/user";
import { useAssetNft } from "./useAssetNft";
import { useAssetPageActions } from "./useAssetPageActions";

export function useAssetPageCoordinator(
  tokenId: string,
  nftContract: `0x${string}` | null,
  initialNft?: NFTItem | null,
) {
  const { address } = useConnection();
  const { nft, isLoadingNft } = useAssetNft(
    tokenId,
    nftContract ?? null,
    initialNft,
  );

  const {
    owner,
    isListed,
    price,
    refetch: refetchListing,
  } = useNFTListing(nftContract ?? "", tokenId);
  const {
    hasActiveOffer,
    offerAmount: myOfferAmount,
    expiresAt,
    refetch: refetchMyOffer,
  } = useMyOffer(nftContract ?? "", tokenId);
  const {
    offers,
    isLoading: isLoadingOffers,
    topOffer,
    refetch: refetchOffers,
  } = useNFTOffers(nftContract ?? "", tokenId);

  const { listNFT, isPending: isListing, phase: listPhase } = useListNFT();
  const {
    buyNFT,
    isPending: isBuying,
    isConfirming: isBuyConfirming,
    isSuccess: isBought,
    hash: buyHash,
  } = useBuyNFT();
  const { cancelListing, isPending: isCancelling, isSuccess: isCancelled } =
    useCancelListing();
  const {
    makeOffer,
    isPending: isMakingOffer,
    isConfirming: isOfferConfirming,
    isSuccess: isOfferMade,
  } = useMakeOffer();
  const { acceptOffer, isPending: isAccepting } = useAcceptOffer();
  const {
    cancelOffer,
    isPending: isCancellingOffer,
    isSuccess: isOfferCancelled,
  } = useCancelOffer();

  const { isFavorited } = useIsFavorited(nftContract ?? "", tokenId);
  const { toggleFavorite } = useFavorite();

  const isOwner = Boolean(
    address && owner && address.toLowerCase() === owner.toLowerCase(),
  );

  const refetchAll = useCallback(() => {
    refetchListing();
    refetchMyOffer();
    refetchOffers();
  }, [refetchListing, refetchMyOffer, refetchOffers]);

  const actions = useAssetPageActions({
    nftName: nft?.name,
    nftContract,
    tokenId,
    price,
    buyHash,
    isBought,
    isOfferMade,
    isOfferCancelled,
    isCancelled,
    refetchAll,
    listNFT,
    buyNFT,
    cancelListing,
    makeOffer,
    acceptOffer,
    cancelOffer,
  });

  return {
    address,
    nft,
    isLoadingNft,
    owner,
    isListed,
    price,
    hasActiveOffer,
    myOfferAmount,
    expiresAt,
    offers,
    isLoadingOffers,
    topOffer,
    isListing,
    listPhase,
    isBuying,
    isBuyConfirming,
    isCancelling,
    isMakingOffer,
    isOfferConfirming,
    isAccepting,
    isCancellingOffer,
    isFavorited,
    toggleFavorite,
    isOwner,
    actions,
  };
}
