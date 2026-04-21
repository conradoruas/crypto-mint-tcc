/**
 * Centralised contract addresses and ABIs.
 *
 * Every hook/component that interacts with on-chain contracts SHOULD import
 * addresses and ABIs from here instead of reading process.env directly.
 * This gives a single source of truth, makes testing easier (mock one file),
 * and prevents typos from silently propagating.
 */
import type { Address } from "viem";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";
import {
  FACTORY_ADDRESS as FACTORY_ADDRESS_ENV,
  MARKETPLACE_ADDRESS as MARKETPLACE_ADDRESS_ENV,
} from "@/lib/publicEnv";

export const MARKETPLACE_ADDRESS: Address | undefined = MARKETPLACE_ADDRESS_ENV;
export const FACTORY_ADDRESS: Address | undefined = FACTORY_ADDRESS_ENV;

// ── Re-exports for convenience ───────────────────────────────────────────────

export { NFT_MARKETPLACE_ABI, NFT_COLLECTION_ABI, NFT_COLLECTION_FACTORY_ABI };
