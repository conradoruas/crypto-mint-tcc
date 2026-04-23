import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveIpfsUrl,
  fetchIpfsJson,
  IPFS_GATEWAY_COUNT,
  getSafeImageUrl,
  getSafeMetadataUrl,
} from "@/lib/ipfs";

describe("resolveIpfsUrl", () => {
  it("converts ipfs:// URI to first gateway by default", () => {
    const url = resolveIpfsUrl("ipfs://QmTest123");
    expect(url).toMatch(/^https:\/\/.+\/ipfs\/QmTest123$/);
    expect(url).toContain("ipfs.io");
  });

  it("uses fallback gateway when gatewayIndex > 0", () => {
    const url0 = resolveIpfsUrl("ipfs://QmTest", 0);
    const url1 = resolveIpfsUrl("ipfs://QmTest", 1);
    expect(url0).not.toBe(url1);
  });

  it("wraps index beyond gateway count back to first gateway", () => {
    const url = resolveIpfsUrl("ipfs://QmTest", IPFS_GATEWAY_COUNT + 5);
    expect(url).toContain("ipfs.io");
  });

  it("passes through allowlisted https URLs unchanged", () => {
    const url = "https://nft-cdn.alchemy.com/image.png";
    expect(resolveIpfsUrl(url)).toBe(url);
  });

  it("returns empty string for disallowed https URLs", () => {
    expect(resolveIpfsUrl("https://example.com/image.png")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(resolveIpfsUrl("")).toBe("");
  });
});

describe("fetchIpfsJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses JSON from an https URL", async () => {
    const data = { name: "Test NFT" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(data), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await fetchIpfsJson("https://ipfs.io/ipfs/QmMeta");
    expect(result).toEqual(data);
  });

  it("resolves ipfs:// URI before fetching", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true })),
    );
    await fetchIpfsJson("ipfs://QmTest");
    const calledUrl = (vi.mocked(globalThis.fetch).mock.calls[0][0] as string);
    expect(calledUrl).toContain("ipfs.io/ipfs/QmTest");
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await fetchIpfsJson("https://ipfs.io/ipfs/QmMeta");
    expect(result).toBeNull();
  });

  it("returns null for empty uri", async () => {
    const result = await fetchIpfsJson("");
    expect(result).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-json"),
    );
    const result = await fetchIpfsJson("https://ipfs.io/ipfs/QmMeta");
    expect(result).toBeNull();
  });

  it("respects a caller-provided AbortSignal", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
      return Promise.resolve(new Response(JSON.stringify({})));
    });
    controller.abort();
    const result = await fetchIpfsJson("https://ipfs.io/ipfs/QmMeta", {
      signal: controller.signal,
    });
    expect(result).toBeNull();
  });

  it("supports safe https metadata URLs for client-side best-effort fetching", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await fetchIpfsJson("https://example.com/meta.json");
    expect(result).toEqual({ ok: true });
  });

  it("returns null for unexpected content types", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
    );
    const result = await fetchIpfsJson("ipfs://QmMeta");
    expect(result).toBeNull();
  });

  it("returns null when content-length exceeds the safety limit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          "content-length": "1000001",
        },
      }),
    );
    const result = await fetchIpfsJson("ipfs://QmMeta");
    expect(result).toBeNull();
  });
});

describe("URI safety helpers", () => {
  it("rejects hostile image schemes", () => {
    expect(getSafeImageUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeImageUrl("data:text/html;base64,abc")).toBeNull();
  });

  it("allows blob previews only when explicitly enabled", () => {
    expect(getSafeImageUrl("blob:https://app.local/id")).toBeNull();
    expect(
      getSafeImageUrl("blob:https://app.local/id", { allowObjectUrl: true }),
    ).toBe("blob:https://app.local/id");
  });

  it("rejects non-gateway metadata URLs", () => {
    expect(getSafeMetadataUrl("https://example.com/meta.json")).toBe(
      "https://example.com/meta.json",
    );
  });
});
