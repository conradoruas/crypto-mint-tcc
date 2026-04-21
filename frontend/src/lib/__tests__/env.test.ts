import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("env.ts", () => {
  it("exports ALCHEMY_API_KEY from env var", async () => {
    vi.stubEnv("ALCHEMY_API_KEY", "test-key");
    vi.stubEnv("PINATA_JWT", "test-jwt");
    const { ALCHEMY_API_KEY } = await import("@/lib/env");
    expect(ALCHEMY_API_KEY).toBe("test-key");
  });

  it("throws when a required server var is missing", async () => {
    vi.stubEnv("ALCHEMY_API_KEY", "");
    await expect(import("@/lib/env")).rejects.toThrow("ALCHEMY_API_KEY");
  });
});

describe("publicEnv.ts", () => {
  it("exports SUBGRAPH_ENABLED=true when SUBGRAPH_URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "http://localhost:8000/subgraph");
    const { SUBGRAPH_ENABLED, SUBGRAPH_URL } = await import("@/lib/publicEnv");
    expect(SUBGRAPH_ENABLED).toBe(true);
    expect(SUBGRAPH_URL).toBe("http://localhost:8000/subgraph");
  });

  it("exports SUBGRAPH_ENABLED=false when SUBGRAPH_URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "");
    const { SUBGRAPH_ENABLED } = await import("@/lib/publicEnv");
    expect(SUBGRAPH_ENABLED).toBe(false);
  });

  it("returns undefined public addresses when env vars are absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS", "");
    const { MARKETPLACE_ADDRESS, FACTORY_ADDRESS } = await import(
      "@/lib/publicEnv"
    );
    expect(MARKETPLACE_ADDRESS).toBeUndefined();
    expect(FACTORY_ADDRESS).toBeUndefined();
  });
});
