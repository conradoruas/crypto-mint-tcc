import { describe, it, expect } from "vitest";
import { peekErrorBody, CLIENT_UPSTREAM_FAILED } from "@/lib/apiUpstream";

describe("CLIENT_UPSTREAM_FAILED", () => {
  it("is a non-empty string", () => {
    expect(typeof CLIENT_UPSTREAM_FAILED).toBe("string");
    expect(CLIENT_UPSTREAM_FAILED.length).toBeGreaterThan(0);
  });
});

describe("peekErrorBody", () => {
  it("returns the full body when under 800 chars", async () => {
    const body = "error body text";
    const res = new Response(body);
    expect(await peekErrorBody(res)).toBe(body);
  });

  it("truncates at 800 chars and appends ellipsis", async () => {
    const body = "x".repeat(900);
    const res = new Response(body);
    const result = await peekErrorBody(res);
    expect(result.length).toBeLessThan(900);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBe(801); // 800 + "…"
  });

  it("returns body exactly at limit without truncating", async () => {
    const body = "y".repeat(800);
    const res = new Response(body);
    const result = await peekErrorBody(res);
    expect(result).toBe(body);
    expect(result.endsWith("…")).toBe(false);
  });
});
