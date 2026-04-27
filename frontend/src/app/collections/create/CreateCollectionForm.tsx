"use client";

import Image from "next/image";
import { Image as ImageIcon, Info, Layers, Loader2, Plus, Upload, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { CreateCollectionErrors } from "@/lib/schemas";
import type { NftAttribute, TraitSchema } from "@/types/traits";
import type { CollectionFormState, NFTDraft } from "./useCollectionForm";
import { IMAGE_ACCEPT_ATTR } from "@/lib/uploadPolicy";
import { TraitSchemaEditor } from "./TraitSchemaEditor";
import { TraitFieldsEditor } from "./TraitFieldsEditor";

const inputClass =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

const inputErrorClass =
  "w-full bg-surface-container-lowest border border-error/40 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-error transition-all placeholder:text-on-surface-variant/40";

const uploadButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-[11px] font-headline font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-error">{msg}</p>;
}

type Props = {
  form: CollectionFormState;
  pagedNFTs: NFTDraft[];
  totalPages: number;
  isLoading: boolean;
  isCreating: boolean;
  isConfirmingCreate: boolean;
  isUploadingCover: boolean;
  onSetCoverFile: (file: File | null) => void;
  onUpdateField: (
    field: "name" | "symbol" | "description" | "mintPrice",
    value: string,
  ) => void;
  onClearFieldError: (field: keyof CreateCollectionErrors) => void;
  onAddNFT: () => void;
  onRemoveNFT: (id: number) => void;
  onUpdateNFTField: (id: number, field: "name" | "description", value: string) => void;
  onSetNFTFile: (id: number, file: File | null) => void;
  onSetPage: (page: number) => void;
  onSetTraitSchema: (schema: TraitSchema | undefined) => void;
  onSetNFTAttributes: (id: number, attributes: NftAttribute[]) => void;
  onBulkMetadataFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBulkImageFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onParseBulkNFTs: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
};

export function CreateCollectionForm({
  form,
  pagedNFTs,
  totalPages,
  isLoading,
  isCreating,
  isConfirmingCreate,
  isUploadingCover,
  onSetCoverFile,
  onUpdateField,
  onClearFieldError,
  onAddNFT,
  onRemoveNFT,
  onUpdateNFTField,
  onSetNFTFile,
  onSetPage,
  onSetTraitSchema,
  onSetNFTAttributes,
  onBulkMetadataFileChange,
  onBulkImageFilesChange,
  onParseBulkNFTs,
  onSubmit,
}: Props) {
  const {
    coverFile,
    coverPreview,
    name,
    symbol,
    description,
    mintPrice,
    nfts,
    currentPage,
    isBulkProcessing,
    isUploadingNFTs,
    bulkMetadataName,
    bulkImageNames,
    error,
    bulkParsingError,
    fieldErrors,
    hasMounted,
  } = form;

  return (
    <div className="pt-32 pb-20 max-w-[1920px] mx-auto px-8">
      <header className="mb-16 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs font-headline font-bold tracking-[0.3em] text-secondary uppercase">
            Collection Factory · Sepolia
          </span>
        </div>
        <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tighter text-on-surface mb-4 leading-none uppercase">
          New <span className="text-primary italic">Collection</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-lg font-light leading-relaxed">
          Define your collection metadata and add all NFTs available for
          minting.
        </p>
      </header>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6">
          <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3">
            <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest">
              01
            </span>
            Collection Data
          </h2>

          <div>
            <label className="block text-[10px] font-headline font-bold mb-3 uppercase tracking-widest text-on-surface-variant">
              Cover Image *
            </label>
            <input
              type="file"
              id="cover-upload"
              className="hidden"
              accept={IMAGE_ACCEPT_ATTR}
              onChange={(e) => onSetCoverFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="cover-upload"
              className={`block p-8 text-center cursor-pointer transition-all border rounded-sm focus-within:ring-2 focus-within:ring-primary/30 ${
                coverFile
                  ? "border-primary/40 bg-primary/5"
                  : "border-dashed border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-lowest"
              }`}
            >
              {coverPreview ? (
                <div className="relative h-40">
                  <Image
                    src={coverPreview}
                    alt="Cover Preview"
                    fill
                    className="object-contain rounded-sm"
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload
                    className="mx-auto text-on-surface-variant/40"
                    size={24}
                  />
                  <span
                    className={`${uploadButtonClass} border-outline-variant/25 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary`}
                  >
                    Select Cover Image
                  </span>
                  <p className="text-[11px] text-on-surface-variant/60 uppercase tracking-widest">
                    PNG, JPG or WEBP
                  </p>
                </div>
              )}
              {coverFile && (
                <p className="text-xs mt-3 text-primary font-headline font-bold uppercase tracking-widest break-all">
                  ✓ {coverFile.name}
                </p>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="col-name"
                className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
              >
                Name *
              </label>
              <input
                id="col-name"
                type="text"
                value={name}
                onChange={(e) => {
                  onUpdateField("name", e.target.value);
                  onClearFieldError("name");
                }}
                className={fieldErrors.name ? inputErrorClass : inputClass}
                placeholder="e.g. Cyber Monkeys"
              />
              <FieldError msg={fieldErrors.name} />
            </div>
            <div>
              <label
                htmlFor="col-symbol"
                className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
              >
                Symbol *
              </label>
              <input
                id="col-symbol"
                type="text"
                value={symbol}
                onChange={(e) => {
                  onUpdateField("symbol", e.target.value.toUpperCase());
                  onClearFieldError("symbol");
                }}
                maxLength={8}
                className={`${fieldErrors.symbol ? inputErrorClass : inputClass} uppercase`}
                placeholder="e.g. CYBM"
              />
              <FieldError msg={fieldErrors.symbol} />
            </div>
          </div>

          <div>
            <label
              htmlFor="col-description"
              className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
            >
              Description
            </label>
            <textarea
              id="col-description"
              value={description}
              onChange={(e) => {
                onUpdateField("description", e.target.value);
                onClearFieldError("description");
              }}
              className={`${fieldErrors.description ? inputErrorClass : inputClass} h-24 resize-none`}
              placeholder="Describe your collection..."
            />
            <FieldError msg={fieldErrors.description} />
          </div>

          <div>
            <label
              htmlFor="col-mint-price"
              className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
            >
              Mint Price (ETH) *
            </label>
            <input
              id="col-mint-price"
              type="number"
              step="0.0001"
              min="0.0001"
              value={mintPrice}
              onChange={(e) => {
                onUpdateField("mintPrice", e.target.value);
                onClearFieldError("mintPrice");
              }}
              className={fieldErrors.mintPrice ? inputErrorClass : inputClass}
              placeholder="0.0001"
            />
            <FieldError msg={fieldErrors.mintPrice} />
          </div>

          <div className="glass-panel border-l-2 border-primary/40 border border-outline-variant/10 p-4 flex items-start gap-3">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Max supply is determined by the number of NFTs added below. Each
              user receives a <strong className="text-on-surface font-semibold">random NFT</strong> when minting.
            </p>
          </div>

          <TraitSchemaEditor
            schema={form.traitSchema}
            onChange={onSetTraitSchema}
          />
        </div>

        <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-lg font-bold uppercase tracking-tight flex items-center gap-3">
                <span className="text-[10px] font-headline font-black px-2 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary uppercase tracking-widest">
                  02
                </span>
                Collection NFTs
              </h2>
              <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest">
                {nfts.length === 0
                  ? "Add the NFTs available for minting."
                  : `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""} added`}
              </p>
            </div>
            <button
              onClick={onAddNFT}
              className="flex items-center gap-2 text-xs font-headline font-bold uppercase tracking-widest px-4 py-2 border border-outline-variant/20 text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all rounded-sm"
            >
              <Plus size={12} /> Add NFT
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {hasMounted ? (
              <>
                <label className="block text-xs text-on-surface-variant">
                  Bulk metadata file (.json array)
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="application/json"
                      onChange={onBulkMetadataFileChange}
                      className="w-full rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none cursor-pointer"
                      disabled={isBulkProcessing || isUploadingNFTs || isLoading}
                    />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {bulkMetadataName
                        ? `Selecionado: ${bulkMetadataName}`
                        : "Nenhum arquivo JSON selecionado"}
                    </p>
                  </div>
                </label>

                <label className="block text-xs text-on-surface-variant">
                  Bulk images (.png, .jpg, etc.)
                  <div className="mt-2">
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT_ATTR}
                      onChange={onBulkImageFilesChange}
                      multiple
                      className="w-full rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none cursor-pointer"
                      disabled={isBulkProcessing || isUploadingNFTs || isLoading}
                    />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {bulkImageNames.length > 0
                        ? `Selecionadas: ${bulkImageNames.join(", ")}`
                        : "Nenhuma imagem selecionada"}
                    </p>
                  </div>
                </label>
              </>
            ) : (
              <>
                <div className="h-28 rounded-sm border border-outline-variant/20 bg-surface-container" />
                <div className="h-28 rounded-sm border border-outline-variant/20 bg-surface-container" />
              </>
            )}
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <button
              onClick={onParseBulkNFTs}
              disabled={isBulkProcessing || isUploadingNFTs || isLoading}
              className="py-2 px-3 font-semibold text-xs rounded-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
            >
              {isBulkProcessing ? "Parsing bulk metadata..." : "Load bulk NFTs"}
            </button>
            {bulkParsingError && (
              <p className="text-xs text-error">{bulkParsingError}</p>
            )}
          </div>
        </div>

        {nfts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-outline-variant/20 rounded-sm">
            <ImageIcon size={36} className="mx-auto mb-3 text-on-surface-variant/20" />
            <p className="text-sm text-on-surface-variant mb-4">No NFTs added yet</p>
            <button
              onClick={onAddNFT}
              className="inline-flex items-center gap-2 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider"
            >
              <Plus size={13} /> Add First NFT
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pagedNFTs.map((nft, index) => (
              <div
                key={nft.id}
                className="p-4 bg-surface-container border border-outline-variant/10 rounded-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 relative">
                    <input
                      type="file"
                      id={`nft-file-${nft.id}`}
                      className="hidden"
                      accept={IMAGE_ACCEPT_ATTR}
                      onChange={(e) => onSetNFTFile(nft.id, e.target.files?.[0] ?? null)}
                    />
                    <label
                      htmlFor={`nft-file-${nft.id}`}
                      className={`w-24 h-24 relative flex items-center justify-center cursor-pointer overflow-hidden rounded-sm transition-all border focus-within:ring-2 focus-within:ring-primary/30 ${
                        nft.file
                          ? "border-primary/40 bg-primary/5"
                          : "border-dashed border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-lowest"
                      }`}
                    >
                      {nft.previewUrl ? (
                        <Image
                          src={nft.previewUrl}
                          alt="NFT Preview"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      ) : (
                        <div className="text-center px-1">
                          <Upload size={14} className="mx-auto mb-1 text-on-surface-variant/40" />
                          <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-on-surface-variant/70">
                            Add Image
                          </span>
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-headline font-bold text-on-surface-variant shrink-0 uppercase tracking-widest">
                        #{String((currentPage - 1) * 10 + index + 1).padStart(3, "0")}
                      </span>
                      <input
                        type="text"
                        value={nft.name}
                        onChange={(e) => onUpdateNFTField(nft.id, "name", e.target.value)}
                        className={`${inputClass} flex-1`}
                        placeholder="NFT Name *"
                      />
                    </div>
                    <textarea
                      value={nft.description}
                      onChange={(e) => onUpdateNFTField(nft.id, "description", e.target.value)}
                      className={`${inputClass} h-16 resize-none`}
                      placeholder="Description (optional)"
                    />
                    {form.traitSchema && form.traitSchema.fields.length > 0 ? (
                      <TraitFieldsEditor
                        schema={form.traitSchema}
                        attributes={nft.attributes ?? []}
                        onChange={(attrs) => onSetNFTAttributes(nft.id, attrs)}
                      />
                    ) : (
                      <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mt-2">
                        Define a trait schema above to add per-NFT trait values
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveNFT(nft.id)}
                    className="shrink-0 p-1.5 text-on-surface-variant/30 hover:text-error transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between px-2 py-1 text-xs text-on-surface-variant bg-surface-container-high rounded-sm">
              <button
                onClick={() => onSetPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded-sm border border-outline-variant/20 hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => onSetPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded-sm border border-outline-variant/20 hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            <button
              onClick={onAddNFT}
              className="w-full py-3 text-xs flex items-center justify-center gap-2 transition-all border border-dashed border-outline-variant/10 text-on-surface-variant/40 hover:border-primary/30 hover:text-primary rounded-sm font-headline font-bold uppercase tracking-widest"
            >
              <Plus size={12} /> Add Another NFT
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm p-4 bg-error/5 border border-error/20 text-error rounded-sm">
          {error}
        </div>
      )}

      <div className="flex justify-center pt-2 pb-8">
        <button
          onClick={onSubmit}
          disabled={isLoading || nfts.length === 0}
          className={`relative overflow-hidden font-headline font-bold px-10 py-3.5 flex items-center gap-3 text-sm uppercase tracking-widest rounded-sm transition-all ${
            isLoading || nfts.length === 0
              ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
              : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
          }`}
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Layers size={18} />}
          {isUploadingCover
            ? "Uploading cover to IPFS..."
            : isCreating
              ? "Awaiting wallet..."
              : isConfirmingCreate
                ? "Deploying contract..."
                : `Create Collection with ${nfts.length} NFT${nfts.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
