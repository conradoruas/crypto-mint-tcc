"use client";

import { Loader2, ShoppingCart, Tag, X } from "lucide-react";
import { EthAmountInput, IconButton } from "@/components/ui";
import type { ListPriceErrors } from "@/lib/schemas";
import type { TwoStepTxPhase } from "@/types/marketplace";

interface ListingPanelProps {
  isListed: boolean;
  price: string | null | undefined;
  isOwner: boolean;
  // Buy state
  isBuying: boolean;
  isBuyConfirming: boolean;
  onBuy: () => void;
  // Cancel listing state
  isCancelling: boolean;
  onCancelListing: () => void;
  // List form state
  showListForm: boolean;
  listPrice: string;
  listErrors: ListPriceErrors;
  isListing: boolean;
  listPhase: TwoStepTxPhase;
  onShowListForm: () => void;
  onHideListForm: () => void;
  onListPriceChange: (v: string) => void;
  onList: () => void;
}

function listFlowLabel(phase: TwoStepTxPhase): string {
  switch (phase) {
    case "approve-wallet": return "Approve in wallet…";
    case "approve-confirm": return "Confirming approval…";
    case "exec-wallet": return "Sign listing…";
    case "exec-confirm": return "Confirming listing…";
    default: return "Working…";
  }
}

export function ListingPanel({
  isListed,
  price,
  isOwner,
  isBuying,
  isBuyConfirming,
  onBuy,
  isCancelling,
  onCancelListing,
  showListForm,
  listPrice,
  listErrors,
  isListing,
  listPhase,
  onShowListForm,
  onHideListForm,
  onListPriceChange,
  onList,
}: ListingPanelProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
      {isListed && price ? (
        <>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1 font-headline font-bold">
              Sale Price
            </p>
            <p className="font-headline text-3xl font-bold text-primary">
              {price} ETH
            </p>
          </div>
          {isOwner ? (
            <button
              onClick={onCancelListing}
              disabled={isCancelling}
              className={`w-full font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${
                isCancelling
                  ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                  : "bg-error/5 border-error/20 text-error hover:bg-error/10"
              }`}
            >
              {isCancelling ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <X size={18} />
              )}
              {isCancelling ? "Cancelling..." : "Cancel Listing"}
            </button>
          ) : (
            <div className="relative group overflow-hidden">
              <button
                onClick={onBuy}
                disabled={isBuying || isBuyConfirming}
                className={`w-full relative overflow-hidden font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                  isBuying || isBuyConfirming
                    ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                }`}
              >
                {!(isBuying || isBuyConfirming) && (
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                )}
                {isBuying || isBuyConfirming ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ShoppingCart size={18} />
                )}
                {isBuying
                  ? "Awaiting wallet..."
                  : isBuyConfirming
                    ? "Confirming..."
                    : "Buy Now"}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-on-surface-variant/50 uppercase tracking-widest text-xs">
            This NFT is not for sale.
          </p>
          {isOwner &&
            (showListForm ? (
              <div className="space-y-3">
                <EthAmountInput
                  value={listPrice}
                  onChange={(v) => onListPriceChange(v)}
                  placeholder="Price in ETH (e.g. 0.05)"
                  aria-label="Listing price in ETH"
                  error={listErrors.price}
                />
                <div className="flex gap-3">
                  <button
                    onClick={onList}
                    disabled={isListing}
                    className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                      isListing
                        ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110"
                    }`}
                  >
                    {isListing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Tag size={16} />
                    )}
                    {isListing ? listFlowLabel(listPhase) : "Confirm Listing"}
                  </button>
                  <IconButton
                    onClick={onHideListForm}
                    aria-label="Close"
                    variant="outlined"
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="relative group overflow-hidden">
                <button
                  onClick={onShowListForm}
                  className="w-full relative overflow-hidden font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99] transition-all text-sm uppercase tracking-widest"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <Tag size={18} /> List for Sale
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
