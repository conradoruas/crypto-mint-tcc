import { bytesToHex, keccak256, type Hex } from "viem";

const STORAGE_PREFIX = "mintSeed:";

/// Generates a cryptographically random 32-byte seed, stores it in localStorage
/// keyed by the collection address, and returns both the seed and its keccak256
/// commitment.  The seed must be retained off-chain so the owner can later
/// publish it via `revealMintSeed`.
export function generateAndStoreMintSeed(collectionAddress: string): {
  seed: Hex;
  commitment: Hex;
} {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const seed = bytesToHex(bytes);
  const commitment = keccak256(seed);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${collectionAddress.toLowerCase()}`,
      seed,
    );
  }
  return { seed, commitment };
}

export function getStoredMintSeed(collectionAddress: string): Hex | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(
    `${STORAGE_PREFIX}${collectionAddress.toLowerCase()}`,
  );
  return (raw as Hex | null) ?? null;
}
