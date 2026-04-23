"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addressSchema,
  getZodErrors,
  listPriceSchema,
  offerAmountSchema,
} from "@/lib/schemas";
import type { ListPriceErrors, OfferAmountErrors } from "@/lib/schemas";
import { formatTransactionError } from "@/lib/txErrors";
import { logger } from "@/lib/logger";
import { buildEtherscanTxUrl, openSafeExternalUrl } from "@/lib/externalLinks";

type AssetPageActionsArgs = {
  nftName?: string;
  nftContract: `0x${string}` | null | undefined;
  tokenId: string;
  price: string | null;
  buyHash?: `0x${string}`;
  isBought: boolean;
  isOfferMade: boolean;
  isOfferCancelled: boolean;
  isCancelled: boolean;
  refetchAll: () => void;
  listNFT: (nftContract: `0x${string}`, tokenId: string, price: string) => Promise<void>;
  buyNFT: (nftContract: `0x${string}`, tokenId: string, priceInEth: string) => Promise<void>;
  cancelListing: (nftContract: `0x${string}`, tokenId: string) => Promise<void>;
  makeOffer: (nftContract: `0x${string}`, tokenId: string, amount: string) => Promise<void>;
  acceptOffer: (nftContract: `0x${string}`, tokenId: string, buyerAddress: `0x${string}`) => Promise<void>;
  cancelOffer: (nftContract: `0x${string}`, tokenId: string) => Promise<void>;
};

export function useAssetPageActions({
  nftName,
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
}: AssetPageActionsArgs) {
  const [listPrice, setListPrice] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showListForm, setShowListForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [listErrors, setListErrors] = useState<ListPriceErrors>({});
  const [offerErrors, setOfferErrors] = useState<OfferAmountErrors>({});
  const [copied, setCopied] = useState(false);
  const buyTxUrl = buildEtherscanTxUrl(buyHash);

  useEffect(() => {
    if (isBought) {
      toast.success("NFT purchased successfully!", {
        action: buyTxUrl
          ? {
              label: "View Tx",
              onClick: () => openSafeExternalUrl(buyTxUrl),
            }
          : undefined,
      });
      refetchAll();
    }
  }, [buyTxUrl, isBought, refetchAll]);

  useEffect(() => {
    if (isOfferMade) {
      toast.success("Offer sent! ETH is held in escrow for 7 days.");
      refetchAll();
      queueMicrotask(() => {
        setShowOfferForm(false);
        setOfferAmount("");
      });
    }
  }, [isOfferMade, refetchAll]);

  useEffect(() => {
    if (isOfferCancelled) {
      toast.success("Offer cancelled. ETH returned.");
      refetchAll();
    }
  }, [isOfferCancelled, refetchAll]);

  useEffect(() => {
    if (isCancelled) {
      toast.success("Listing cancelled.");
      refetchAll();
      queueMicrotask(() => setShowListForm(false));
    }
  }, [isCancelled, refetchAll]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = nftName ?? "NFT";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    }
  }, [nftName]);

  const handleList = useCallback(async () => {
    const errors = getZodErrors(listPriceSchema, { price: listPrice }) as ListPriceErrors;
    setListErrors(errors);
    if (errors.price) return;

      try {
        if (!nftContract) return;
        await listNFT(nftContract, tokenId, listPrice);
      setShowListForm(false);
      setListPrice("");
      toast.success("NFT listed successfully!");
      refetchAll();
    } catch (error) {
      toast.error(formatTransactionError(error, "Could not list this NFT."));
    }
  }, [listNFT, listPrice, nftContract, refetchAll, tokenId]);

  const handleBuy = useCallback(async () => {
    if (!price) return;
    try {
      if (!nftContract) return;
      await buyNFT(nftContract, tokenId, price);
    } catch (error) {
      toast.error(formatTransactionError(error, "Could not complete purchase."));
    }
  }, [buyNFT, nftContract, price, tokenId]);

  const handleCancelListing = useCallback(async () => {
    try {
      if (!nftContract) return;
      await cancelListing(nftContract, tokenId);
    } catch (error) {
      toast.error(formatTransactionError(error, "Could not cancel listing."));
    }
  }, [cancelListing, nftContract, tokenId]);

  const handleMakeOffer = useCallback(async () => {
    const errors = getZodErrors(offerAmountSchema, {
      amount: offerAmount,
    }) as OfferAmountErrors;
    setOfferErrors(errors);
    if (errors.amount) return;

    try {
      if (!nftContract) return;
      await makeOffer(nftContract, tokenId, offerAmount);
    } catch (error) {
      toast.error(formatTransactionError(error, "Could not send offer."));
    }
  }, [makeOffer, nftContract, offerAmount, tokenId]);

  const handleAcceptOffer = useCallback(
    async (buyerAddress: string) => {
      const result = addressSchema.safeParse(buyerAddress);
      if (!result.success) {
        toast.error("Buyer address is invalid. Action cancelled for security.");
        return;
      }

      try {
        if (!nftContract) return;
        await acceptOffer(nftContract, tokenId, result.data);
        toast.success("Offer accepted! NFT transferred.");
        refetchAll();
      } catch (error) {
        logger.error("acceptOffer failed", error);
        toast.error(formatTransactionError(error, "Could not accept offer."));
      }
    },
    [acceptOffer, nftContract, refetchAll, tokenId],
  );

  const handleCancelOffer = useCallback(async () => {
    try {
      if (!nftContract) return;
      await cancelOffer(nftContract, tokenId);
    } catch (error) {
      toast.error(formatTransactionError(error, "Could not cancel offer."));
    }
  }, [cancelOffer, nftContract, tokenId]);

  return {
    listPrice,
    setListPrice,
    offerAmount,
    setOfferAmount,
    showListForm,
    setShowListForm,
    showOfferForm,
    setShowOfferForm,
    listErrors,
    setListErrors,
    offerErrors,
    setOfferErrors,
    copied,
    handleShare,
    handleList,
    handleBuy,
    handleCancelListing,
    handleMakeOffer,
    handleAcceptOffer,
    handleCancelOffer,
  };
}
