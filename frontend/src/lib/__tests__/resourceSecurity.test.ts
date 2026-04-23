import { describe, expect, it } from "vitest";
import {
  getSafeAssetUri,
  getSafeImageUrl,
  getSafeIpfsMetadataUrl,
  getSafeMetadataUrl,
  sanitizeUntrustedText,
} from "@/lib/resourceSecurity";

describe("resourceSecurity", () => {
  it("normalizes ipfs images through the safe gateway list", () => {
    expect(getSafeImageUrl("ipfs://QmSafe")).toContain("ipfs.io/ipfs/QmSafe");
  });

  it("rejects hostile schemes for metadata and images", () => {
    expect(getSafeMetadataUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeImageUrl("file:///etc/passwd")).toBeNull();
    expect(getSafeImageUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("allows https images but rejects hostile schemes", () => {
    expect(getSafeImageUrl("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
  });

  it("sanitizes control characters from untrusted text", () => {
    expect(sanitizeUntrustedText("A\u0000lice\n")).toBe("Alice");
  });

  it("supports ipfs-only metadata gating for SSR boundaries", () => {
    expect(getSafeIpfsMetadataUrl("https://example.com/meta.json")).toBeNull();
    expect(getSafeIpfsMetadataUrl("ipfs://QmSafe")).toContain("ipfs.io/ipfs/QmSafe");
  });

  it("preserves raw asset URIs when callers need non-rendering storage semantics", () => {
    expect(getSafeAssetUri("ipfs://QmAsset")).toBe("ipfs://QmAsset");
  });
});
