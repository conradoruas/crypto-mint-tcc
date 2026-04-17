/**
 * Centralised contract addresses and ABIs.
 *
 * Every hook/component that interacts with on-chain contracts SHOULD import
 * addresses and ABIs from here instead of reading process.env directly.
 * This gives a single source of truth, makes testing easier (mock one file),
 * and prevents typos from silently propagating.
 */
import { ensureAddressOrZero } from "@/lib/schemas";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";

// ── Addresses ────────────────────────────────────────────────────────────────

export const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export const FACTORY_ADDRESS = ensureAddressOrZero(
  process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS,
);

// ── Re-exports for convenience ───────────────────────────────────────────────

export { NFT_MARKETPLACE_ABI, NFT_COLLECTION_ABI, NFT_COLLECTION_FACTORY_ABI };
