/**
 * Centralised contract addresses and ABIs.
 *
 * Every hook/component that interacts with on-chain contracts SHOULD import
 * addresses and ABIs from here instead of reading process.env directly.
 * This gives a single source of truth, makes testing easier (mock one file),
 * and prevents typos from silently propagating.
 */
import type { Address } from "viem";
import { parseAddress } from "@/lib/schemas";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";

// ── Addresses ────────────────────────────────────────────────────────────────

function requireAddress(envVar: string | undefined, name: string): Address {
  const addr = parseAddress(envVar);
  if (!addr) throw new Error(`[contracts] Missing or invalid address env var: ${name}`);
  return addr;
}

export const MARKETPLACE_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
  "NEXT_PUBLIC_MARKETPLACE_ADDRESS",
);

export const FACTORY_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS,
  "NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS",
);

// ── Re-exports for convenience ───────────────────────────────────────────────

export { NFT_MARKETPLACE_ABI, NFT_COLLECTION_ABI, NFT_COLLECTION_FACTORY_ABI };
