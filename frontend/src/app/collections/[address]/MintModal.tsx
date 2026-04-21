"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useMintToCollection } from "@/hooks/collections";
import { formatTransactionError } from "@/lib/txErrors";

export function MintModal({
  collectionAddress,
  mintPriceEth,
  urisLoaded,
  onClose,
  onSuccess,
}: {
  collectionAddress: `0x${string}`;
  mintPriceEth: string;
  urisLoaded: boolean;
  onClose: () => void;
  onSuccess: (hash: string) => void;
}) {
  const { address } = useConnection();
  const [error, setError] = useState<string | null>(null);
  const { mint, isPending, isConfirming, isSuccess, hash } =
    useMintToCollection();

  useEffect(() => {
    if (isSuccess && hash) onSuccess(hash);
  }, [isSuccess, hash, onSuccess]);

  const handleMint = async () => {
    setError(null);
    if (!address) {
      setError("Carteira nao conectada.");
      return;
    }
    if (!urisLoaded) {
      setError("Colecao ainda nao preparada pelo criador.");
      return;
    }
    try {
      await mint(collectionAddress, mintPriceEth, address);
    } catch (e) {
      setError(formatTransactionError(e, "Could not mint. Try again."));
    }
  };

  const busy = isPending || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-container border border-outline-variant/30 p-8 text-center">
        <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">
          Mintar NFT
        </h2>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
          Voce recebera um NFT{" "}
          <strong className="text-on-surface">aleatorio</strong> desta colecao.
        </p>

        <div className="bg-surface-container-high border border-outline-variant/20 p-5 mb-6">
          <p className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant mb-1">
            Preco de mint
          </p>
          <p className="font-headline text-3xl font-bold text-primary">
            {mintPriceEth} ETH
          </p>
        </div>

        {!urisLoaded && (
          <div className="flex items-start gap-2 p-3 mb-4 text-left bg-secondary/5 border border-secondary/20">
            <AlertTriangle
              size={13}
              className="text-secondary shrink-0 mt-0.5"
            />
            <p className="text-xs text-secondary">
              O criador ainda nao finalizou o carregamento dos NFTs.
            </p>
          </div>
        )}

        {error && (
          <div className="text-sm p-3 mb-4 bg-error/5 border border-error/30 text-error">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 font-bold py-3 border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleMint}
            disabled={busy || !urisLoaded}
            className="flex-1 font-bold py-3 flex items-center justify-center gap-2 transition-all bg-primary text-on-primary hover:bg-primary-dim disabled:bg-surface-container-high disabled:text-on-surface-variant/40 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                {isPending ? "Aguardando..." : "Confirmando..."}
              </>
            ) : (
              <>
                <Plus size={14} />
                Mintar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
