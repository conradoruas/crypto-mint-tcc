import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetPageActions } from "./useAssetPageActions";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe("useAssetPageActions", () => {
  const listNFT = vi.fn();
  const buyNFT = vi.fn();
  const cancelListing = vi.fn();
  const makeOffer = vi.fn();
  const acceptOffer = vi.fn();
  const cancelOffer = vi.fn();
  const refetchAll = vi.fn();

  beforeEach(() => {
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    listNFT.mockReset();
    buyNFT.mockReset();
    cancelListing.mockReset();
    makeOffer.mockReset();
    acceptOffer.mockReset();
    cancelOffer.mockReset();
    refetchAll.mockReset();
  });

  function renderActions(
    overrides: Partial<Parameters<typeof useAssetPageActions>[0]> = {},
  ) {
    const initialProps: Parameters<typeof useAssetPageActions>[0] = {
        nftName: "Genesis",
        nftContract: "0x3000000000000000000000000000000000000003",
        tokenId: "7",
        price: "0.25",
        buyHash: undefined,
        isBought: false,
        isOfferMade: false,
        isOfferCancelled: false,
        isCancelled: false,
        refetchAll,
        listNFT,
        buyNFT,
        cancelListing,
        makeOffer,
        acceptOffer,
        cancelOffer,
        ...overrides,
      };

    return renderHook(
      (props: Parameters<typeof useAssetPageActions>[0]) =>
        useAssetPageActions(props),
      { initialProps },
    );
  }

  it("validates buyer address before accepting an offer", async () => {
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAcceptOffer("invalid-address");
    });

    expect(acceptOffer).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Buyer address is invalid. Action cancelled for security.",
    );
  });

  it("lists an NFT, clears the form, and refetches data", async () => {
    listNFT.mockResolvedValue(undefined);
    const { result } = renderActions();

    act(() => {
      result.current.setShowListForm(true);
      result.current.setListPrice("0.55");
    });

    await act(async () => {
      await result.current.handleList();
    });

    expect(listNFT).toHaveBeenCalledWith(
      "0x3000000000000000000000000000000000000003",
      "7",
      "0.55",
    );
    expect(result.current.showListForm).toBe(false);
    expect(result.current.listPrice).toBe("");
    expect(refetchAll).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("NFT listed successfully!");
  });

  it("reacts to offer success by resetting the offer form", async () => {
    const { result, rerender } = renderActions();

    act(() => {
      result.current.setShowOfferForm(true);
      result.current.setOfferAmount("0.8");
    });

    rerender({
      nftName: "Genesis",
      nftContract: "0x3000000000000000000000000000000000000003",
      tokenId: "7",
      price: "0.25",
      buyHash: undefined,
      isBought: false,
      isOfferMade: true,
      isOfferCancelled: false,
      isCancelled: false,
      refetchAll,
      listNFT,
      buyNFT,
      cancelListing,
      makeOffer,
      acceptOffer,
      cancelOffer,
    });

    await waitFor(() => expect(result.current.showOfferForm).toBe(false));
    expect(result.current.offerAmount).toBe("");
    expect(refetchAll).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Offer sent! ETH is held in escrow for 7 days.",
    );
  });
});
