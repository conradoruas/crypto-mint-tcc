import { describe, expect, it } from "vitest";
import {
  MAX_BULK_METADATA_BYTES,
  validateImageFile,
  validateJsonFile,
} from "@/lib/uploadPolicy";

describe("uploadPolicy", () => {
  it("rejects unsupported image MIME types before preview", () => {
    const file = new File(["svg"], "evil.svg", { type: "image/svg+xml" });
    expect(validateImageFile(file)).toMatch(/Unsupported image type/);
  });

  it("rejects oversized image files before preview", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.png", {
      type: "image/png",
    });
    expect(validateImageFile(file)).toMatch(/too large/);
  });

  it("rejects oversized bulk metadata before parsing", () => {
    const file = new File([new Uint8Array(MAX_BULK_METADATA_BYTES + 1)], "bulk.json", {
      type: "application/json",
    });
    expect(validateJsonFile(file, MAX_BULK_METADATA_BYTES)).toMatch(/too large/);
  });
});
