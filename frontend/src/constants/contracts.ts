/**
 * Centralised contract addresses and ABIs.
 *
 * Every hook/component that interacts with on-chain contracts SHOULD import
 * addresses and ABIs from here instead of reading process.env directly.
 * This gives a single source of truth, makes testing easier (mock one file),
 * and prevents typos from silently propagating.
 */
import { parseAddress } from "@/lib/schemas";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";

// ── Addresses ────────────────────────────────────────────────────────────────
// Both vars are validated at startup by env.ts (throws if missing/invalid),
// so the non-null assertions here are safe at runtime.

export const MARKETPLACE_ADDRESS = parseAddress(
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
)!;

export const FACTORY_ADDRESS = parseAddress(
  process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS,
)!;

// ── Re-exports for convenience ───────────────────────────────────────────────

export { NFT_MARKETPLACE_ABI, NFT_COLLECTION_ABI, NFT_COLLECTION_FACTORY_ABI };
