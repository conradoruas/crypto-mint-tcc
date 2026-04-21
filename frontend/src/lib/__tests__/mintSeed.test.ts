import { describe, it, expect, beforeEach } from "vitest";
import {
  generateAndStoreMintSeed,
  getStoredMintSeed,
} from "@/lib/mintSeed";

beforeEach(() => {
  localStorage.clear();
});

describe("generateAndStoreMintSeed", () => {
  it("returns a 32-byte hex seed (0x + 64 chars)", () => {
    const { seed } = generateAndStoreMintSeed("0xabc");
    expect(seed).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns a 32-byte hex commitment", () => {
    const { commitment } = generateAndStoreMintSeed("0xabc");
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("seed and commitment are different values", () => {
    const { seed, commitment } = generateAndStoreMintSeed("0xabc");
    expect(seed).not.toBe(commitment);
  });

  it("generates a different seed on each call", () => {
    const a = generateAndStoreMintSeed("0xabc");
    const b = generateAndStoreMintSeed("0xabc");
    expect(a.seed).not.toBe(b.seed);
  });

  it("stores the seed in localStorage keyed by lowercase address", () => {
    const { seed } = generateAndStoreMintSeed("0xABC");
    expect(localStorage.getItem("mintSeed:0xabc")).toBe(seed);
  });
});

describe("getStoredMintSeed", () => {
  it("retrieves the stored seed", () => {
    const { seed } = generateAndStoreMintSeed("0xDEF");
    expect(getStoredMintSeed("0xDEF")).toBe(seed);
  });

  it("is case-insensitive for address lookup", () => {
    const { seed } = generateAndStoreMintSeed("0xDEF");
    expect(getStoredMintSeed("0xdef")).toBe(seed);
  });

  it("returns null when no seed is stored", () => {
    expect(getStoredMintSeed("0x9999")).toBeNull();
  });
});
