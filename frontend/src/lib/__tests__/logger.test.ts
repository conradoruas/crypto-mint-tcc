import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test logger in both dev and prod modes
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    vi.unstubAllEnvs();
  } else {
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  }
  vi.restoreAllMocks();
});

describe("logger (development mode)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("calls console.error with human-readable format", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("Something broke", new Error("test"));
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain("[ERROR] Something broke");
  });

  it("calls console.warn with human-readable format", async () => {
    const { logger } = await import("@/lib/logger");
    logger.warn("Watch out", { key: "val" });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[WARN] Watch out");
  });

  it("passes error instance to console.error", async () => {
    const { logger } = await import("@/lib/logger");
    const err = new Error("detail");
    logger.error("msg", err);
    const args = errorSpy.mock.calls[0];
    expect(args).toContain(err);
  });
});

describe("logger (production mode)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("emits JSON to console.error in production", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("Prod error", new Error("oops"));
    const raw = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("Prod error");
    expect(parsed.error.message).toBe("oops");
  });

  it("includes stack in production JSON", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("err", new Error("stack test"));
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.error.stack).toContain("stack test");
  });

  it("emits JSON to console.warn in production", async () => {
    const { logger } = await import("@/lib/logger");
    logger.warn("Prod warn", { info: "x" });
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
    expect(parsed.context?.info).toBe("x");
  });

  it("serialises non-Error error values as string", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("raw", "plain string error");
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.error).toBe("plain string error");
  });
});
