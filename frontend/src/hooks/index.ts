// ── Hooks barrel ─────────────────────────────────────────────────────────
// Re-exports the most commonly used hooks for convenient one-line imports:
//   import { useNFTListing, useBuyNFT, useCollectionDetails } from "@/hooks";

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
  useExploreNFTs,
  useExploreAllNFTs,
  useMarketplaceStats,
  useTrendingCollections,
} from "./marketplace";
export type { TwoStepTxPhase, MarketplaceStats, TrendingCollection } from "./marketplace";

export {
  useProfileNFTs,
  useCollectionNFTs,
  useCollectionDetails,
  useCollections,
  useCreatedNFTs,
  useCreateCollection,
  useMintToCollection,
} from "./collections";

export { useIsFavorited, useFavorite, useUserFavorites } from "./user";
export { useActivityFeed } from "./activity";
export type { ActivityType, ActivityEvent } from "./activity";

export { useContractMutation } from "./useContractMutation";
export { useClickOutside } from "./useClickOutside";
export { useBodyScrollLock } from "./useBodyScrollLock";
export { usePaginationState } from "./usePaginationState";
export { useStableArray } from "./useStableArray";
export { useWrongNetwork, APP_CHAIN } from "./useWrongNetwork";
