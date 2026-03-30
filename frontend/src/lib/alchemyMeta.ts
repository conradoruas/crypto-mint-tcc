/**
 * Re-exports from the consolidated nftMetadata module.
 *
 * This file is kept for backward compatibility — existing imports
 * from `@/lib/alchemyMeta` continue to work without changes.
 */

export {
  fetchBatchNFTMetadata as fetchAlchemyMeta,
  fetchBatchNFTMetadataForEvents as fetchAlchemyMetaForEvents,
} from "@/lib/nftMetadata";

export type { NFTMeta, MetaMap } from "@/types/alchemy";
