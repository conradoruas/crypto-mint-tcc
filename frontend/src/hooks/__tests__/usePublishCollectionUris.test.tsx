import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublishCollectionUris } from "../collections/usePublishCollectionUris";

const mockSignMessageAsync = vi.fn();
const mockMutateAsync = vi.fn();
const mockEstimateGas = vi.fn();
const mockUploadImageFile = vi.fn();
const mockUploadNftMetadata = vi.fn();
const mockCreateUploadAuthHeaders = vi.fn();

let mockReceipt = { isLoading: false, isSuccess: false };

vi.mock("wagmi", () => ({
  useConnection: vi.fn(() => ({
    address: "0x1000000000000000000000000000000000000001",
  })),
  usePublicClient: vi.fn(() => ({ chain: { id: 11155111 } })),
  useSignMessage: vi.fn(() => ({ signMessageAsync: mockSignMessageAsync })),
  useWriteContract: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useWaitForTransactionReceipt: vi.fn(() => mockReceipt),
}));

vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: (...args: unknown[]) => mockEstimateGas(...args),
}));

vi.mock("@/lib/uploadClient", () => ({
  createUploadAuthHeaders: (...args: unknown[]) =>
    mockCreateUploadAuthHeaders(...args),
  uploadImageFile: (...args: unknown[]) => mockUploadImageFile(...args),
  uploadNftMetadata: (...args: unknown[]) => mockUploadNftMetadata(...args),
}));

describe("usePublishCollectionUris", () => {
  beforeEach(() => {
    mockReceipt = { isLoading: false, isSuccess: false };
    mockSignMessageAsync.mockReset();
    mockMutateAsync.mockReset();
    mockEstimateGas.mockReset();
    mockUploadImageFile.mockReset();
    mockUploadNftMetadata.mockReset();
    mockCreateUploadAuthHeaders.mockReset();

    mockCreateUploadAuthHeaders.mockReturnValue({ authorization: "sig" });
    mockEstimateGas.mockResolvedValue(123n);
    mockMutateAsync
      .mockResolvedValueOnce("0xaaa")
      .mockResolvedValueOnce("0xbbb");
    mockUploadImageFile
      .mockResolvedValueOnce("ipfs://image-1")
      .mockResolvedValueOnce("ipfs://image-2")
      .mockResolvedValueOnce("ipfs://image-3");
    mockUploadNftMetadata
      .mockResolvedValueOnce("ipfs://meta-1")
      .mockResolvedValueOnce("ipfs://meta-2")
      .mockResolvedValueOnce("ipfs://meta-3");
  });

  it("uploads metadata and writes URIs in load/append chunks", async () => {
    const { result } = renderHook(() => usePublishCollectionUris());

    const drafts = [
      {
        name: "NFT 1",
        description: "First",
        file: new File(["a"], "a.png", { type: "image/png" }),
      },
      {
        name: "NFT 2",
        description: "Second",
        file: new File(["b"], "b.png", { type: "image/png" }),
      },
      {
        name: "NFT 3",
        description: "Third",
        file: new File(["c"], "c.png", { type: "image/png" }),
      },
    ];

    let hash: `0x${string}` | undefined;
    await act(async () => {
      hash = await result.current.publishUris({
        collectionAddress: "0x2000000000000000000000000000000000000002",
        drafts,
        chunkLoadSize: 2,
        uploadConcurrency: 1,
      });
    });

    expect(hash).toBe("0xbbb");
    expect(mockUploadImageFile).toHaveBeenCalledTimes(3);
    expect(mockUploadNftMetadata).toHaveBeenCalledTimes(3);
    expect(mockEstimateGas).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        functionName: "loadTokenURIs",
        args: [["ipfs://meta-1", "ipfs://meta-2"]],
      }),
    );
    expect(mockEstimateGas).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        functionName: "appendTokenURIs",
        args: [["ipfs://meta-3"]],
      }),
    );
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: "loadTokenURIs",
        args: [["ipfs://meta-1", "ipfs://meta-2"]],
      }),
    );
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: "appendTokenURIs",
        args: [["ipfs://meta-3"]],
      }),
    );
    expect(result.current.progress).toBe(100);
    expect(result.current.txHash).toBe("0xbbb");
  });

  it("exposes receipt success state from the final write", async () => {
    const { result, rerender } = renderHook(() => usePublishCollectionUris());

    await act(async () => {
      await result.current.publishUris({
        collectionAddress: "0x2000000000000000000000000000000000000002",
        drafts: [
          {
            name: "NFT 1",
            description: "First",
            file: new File(["a"], "a.png", { type: "image/png" }),
          },
        ],
      });
    });

    mockReceipt = { isLoading: false, isSuccess: true };
    rerender();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
