import { describe, it, expect, vi } from "vitest";
import { buildUploadAuthHeaders } from "@/lib/uploadAuthClient";

describe("buildUploadAuthHeaders", () => {
  it("returns the three required headers", async () => {
    const signMock = vi.fn().mockResolvedValue("0xsignature");
    const headers = await buildUploadAuthHeaders(
      signMock,
      "0xabc0000000000000000000000000000000000001",
      "/api/upload",
    );

    expect(headers["X-CryptoMint-Address"]).toBe(
      "0xabc0000000000000000000000000000000000001",
    );
    expect(headers["X-CryptoMint-Timestamp"]).toMatch(/^\d+$/);
    expect(headers["X-CryptoMint-Signature"]).toBe("0xsignature");
  });

  it("calls signMessageAsync with the correct message", async () => {
    const signMock = vi.fn().mockResolvedValue("0xsig");
    await buildUploadAuthHeaders(
      signMock,
      "0xabc0000000000000000000000000000000000001",
      "/api/upload-image",
    );

    expect(signMock).toHaveBeenCalledOnce();
    const { message } = signMock.mock.calls[0][0];
    expect(message).toContain("/api/upload-image");
  });

  it("propagates wallet rejection errors", async () => {
    const signMock = vi.fn().mockRejectedValue(new Error("User rejected"));
    await expect(
      buildUploadAuthHeaders(
        signMock,
        "0xabc0000000000000000000000000000000000001",
        "/api/upload",
      ),
    ).rejects.toThrow("User rejected");
  });

  it("timestamp is close to current time (within 5 seconds)", async () => {
    const signMock = vi.fn().mockResolvedValue("0xsig");
    const before = Math.floor(Date.now() / 1000);
    const headers = await buildUploadAuthHeaders(
      signMock,
      "0xabc",
      "/api/upload",
    );
    const after = Math.floor(Date.now() / 1000);
    const ts = parseInt(headers["X-CryptoMint-Timestamp"], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 1);
  });
});
