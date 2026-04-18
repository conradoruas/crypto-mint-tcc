"use client";

import { CheckCircle, HandCoins, Loader2, X } from "lucide-react";
import { EthAmountInput, IconButton } from "@/components/ui";
import { ExpiresIn } from "@/components/marketplace/OffersTable";
import type { OfferAmountErrors } from "@/lib/schemas";

interface OfferPanelProps {
  hasActiveOffer: boolean;
  myOfferAmount: string | null | undefined;
  expiresAt: Date | null | undefined;
  showOfferForm: boolean;
  offerAmount: string;
  offerErrors: OfferAmountErrors;
  isMakingOffer: boolean;
  isOfferConfirming: boolean;
  isCancellingOffer: boolean;
  onShowOfferForm: () => void;
  onHideOfferForm: () => void;
  onOfferAmountChange: (v: string) => void;
  onMakeOffer: () => void;
  onCancelOffer: () => void;
}

export function OfferPanel({
  hasActiveOffer,
  myOfferAmount,
  expiresAt,
  showOfferForm,
  offerAmount,
  offerErrors,
  isMakingOffer,
  isOfferConfirming,
  isCancellingOffer,
  onShowOfferForm,
  onHideOfferForm,
  onOfferAmountChange,
  onMakeOffer,
  onCancelOffer,
}: OfferPanelProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 p-6 space-y-4 rounded-sm">
      <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
        <HandCoins size={16} className="text-secondary" />
        Make an Offer
      </h3>
      {hasActiveOffer ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm p-3 rounded-sm bg-primary/5 border border-primary/20 text-primary">
            <CheckCircle size={14} />
            <span>
              Your active offer:{" "}
              <strong className="font-mono">{myOfferAmount} ETH</strong>
            </span>
          </div>
          {expiresAt && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              Expires: <ExpiresIn expiresAt={expiresAt} />
            </div>
          )}
          <button
            onClick={onCancelOffer}
            disabled={isCancellingOffer}
            className={`w-full font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest border ${
              isCancellingOffer
                ? "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/10 cursor-not-allowed"
                : "bg-error/5 border-error/20 text-error hover:bg-error/10"
            }`}
          >
            {isCancellingOffer ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <X size={16} />
            )}
            {isCancellingOffer ? "Cancelling..." : "Cancel Offer & Reclaim ETH"}
          </button>
        </div>
      ) : showOfferForm ? (
        <div className="space-y-3">
          <EthAmountInput
            value={offerAmount}
            onChange={onOfferAmountChange}
            placeholder="Amount in ETH (e.g. 0.08)"
            aria-label="Offer amount in ETH"
            error={offerErrors.amount}
          />
          <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest">
            ETH will be held in escrow for 7 days.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onMakeOffer}
              disabled={isMakingOffer || isOfferConfirming}
              className={`flex-1 font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                isMakingOffer || isOfferConfirming
                  ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                  : "bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20"
              }`}
            >
              {isMakingOffer || isOfferConfirming ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <HandCoins size={16} />
              )}
              {isMakingOffer
                ? "Awaiting wallet..."
                : isOfferConfirming
                  ? "Confirming..."
                  : "Send Offer"}
            </button>
            <IconButton
              onClick={onHideOfferForm}
              aria-label="Close"
              variant="outlined"
            >
              <X size={16} />
            </IconButton>
          </div>
        </div>
      ) : (
        <button
          onClick={onShowOfferForm}
          className="w-full font-headline font-bold py-4 flex items-center justify-center gap-2 rounded-sm bg-secondary/5 border border-secondary/20 text-secondary hover:bg-secondary/10 transition-all text-sm uppercase tracking-widest"
        >
          <HandCoins size={18} /> Make an Offer
        </button>
      )}
    </div>
  );
}
