import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useIsFavorited, useFavorite, useUserFavorites } from "../user/useFavorites";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const USER_ADDR = "0xuser000000000000000000000000000000000001" as `0x${string}`;
const NFT_A = "0xnfta000000000000000000000000000000000001";
const NFT_B = "0xnftb000000000000000000000000000000000002";

const useConnection = vi.fn().mockReturnValue({ address: USER_ADDR });

vi.mock("wagmi", () => ({
  useConnection: () => useConnection(),
}));

const mockFetchBatchNFTMetadata = vi.fn().mockResolvedValue(new Map());

vi.mock("@/lib/nftMetadata", () => ({
  fetchBatchNFTMetadata: (...args: unknown[]) =>
    mockFetchBatchNFTMetadata(...args),
}));

function storageKey(addr: string) {
  return `nft_favorites_${addr.toLowerCase()}`;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useConnection.mockReturnValue({ address: USER_ADDR });
  mockFetchBatchNFTMetadata.mockResolvedValue(new Map());
});

// ── useIsFavorited ────────────────────────────────────────────────────────────

describe("useIsFavorited", () => {
  it("returns false when there are no favorites", () => {
    const { result } = renderHook(() => useIsFavorited(NFT_A, "1"));
    expect(result.current.isFavorited).toBe(false);
  });

  it("returns true when the NFT is already favorited", () => {
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A, tokenId: "1" }]),
    );

    const { result } = renderHook(() => useIsFavorited(NFT_A, "1"));
    expect(result.current.isFavorited).toBe(true);
  });

  it("is case-insensitive for contract addresses", () => {
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A.toUpperCase(), tokenId: "1" }]),
    );

    const { result } = renderHook(() => useIsFavorited(NFT_A.toLowerCase(), "1"));
    expect(result.current.isFavorited).toBe(true);
  });

  it("distinguishes token IDs", () => {
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A, tokenId: "1" }]),
    );

    const { result } = renderHook(() => useIsFavorited(NFT_A, "2"));
    expect(result.current.isFavorited).toBe(false);
  });
});

// ── useFavorite ───────────────────────────────────────────────────────────────

describe("useFavorite", () => {
  it("adds an NFT to favorites", () => {
    const { result } = renderHook(() => useFavorite());

    act(() => result.current.toggleFavorite(NFT_A, "1"));

    const stored = JSON.parse(localStorage.getItem(storageKey(USER_ADDR))!);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ nftContract: NFT_A, tokenId: "1" });
  });

  it("removes an NFT that is already favorited", () => {
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A, tokenId: "1" }]),
    );

    const { result } = renderHook(() => useFavorite());

    act(() => result.current.toggleFavorite(NFT_A, "1"));

    const stored = JSON.parse(localStorage.getItem(storageKey(USER_ADDR))!);
    expect(stored).toHaveLength(0);
  });

  it("preserves other favorites when toggling one", () => {
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([
        { nftContract: NFT_A, tokenId: "1" },
        { nftContract: NFT_B, tokenId: "2" },
      ]),
    );

    const { result } = renderHook(() => useFavorite());

    act(() => result.current.toggleFavorite(NFT_A, "1"));

    const stored = JSON.parse(localStorage.getItem(storageKey(USER_ADDR))!);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ nftContract: NFT_B, tokenId: "2" });
  });

  it("does nothing when no wallet is connected", () => {
    useConnection.mockReturnValue({ address: undefined });

    const { result } = renderHook(() => useFavorite());

    act(() => result.current.toggleFavorite(NFT_A, "1"));

    expect(localStorage.getItem(storageKey(USER_ADDR))).toBeNull();
  });
});

// ── useUserFavorites ──────────────────────────────────────────────────────────

describe("useUserFavorites", () => {
  it("returns empty list when user has no favorites", async () => {
    const { result } = renderHook(() => useUserFavorites(USER_ADDR));

    // Wait for load to complete — no localStorage entries so it resolves quickly
    await waitFor(() =>
      expect(result.current.favorites).toEqual([]),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty list when userAddress is undefined", async () => {
    const { result } = renderHook(() => useUserFavorites(undefined));

    await waitFor(() =>
      expect(result.current.favorites).toEqual([]),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches metadata for each stored favorite", async () => {
    mockFetchBatchNFTMetadata.mockResolvedValueOnce(
      new Map([
        [
          `${NFT_A.toLowerCase()}-1`,
          { name: "Cool NFT", image: "https://img.example.com/1.png" },
        ],
      ]),
    );

    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A, tokenId: "1" }]),
    );

    const { result } = renderHook(() => useUserFavorites(USER_ADDR));

    await waitFor(() =>
      expect(result.current.favorites).toHaveLength(1),
    );

    expect(result.current.favorites[0].name).toBe("Cool NFT");
    expect(result.current.isLoading).toBe(false);
  });

  it("uses fallback name when metadata is missing", async () => {
    mockFetchBatchNFTMetadata.mockResolvedValueOnce(new Map());

    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_A, tokenId: "42" }]),
    );

    const { result } = renderHook(() => useUserFavorites(USER_ADDR));

    await waitFor(() =>
      expect(result.current.favorites).toHaveLength(1),
    );

    expect(result.current.favorites[0].name).toBe("NFT #42");
  });

  it("re-syncs when localStorage changes via storage event", async () => {
    const { result } = renderHook(() => useUserFavorites(USER_ADDR));

    // Initially empty
    await waitFor(() =>
      expect(result.current.favorites).toEqual([]),
    );

    // Simulate another tab writing to localStorage
    mockFetchBatchNFTMetadata.mockResolvedValueOnce(
      new Map([[`${NFT_B.toLowerCase()}-5`, { name: "New NFT", image: "" }]]),
    );
    localStorage.setItem(
      storageKey(USER_ADDR),
      JSON.stringify([{ nftContract: NFT_B, tokenId: "5" }]),
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: storageKey(USER_ADDR) }),
      );
    });

    await waitFor(() =>
      expect(result.current.favorites).toHaveLength(1),
    );
    expect(result.current.favorites[0].name).toBe("New NFT");
  });
});
