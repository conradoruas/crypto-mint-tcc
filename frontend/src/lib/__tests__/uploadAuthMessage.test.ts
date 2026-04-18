import { describe, it, expect } from "vitest";
import {
  buildUploadAuthMessage,
  UPLOAD_API_PATHS,
} from "@/lib/uploadAuthMessage";

describe("UPLOAD_API_PATHS", () => {
  it("defines image, profile, and combined paths", () => {
    expect(UPLOAD_API_PATHS.image).toBe("/api/upload-image");
    expect(UPLOAD_API_PATHS.profile).toBe("/api/upload-profile");
    expect(UPLOAD_API_PATHS.combined).toBe("/api/upload");
  });
});

describe("buildUploadAuthMessage", () => {
  it("includes the pathname and timestamp", () => {
    const msg = buildUploadAuthMessage("/api/upload", 1700000000);
    expect(msg).toContain("/api/upload");
    expect(msg).toContain("1700000000");
  });

  it("produces consistent output for same inputs", () => {
    const a = buildUploadAuthMessage("/api/upload-image", 12345);
    const b = buildUploadAuthMessage("/api/upload-image", 12345);
    expect(a).toBe(b);
  });

  it("differs when pathname changes", () => {
    const a = buildUploadAuthMessage("/api/upload", 1);
    const b = buildUploadAuthMessage("/api/upload-image", 1);
    expect(a).not.toBe(b);
  });

  it("differs when timestamp changes", () => {
    const a = buildUploadAuthMessage("/api/upload", 1000);
    const b = buildUploadAuthMessage("/api/upload", 1001);
    expect(a).not.toBe(b);
  });

  it("starts with a recognisable CryptoMint prefix", () => {
    const msg = buildUploadAuthMessage("/api/upload", 1);
    expect(msg).toContain("CryptoMint");
  });
});
