import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("env.ts", () => {
  it("exports MARKETPLACE_ADDRESS from env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2");
    vi.stubEnv("ALCHEMY_API_KEY", "test-key");
    vi.stubEnv("PINATA_JWT", "test-jwt");
    const { MARKETPLACE_ADDRESS } = await import("@/lib/env");
    expect(MARKETPLACE_ADDRESS).toBe("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1");
  });

  it("exports SUBGRAPH_ENABLED=true when SUBGRAPH_URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("ALCHEMY_API_KEY", "key");
    vi.stubEnv("PINATA_JWT", "jwt");
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "http://localhost:8000/subgraph");
    const { SUBGRAPH_ENABLED, SUBGRAPH_URL } = await import("@/lib/env");
    expect(SUBGRAPH_ENABLED).toBe(true);
    expect(SUBGRAPH_URL).toBe("http://localhost:8000/subgraph");
  });

  it("exports SUBGRAPH_ENABLED=false when SUBGRAPH_URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("ALCHEMY_API_KEY", "key");
    vi.stubEnv("PINATA_JWT", "jwt");
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "");
    const { SUBGRAPH_ENABLED } = await import("@/lib/env");
    expect(SUBGRAPH_ENABLED).toBe(false);
  });

  it("throws when a required var is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "");
    await expect(import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_MARKETPLACE_ADDRESS",
    );
  });
});
