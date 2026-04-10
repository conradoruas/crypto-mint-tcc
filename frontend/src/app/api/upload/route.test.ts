import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import * as uploadSecurity from "@/lib/uploadSecurity";
import { parseCombinedUploadFields } from "@/lib/uploadPayloadSchemas";

vi.mock("@/lib/env", () => ({ PINATA_JWT: "test-jwt" }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/apiUpstream", () => ({ peekErrorBody: vi.fn() }));

// Mock security rules
vi.mock("@/lib/uploadSecurity", () => ({
  MAX_UPLOAD_COMBINED_BYTES: 1000000,
  runUploadGate: vi.fn(),
  validateImageFile: vi.fn(),
}));

// Mock payload schema
vi.mock("@/lib/uploadPayloadSchemas", () => ({
  parseCombinedUploadFields: vi.fn(),
}));

// Mock global fetch for Pinata API
global.fetch = vi.fn();

function createMockRequest(formData: FormData): NextRequest {
  return {
    formData: vi.fn().mockResolvedValue(formData),
    nextUrl: { pathname: "/api/upload" },
  } as unknown as NextRequest;
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadSecurity.runUploadGate).mockResolvedValue(null);
    vi.mocked(uploadSecurity.validateImageFile).mockReturnValue(null);
    vi.mocked(parseCombinedUploadFields).mockReturnValue({ ok: true, name: "Test NFT", description: "Desc" } as any);
  });

  it("should return error if upload gate blocks request", async () => {
    const errorResponse = NextResponse.json({ error: "Rate limit" }, { status: 429 });
    vi.mocked(uploadSecurity.runUploadGate).mockResolvedValueOnce(errorResponse);

    const req = createMockRequest(new FormData());
    const res = await POST(req);

    expect(res).toBe(errorResponse);
  });

  it("should return error if no file provided", async () => {
    const formData = new FormData();
    const req = createMockRequest(formData);
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "File required." });
  });

  it("should return error if image validation fails", async () => {
    const formData = new FormData();
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));
    
    const valError = NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    vi.mocked(uploadSecurity.validateImageFile).mockReturnValueOnce(valError);

    const req = createMockRequest(formData);
    const res = await POST(req);

    expect(res).toBe(valError);
  });

  it("should successfully upload file and metadata to pinata", async () => {
    const formData = new FormData();
    formData.append("file", new File(["test image"], "test.png", { type: "image/png" }));
    formData.append("name", "My NFT");
    formData.append("description", "A cool NFT");

    const fetchMock = vi.mocked(global.fetch);
    // Pinata Image Success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ IpfsHash: "QmImageHash" }),
    } as any);
    // Pinata JSON Success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ IpfsHash: "QmMetadataHash" }),
    } as any);

    const req = createMockRequest(formData);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ uri: "ipfs://QmMetadataHash" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.pinata.cloud/pinning/pinJSONToIPFS");
  });

  it("should handle pinata image upload failure", async () => {
    const formData = new FormData();
    formData.append("file", new File(["test image"], "test.png", { type: "image/png" }));
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as any);

    const req = createMockRequest(formData);
    const res = await POST(req);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Upload failed." });
  });
});
