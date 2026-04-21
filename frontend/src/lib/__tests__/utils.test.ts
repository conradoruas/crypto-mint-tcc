import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, shortAddr, formatTimeAgo, formatTimeShort } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles conditional falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("shortAddr", () => {
  it("truncates to 0x1234…abcd form", () => {
    expect(shortAddr("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234...5678",
    );
  });

  it("keeps exactly 6 chars at start and 4 at end", () => {
    const result = shortAddr("0xaabbccddeeff001122334455667788990011aabb");
    expect(result.slice(0, 6)).toBe("0xaabb");
    expect(result.slice(-4)).toBe("aabb");
    expect(result).toContain("...");
  });
});

describe("formatTimeAgo", () => {
  const now = 1700000000;

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns '—' for undefined", () => {
    expect(formatTimeAgo(undefined)).toBe("—");
  });

  it("formats seconds", () => {
    expect(formatTimeAgo(now - 30)).toBe("30s ago");
  });

  it("formats minutes", () => {
    expect(formatTimeAgo(now - 150)).toBe("2m ago");
  });

  it("formats hours", () => {
    expect(formatTimeAgo(now - 7200)).toBe("2h ago");
  });

  it("formats days", () => {
    expect(formatTimeAgo(now - 172800)).toBe("2d ago");
  });

  it("omits 'ago' when suffix:false", () => {
    expect(formatTimeAgo(now - 60, { suffix: false })).toBe("1m");
  });

  it("includes 'ago' by default", () => {
    expect(formatTimeAgo(now - 60)).toBe("1m ago");
  });
});

describe("formatTimeShort", () => {
  const now = 1700000000;

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns same as formatTimeAgo with suffix:false", () => {
    expect(formatTimeShort(now - 120)).toBe("2m");
  });

  it("returns '—' for undefined", () => {
    expect(formatTimeShort(undefined)).toBe("—");
  });
});
