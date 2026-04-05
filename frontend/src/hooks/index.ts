// ── Hooks barrel ─────────────────────────────────────────────────────────
// Re-exports the most commonly used hooks for convenient one-line imports:
//   import { useNFTListing, useBuyNFT, useCollectionDetail } from "@/hooks";

export {
  useNFTListing,
  useMyOffer,
  useNFTOffers,
  useListNFT,
  useBuyNFT,
  useCancelListing,
  useMakeOffer,
  useAcceptOffer,
  useCancelOffer,
  useReclaimExpiredOffer,
} from "./marketplace";
export type { TwoStepTxPhase } from "./marketplace";

export {
  useProfileNFTs,
  useCollectionNFTs,
  useCollectionDetails,
  useCollections,
  useCreatedNFTs,
  useCreateCollection,
  useMintToCollection,
} from "./collections";

export { useContractMutation } from "./useContractMutation";
export { useClickOutside } from "./useClickOutside";
export { useActivityFeed } from "./useActivityFeed";
export { useExploreNFTs } from "./useExploreNfts";
export { useFavorite, useUserFavorites } from "./useFavorites";
export { useMarketplaceStats } from "./useMarketplaceStats";
export { usePaginationState } from "./usePaginationState";
export { useStableArray } from "./useStableArray";
export { useTrendingCollections } from "./useTrendingCollections";
export { useWrongNetwork, APP_CHAIN } from "./useWrongNetwork";
