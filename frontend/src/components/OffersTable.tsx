"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { Clock, TrendingUp, Loader2, CheckCircle } from "lucide-react";
import type { OfferWithBuyer } from "@/types/marketplace";

export function ExpiresIn({ expiresAt }: { expiresAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = Math.floor((expiresAt.getTime() - now) / 1000);

  if (secondsLeft <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-error">
        <Clock size={11} /> Expired
      </span>
    );
  }

  if (secondsLeft < 3600) {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-error animate-pulse">
        <Clock size={11} /> {m}m {String(s).padStart(2, "0")}s
      </span>
    );
  }

  if (secondsLeft < 86400) {
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-tertiary">
        <Clock size={11} /> {h}h {m}m
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-on-surface-variant">
      <Clock size={11} />
      {expiresAt.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      })}
    </span>
  );
}

export function OffersTable({
  offers,
  isLoading,
  isOwner,
  onAccept,
  isAccepting,
}: {
  offers: OfferWithBuyer[];
  isLoading: boolean;
  isOwner: boolean;
  onAccept: (buyer: `0x${string}`) => void;
  isAccepting: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const liveOffers = offers.filter((o) => Number(o.expiresAt) * 1000 > now);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-sm bg-surface-container-high"
          />
        ))}
      </div>
    );
  }
  if (liveOffers.length === 0) {
    return (
      <p className="text-sm text-center py-4 text-on-surface-variant/40 uppercase tracking-widest text-xs">
        No active offers at the moment.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {liveOffers.map((offer, i) => {
        const expiresDate = new Date(Number(offer.expiresAt) * 1000);
        const isExpired = expiresDate.getTime() <= now;
        return (
          <div
            key={offer.buyerAddress}
            className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
              i === 0
                ? "border-tertiary/30 bg-tertiary/5"
                : "border-outline-variant/10 bg-surface-container"
            }`}
          >
            <div className="flex items-center gap-3">
              {i === 0 && <TrendingUp size={13} className="text-tertiary" />}
              <div>
                <p className="font-headline font-bold text-sm text-on-surface">
                  {formatEther(offer.amount)} ETH
                  {i === 0 && (
                    <span className="ml-2 text-xs font-normal text-tertiary">
                      Top offer
                    </span>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant font-mono">
                  {offer.buyerAddress.slice(0, 6)}...
                  {offer.buyerAddress.slice(-4)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ExpiresIn expiresAt={expiresDate} />
              {isOwner && (
                <button
                  onClick={() => onAccept(offer.buyerAddress)}
                  disabled={isAccepting || isExpired}
                  className={`text-xs font-headline font-bold px-3 py-1.5 flex items-center gap-1 rounded-sm transition-all ${
                    isAccepting || isExpired
                      ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed"
                  }`}
                >
                  {isAccepting ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <CheckCircle size={11} />
                  )}
                  Accept
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
