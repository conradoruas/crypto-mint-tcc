import { describe, it, expect, vi, afterEach } from "vitest";
import {
  uploadFileToIPFS,
  uploadMetadataToIPFS,
} from "@/services/pinata";

const noopAuth = async () => ({
  "X-CryptoMint-Address": "0x123",
  "X-CryptoMint-Timestamp": "1700000000",
  "X-CryptoMint-Signature": "0xsig",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadFileToIPFS", () => {
  it("returns the ipfs URI from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://QmFile" }), { status: 200 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    const uri = await uploadFileToIPFS(file, noopAuth);
    expect(uri).toBe("ipfs://QmFile");
  });

  it("throws when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Error", { status: 500 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    await expect(uploadFileToIPFS(file, noopAuth)).rejects.toThrow("500");
  });

  it("posts to /api/upload with multipart form", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://Qm" }), { status: 200 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    await uploadFileToIPFS(file, noopAuth);
    const [url] = spy.mock.calls[0];
    expect(url).toContain("/api/upload");
  });
});

describe("uploadMetadataToIPFS", () => {
  it("returns the ipfs URI from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://QmMeta" }), { status: 200 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    const uri = await uploadMetadataToIPFS(file, "My NFT", "Cool desc", noopAuth);
    expect(uri).toBe("ipfs://QmMeta");
  });

  it("throws when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Error", { status: 413 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    await expect(
      uploadMetadataToIPFS(file, "NFT", "desc", noopAuth),
    ).rejects.toThrow("413");
  });

  it("includes name and description in the form data", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://Qm" }), { status: 200 }),
    );
    const file = new File(["data"], "image.png", { type: "image/png" });
    await uploadMetadataToIPFS(file, "NFT Name", "NFT Description", noopAuth);
    const body = spy.mock.calls[0][1]?.body as FormData;
    expect(body.get("name")).toBe("NFT Name");
    expect(body.get("description")).toBe("NFT Description");
  });
});
