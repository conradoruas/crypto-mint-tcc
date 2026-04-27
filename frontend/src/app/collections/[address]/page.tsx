"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import {
  Loader2,
  Plus,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import Footer from "@/components/Footer";
import { CollectionNFTCard } from "@/components/marketplace/CollectionNFTCard";
import { shortAddr } from "@/lib/utils";
import {
  buildEtherscanAddressUrl,
  buildEtherscanTxUrl,
} from "@/lib/externalLinks";
import { MintModal } from "./MintModal";
import { CollectionOwnerPanels } from "./CollectionOwnerPanels";
import { useCollectionPageCoordinator } from "./useCollectionPageCoordinator";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { address: collectionAddr } = useParams();
  const collectionAddress =
    (Array.isArray(collectionAddr) ? collectionAddr[0] : collectionAddr) ?? "";
  const {
    isConnected,
    showMintModal,
    setShowMintModal,
    mintSuccess,
    setMintSuccess,
    details,
    nftState: {
      nfts,
      isLoading: isLoadingNFTs,
      isLoadingMore,
      totalSupply,
      hasMore,
      loadMore,
    },
    urisLoaded,
    mintSeedCommitted,
    ownerActions,
    isOwner,
    supplyPercent,
    isSoldOut,
    bannerImage,
    handleLoadSuccess,
  } = useCollectionPageCoordinator(collectionAddress);
  const contractUrl = buildEtherscanAddressUrl(collectionAddress);
  const mintTxUrl = buildEtherscanTxUrl(mintSuccess);
  const withdrawTxUrl = buildEtherscanTxUrl(ownerActions.withdrawHash);

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Navbar />

      {/* Banner */}
      <div className="relative">
        <div className="h-48 md:h-64 relative overflow-hidden bg-surface-container-low">
          {bannerImage && (
            <Image
              src={bannerImage}
              alt={details.name ?? "Collection Banner"}
              fill
              className="object-cover opacity-20 blur-sm scale-110"
              sizes="100vw"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          {!bannerImage && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6 -mt-12 relative z-10">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 relative border-4 border-background bg-surface-container-high overflow-hidden">
              {bannerImage ? (
                <Image
                  src={bannerImage}
                  alt={details.name ?? "Collection Avatar"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 192px, 256px"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-on-surface-variant/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2 md:pt-14">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="font-headline text-3xl font-bold text-on-surface">
                      {details.name ?? "—"}
                    </h1>
                    <span className="text-[10px] font-headline uppercase tracking-widest px-2 py-0.5 bg-surface-container border border-outline-variant/20 text-on-surface-variant">
                      {details.symbol}
                    </span>
                  </div>
                  {details.description && (
                    <p className="text-sm text-on-surface-variant max-w-xl">
                      {details.description}
                    </p>
                  )}
                  {isOwner && !urisLoaded && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 w-fit bg-secondary/5 border border-secondary/20">
                      <AlertTriangle size={12} className="text-secondary" />
                      <span className="text-xs text-secondary">
                        NFTs ainda não carregados na blockchain
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 shrink-0">
                  {isConnected &&
                    !isSoldOut &&
                    urisLoaded &&
                    mintSeedCommitted && (
                      <button
                        onClick={() => setShowMintModal(true)}
                        className="flex items-center gap-2 font-bold px-6 py-3 bg-primary text-on-primary hover:bg-primary-dim transition-colors whitespace-nowrap neon-glow-primary"
                      >
                        <Plus size={16} /> Mintar NFT &mdash;{" "}
                        {details.mintPriceEth} ETH
                      </button>
                    )}
                  {isSoldOut && (
                    <div className="px-6 py-3 text-sm font-bold bg-surface-container border border-outline-variant/20 text-on-surface-variant/40">
                      Supply Sold Out
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 mb-8">
            {[
              { label: "Minted", value: totalSupply },
              {
                label: "Max Supply",
                value: details.maxSupply?.toString() ?? "—",
              },
              {
                label: "Mint Price",
                value: details.mintPriceEth
                  ? `${details.mintPriceEth} ETH`
                  : "—",
              },
              {
                label: "Owner",
                value: details.owner ? shortAddr(details.owner) : "—",
                showOwner: !!isOwner,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 bg-surface-container-low border border-outline-variant/20"
              >
                <p className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant mb-1">
                  {s.label}
                </p>
                <div className="flex items-center gap-1.5">
                  {s.showOwner && (
                    <ShieldCheck size={12} className="text-primary" />
                  )}
                  <p className="font-headline text-xl font-bold text-on-surface">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Supply progress */}
          {details.maxSupply && details.maxSupply > 0 && (
            <div className="mb-10">
              <div className="flex justify-between text-[10px] text-on-surface-variant mb-2">
                <span>{totalSupply} minted</span>
                <span>{supplyPercent}% of supply</span>
              </div>
              <div className="h-1 bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                  style={{ width: `${supplyPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <CollectionOwnerPanels
        isOwner={!!isOwner}
        urisLoaded={urisLoaded}
        mintSeedCommitted={mintSeedCommitted}
        maxSupply={details.maxSupply}
        collectionAddress={collectionAddress as `0x${string}`}
        contractBalanceEth={ownerActions.contractBalanceEth}
        onWithdraw={ownerActions.handleWithdraw}
        isWithdrawPending={ownerActions.isWithdrawPending}
        isWithdrawConfirming={ownerActions.isWithdrawConfirming}
        onLoadSuccess={handleLoadSuccess}
        commitSeedError={ownerActions.commitSeedError}
        onCommitMintSeed={ownerActions.handleCommitMintSeed}
        isCommitSeedPending={ownerActions.isCommitSeedPending}
        isCommitSeedConfirming={ownerActions.isCommitSeedConfirming}
      />

      {/* NFT Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline font-bold flex items-center gap-2 text-on-surface">
            NFTs da Coleção
            {totalSupply > 0 && (
              <span className="text-sm font-normal text-on-surface-variant">
                ({totalSupply})
              </span>
            )}
          </h2>
          {contractUrl && (
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              Ver contrato <ExternalLink size={11} />
            </a>
          )}
        </div>

        {isLoadingNFTs ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border border-outline-variant/20 bg-surface-container-low overflow-hidden"
              >
                <div className="aspect-square bg-surface-container-high animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-surface-container-high animate-pulse w-1/3" />
                  <div className="h-4 bg-surface-container-high animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-outline-variant/20">
            <Layers
              size={40}
              className="mx-auto mb-3 text-on-surface-variant/20"
            />
            <p className="text-sm text-on-surface-variant mb-4">
              Nenhum NFT mintado ainda nesta coleção.
            </p>
            {isConnected && !isSoldOut && urisLoaded && (
              <button
                onClick={() => setShowMintModal(true)}
                className="inline-flex items-center gap-2 font-bold px-5 py-2.5 text-sm bg-primary text-on-primary hover:bg-primary-dim transition-colors neon-glow-primary"
              >
                <Plus size={14} /> Ser o primeiro a mintar
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
              {nfts.map((nft) => (
                <CollectionNFTCard
                  key={nft.tokenId}
                  nft={nft}
                  collectionName={details.name ?? ""}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8 pt-6 border-t border-outline-variant/10">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Success toast — mint */}
      {mintSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 p-4 z-40 shadow-xl bg-surface-container border border-primary/30">
          <CheckCircle2 size={18} className="text-primary shrink-0" />
          <div>
            <p className="font-headline font-bold text-sm text-on-surface">
              NFT Mintado!
            </p>
            {mintTxUrl && (
              <a
                href={mintTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
                Ver no Etherscan
              </a>
            )}
          </div>
          <button
            onClick={() => setMintSuccess(null)}
            className="ml-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success toast — withdraw */}
      {ownerActions.withdrawSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 p-4 z-40 shadow-xl bg-surface-container border border-secondary/30">
          <CheckCircle2 size={18} className="text-secondary shrink-0" />
          <div>
            <p className="font-headline font-bold text-sm text-on-surface">
              Royalties retirados!
            </p>
            {withdrawTxUrl && (
              <a
                href={withdrawTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-secondary underline"
              >
                Ver no Etherscan
              </a>
            )}
          </div>
          <button
            onClick={() => ownerActions.setWithdrawSuccess(false)}
            className="ml-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error toast — withdraw */}
      {ownerActions.withdrawError && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 p-4 z-40 shadow-xl bg-surface-container border border-error/30">
          <AlertTriangle size={18} className="text-error shrink-0" />
          <p className="text-sm text-error">{ownerActions.withdrawError}</p>
          <button
            onClick={() => ownerActions.setWithdrawError(null)}
            className="ml-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showMintModal && details.mintPriceEth && (
        <MintModal
          collectionAddress={collectionAddress as `0x${string}`}
          mintPriceEth={details.mintPriceEth}
          urisLoaded={urisLoaded ?? false}
          onClose={() => setShowMintModal(false)}
          onSuccess={(hash) => {
            setShowMintModal(false);
            setMintSuccess(hash);
          }}
        />
      )}

      <Footer />
    </div>
  );
}
