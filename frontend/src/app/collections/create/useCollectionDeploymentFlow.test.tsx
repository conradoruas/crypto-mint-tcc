import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionDeploymentFlow } from "./useCollectionDeploymentFlow";
import type { CollectionFormState } from "./useCollectionForm";

const mockUploadImageFile = vi.fn();
const mockUploadCollectionContractMetadata = vi.fn();
const mockCreateCollectionV1 = vi.fn();
const mockCreateCollectionV2 = vi.fn();

vi.mock("wagmi", () => ({
  useConnection: vi.fn(() => ({
    address: "0x1000000000000000000000000000000000000001",
    isConnected: true,
  })),
  useSignMessage: vi.fn(() => ({ signMessageAsync: vi.fn() })),
}));

vi.mock("@/lib/uploadClient", () => ({
  createUploadAuthHeaders: vi.fn(() => ({ authorization: "sig" })),
  uploadImageFile: (...args: unknown[]) => mockUploadImageFile(...args),
  uploadCollectionContractMetadata: (...args: unknown[]) =>
    mockUploadCollectionContractMetadata(...args),
}));

vi.mock("@/hooks/collections", () => ({
  useCreateCollection: vi.fn(() => ({
    createCollection: mockCreateCollectionV1,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    hash: undefined,
  })),
}));

vi.mock("@/hooks/collections/useCreateCollectionV2", () => ({
  useCreateCollectionV2: vi.fn(() => ({
    createCollection: mockCreateCollectionV2,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    hash: undefined,
  })),
}));

vi.mock("@/constants/contracts", () => ({
  FACTORY_V2_ADDRESS: "0x2000000000000000000000000000000000000002",
}));

function makeForm(overrides: Partial<CollectionFormState> = {}): CollectionFormState {
  return {
    coverFile: new File(["cover"], "cover.png", { type: "image/png" }),
    coverPreview: "",
    name: "Sky Mages",
    symbol: "MAGE",
    description: "desc",
    mintPrice: "0.01",
    traitSchema: undefined,
    nfts: [
      {
        id: 1,
        name: "Mage #1",
        description: "First",
        file: new File(["nft"], "nft.png", { type: "image/png" }),
        previewUrl: "",
      },
    ],
    currentPage: 1,
    isUploadingCover: false,
    isUploadingNFTs: false,
    isBulkProcessing: false,
    uploadProgress: 0,
    bulkMetadataFile: null,
    bulkImageFiles: [],
    bulkMetadataName: "",
    bulkImageNames: [],
    error: null,
    bulkParsingError: null,
    fieldErrors: {},
    hasMounted: true,
    ...overrides,
  };
}

describe("useCollectionDeploymentFlow", () => {
  beforeEach(() => {
    mockUploadImageFile.mockReset();
    mockUploadCollectionContractMetadata.mockReset();
    mockCreateCollectionV1.mockReset();
    mockCreateCollectionV2.mockReset();
    mockUploadImageFile.mockResolvedValue("ipfs://cover");
  });

  it("blocks deployment when NFT attributes violate the declared schema", async () => {
    const setError = vi.fn();
    const setFieldErrors = vi.fn();
    const form = makeForm({
      traitSchema: {
        version: 1,
        fields: [
          { key: "class", label: "Class", type: "enum", required: true, options: ["Mage"] },
        ],
      },
      nfts: [
        {
          id: 1,
          name: "Mage #1",
          description: "",
          file: new File(["nft"], "nft.png", { type: "image/png" }),
          previewUrl: "",
          attributes: [{ trait_type: "unknown", value: "bad" }],
        },
      ],
    });

    const { result } = renderHook(() =>
      useCollectionDeploymentFlow({ form, setError, setFieldErrors }),
    );

    await act(async () => {
      await result.current.createCollection();
    });

    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining('NFT "Mage #1" has invalid traits'),
    );
    expect(mockUploadImageFile).not.toHaveBeenCalled();
    expect(mockCreateCollectionV2).not.toHaveBeenCalled();
  });

  it("blocks deployment when trait schema upload fails", async () => {
    const setError = vi.fn();
    const setFieldErrors = vi.fn();
    const form = makeForm({
      traitSchema: {
        version: 1,
        fields: [
          { key: "class", label: "Class", type: "enum", required: true, options: ["Mage"] },
        ],
      },
      nfts: [
        {
          id: 1,
          name: "Mage #1",
          description: "",
          file: new File(["nft"], "nft.png", { type: "image/png" }),
          previewUrl: "",
          attributes: [{ trait_type: "class", value: "Mage" }],
        },
      ],
    });

    mockUploadCollectionContractMetadata.mockRejectedValue(new Error("pin failed"));

    const { result } = renderHook(() =>
      useCollectionDeploymentFlow({ form, setError, setFieldErrors }),
    );

    await act(async () => {
      await result.current.createCollection();
    });

    expect(mockUploadImageFile).toHaveBeenCalledOnce();
    expect(mockUploadCollectionContractMetadata).toHaveBeenCalledOnce();
    expect(mockCreateCollectionV2).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining("Could not upload collection trait schema metadata"),
    );
  });

  it("allows schema-less collections to deploy without a contractURI upload", async () => {
    const setError = vi.fn();
    const setFieldErrors = vi.fn();
    const form = makeForm();

    const { result } = renderHook(() =>
      useCollectionDeploymentFlow({ form, setError, setFieldErrors }),
    );

    await act(async () => {
      await result.current.createCollection();
    });

    expect(mockUploadImageFile).toHaveBeenCalledOnce();
    expect(mockUploadCollectionContractMetadata).not.toHaveBeenCalled();
    expect(mockCreateCollectionV2).toHaveBeenCalledWith(
      expect.objectContaining({
        contractURI: "",
      }),
    );
  });
});
