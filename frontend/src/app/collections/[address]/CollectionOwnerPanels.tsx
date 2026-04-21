"use client";

import { AlertTriangle, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { LoadNFTsPanel } from "./LoadNFTsPanel";

type Props = {
  isOwner: boolean;
  urisLoaded: boolean;
  mintSeedCommitted: boolean;
  maxSupply?: bigint;
  collectionAddress: `0x${string}`;
  contractBalanceEth: string | null;
  onWithdraw: () => void;
  isWithdrawPending: boolean;
  isWithdrawConfirming: boolean;
  onLoadSuccess: () => void;
  commitSeedError: string | null;
  onCommitMintSeed: () => void;
  isCommitSeedPending: boolean;
  isCommitSeedConfirming: boolean;
};

export function CollectionOwnerPanels({
  isOwner,
  urisLoaded,
  mintSeedCommitted,
  maxSupply,
  collectionAddress,
  contractBalanceEth,
  onWithdraw,
  isWithdrawPending,
  isWithdrawConfirming,
  onLoadSuccess,
  commitSeedError,
  onCommitMintSeed,
  isCommitSeedPending,
  isCommitSeedConfirming,
}: Props) {
  if (!isOwner) {
    return null;
  }

  return (
    <>
      {contractBalanceEth && (
        <div className="max-w-7xl mx-auto px-4 mb-6">
          <button
            onClick={onWithdraw}
            disabled={isWithdrawPending || isWithdrawConfirming}
            className="flex items-center gap-2 font-bold px-6 py-3 bg-surface-container border border-secondary/30 text-secondary hover:border-secondary hover:bg-secondary/10 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {isWithdrawPending || isWithdrawConfirming ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Wallet size={16} />
            )}
            Withdraw {contractBalanceEth} ETH
          </button>
        </div>
      )}

      {!urisLoaded && maxSupply && maxSupply > 0n && (
        <LoadNFTsPanel
          collectionAddress={collectionAddress}
          maxSupply={Number(maxSupply)}
          onSuccess={onLoadSuccess}
        />
      )}

      {urisLoaded && !mintSeedCommitted && (
        <div className="max-w-7xl mx-auto px-4 mb-10">
          <div className="bg-surface-container-low border border-secondary/30 p-8 shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <AlertTriangle size={20} className="text-secondary shrink-0 mt-1" />
              <div>
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase tracking-tight">
                  Habilitar Minting
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Commite o mint seed para ativar o minting desta coleção. O
                  seed é gerado localmente, salvo no seu navegador e commitado
                  como hash on-chain.
                </p>
              </div>
            </div>
            {commitSeedError && (
              <p className="text-xs text-error mb-3">{commitSeedError}</p>
            )}
            <button
              onClick={onCommitMintSeed}
              disabled={isCommitSeedPending || isCommitSeedConfirming}
              className="flex items-center gap-2 font-bold px-6 py-3 bg-primary text-on-primary hover:bg-primary-dim transition-colors disabled:opacity-50"
            >
              {isCommitSeedPending || isCommitSeedConfirming ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  {isCommitSeedPending ? "Aguardando..." : "Confirmando..."}
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Commitar mint seed
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
