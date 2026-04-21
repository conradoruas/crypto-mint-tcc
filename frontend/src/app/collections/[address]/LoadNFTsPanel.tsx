"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { formatTransactionError } from "@/lib/txErrors";
import { createObjectUrl, revokeRemovedObjectUrls } from "@/lib/objectUrlRegistry";
import { usePublishCollectionUris } from "@/hooks/collections/usePublishCollectionUris";

interface NFTLoadDraft {
  name: string;
  description: string;
  file: File | null;
  previewUrl: string;
}

export function LoadNFTsPanel({
  collectionAddress,
  maxSupply,
  onSuccess,
}: {
  collectionAddress: `0x${string}`;
  maxSupply: number;
  onSuccess: () => void;
}) {
  const [nftDrafts, setNftDrafts] = useState<NFTLoadDraft[]>(
    Array(maxSupply)
      .fill(null)
      .map(() => ({
        name: "",
        description: "",
        file: null,
        previewUrl: "",
      })),
  );
  const [error, setError] = useState<string | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const publishing = usePublishCollectionUris();

  useEffect(() => {
    if (publishing.isSuccess) onSuccess();
  }, [onSuccess, publishing.isSuccess]);

  useEffect(() => {
    const nextUrls = nftDrafts.map((draft) => draft.previewUrl);
    revokeRemovedObjectUrls(previewUrlsRef.current, nextUrls);
    previewUrlsRef.current = nextUrls;
  }, [nftDrafts]);

  useEffect(
    () => () => {
      revokeRemovedObjectUrls(previewUrlsRef.current, []);
    },
    [],
  );

  const updateNFT = (
    index: number,
    field: keyof NFTLoadDraft,
    value: string | File,
  ) => {
    setNftDrafts((prev) =>
      prev.map((nft, i) => {
        if (i !== index) return nft;
        if (field === "file" && value instanceof File) {
          return {
            ...nft,
            file: value,
            previewUrl: createObjectUrl(value),
          };
        }
        return { ...nft, [field]: value };
      }),
    );
  };

  const handleLoad = async () => {
    const isInvalid = nftDrafts.some((nft) => !nft.name || !nft.file);
    if (isInvalid) {
      setError("Todos os NFTs precisam de um nome e uma imagem.");
      return;
    }

    setError(null);
    try {
      await publishing.publishUris({
        collectionAddress,
        drafts: nftDrafts,
        chunkLoadSize: maxSupply,
      });
    } catch (e) {
      setError(
        formatTransactionError(e, "Could not load NFTs on-chain. Try again."),
      );
    }
  };

  const busy =
    publishing.isUploading ||
    publishing.isWalletPending ||
    publishing.isConfirming;
  const inputClass =
    "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-2 rounded-sm text-xs focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

  return (
    <div className="max-w-7xl mx-auto px-4 mb-10">
      <div className="bg-surface-container-low border border-secondary/30 p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-8">
          <AlertTriangle size={20} className="text-secondary shrink-0 mt-1" />
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase tracking-tight">
              Configuracao Final da Colecao
            </h3>
            <p className="text-sm text-on-surface-variant">
              Preencha os detalhes dos {maxSupply} NFTs para habilitar o minting
              na blockchain.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {nftDrafts.map((nft, index) => (
            <div
              key={index}
              className="p-4 bg-surface-container border border-outline-variant/10 flex flex-col md:flex-row gap-4 items-start"
            >
              <div className="shrink-0">
                <input
                  type="file"
                  id={`nft-load-file-${index}`}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateNFT(index, "file", file);
                  }}
                  disabled={busy}
                />
                <label
                  htmlFor={`nft-load-file-${index}`}
                  className={`w-24 h-24 flex items-center justify-center cursor-pointer overflow-hidden border ${
                    nft.file
                      ? "border-primary/40"
                      : "border-dashed border-outline-variant/20 hover:border-secondary/40"
                  } transition-all`}
                >
                  {nft.previewUrl ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={nft.previewUrl}
                        alt="NFT Preview"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-2">
                      <Upload
                        size={16}
                        className="mx-auto mb-1 text-on-surface-variant/30"
                      />
                      <span className="text-[8px] uppercase font-bold text-on-surface-variant/50">
                        Imagem *
                      </span>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-headline font-bold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-1">
                    #{String(index + 1).padStart(3, "0")}
                  </span>
                  <input
                    type="text"
                    value={nft.name}
                    onChange={(e) => updateNFT(index, "name", e.target.value)}
                    className={inputClass}
                    placeholder="Nome do NFT *"
                    disabled={busy}
                  />
                </div>
                <textarea
                  value={nft.description}
                  onChange={(e) =>
                    updateNFT(index, "description", e.target.value)
                  }
                  className={`${inputClass} h-16 resize-none`}
                  placeholder="Descricao (opcional)"
                  disabled={busy}
                />
              </div>
            </div>
          ))}
        </div>

        {busy && (
          <div className="mb-6">
            <div className="flex justify-between text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest">
              <span>
                {publishing.isUploading
                  ? `IPFS: ${publishing.progress}%`
                  : publishing.isWalletPending
                    ? "Carteira..."
                    : "Blockchain..."}
              </span>
              <span>{publishing.progress}%</span>
            </div>
            <div className="h-1 bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${publishing.progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs p-4 mb-6 bg-error/5 border border-error/20 text-error flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button
          onClick={handleLoad}
          disabled={busy}
          className="w-full font-headline font-bold py-4 flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all bg-secondary text-on-secondary hover:brightness-110 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Upload size={18} />
          )}
          {busy ? "Processando..." : `Finalizar e Carregar ${maxSupply} NFTs`}
        </button>
      </div>
    </div>
  );
}
