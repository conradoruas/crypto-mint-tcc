import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCacheKey,
  createSubgraphProxy,
  operationTtl,
  stableStringify,
  type GraphQLRequest,
} from "@/lib/subgraphProxy";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/subgraphErrors";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe("stableStringify", () => {
  it("produces identical output regardless of key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it("handles nested objects and arrays", () => {
    const out = stableStringify({ z: [1, { y: 2, x: 1 }], a: null });
    expect(out).toBe(`{"a":null,"z":[1,{"x":1,"y":2}]}`);
  });

  it("serializes primitives via JSON.stringify", () => {
    expect(stableStringify("hi")).toBe(`"hi"`);
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify(null)).toBe("null");
  });
});

describe("buildCacheKey", () => {
  it("normalizes whitespace in the query", () => {
    const a = buildCacheKey({ query: "query   X  {\n  foo\n}" });
    const b = buildCacheKey({ query: "query X { foo }" });
    expect(a).toBe(b);
  });

  it("ignores variable key order", () => {
    const a = buildCacheKey({
      query: "q",
      operationName: "Op",
      variables: { a: 1, b: 2 },
    });
    const b = buildCacheKey({
      query: "q",
      operationName: "Op",
      variables: { b: 2, a: 1 },
    });
    expect(a).toBe(b);
  });

  it("differs when variables differ", () => {
    const a = buildCacheKey({ query: "q", variables: { a: 1 } });
    const b = buildCacheKey({ query: "q", variables: { a: 2 } });
    expect(a).not.toBe(b);
  });

  it("differs when operationName differs", () => {
    const a = buildCacheKey({ query: "q", operationName: "A" });
    const b = buildCacheKey({ query: "q", operationName: "B" });
    expect(a).not.toBe(b);
  });
});

describe("operationTtl", () => {
  it("returns the configured TTL for a known operation", () => {
    expect(operationTtl("GET_MARKETPLACE_STATS")).toBe(5 * 60_000);
  });

  it("returns the default TTL for an unknown operation", () => {
    expect(operationTtl("WHO_KNOWS")).toBe(60_000);
  });

  it("returns the default TTL when operationName is undefined", () => {
    expect(operationTtl(undefined)).toBe(60_000);
  });
});

// ─── Proxy behavior ───────────────────────────────────────────────────────────

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeFakeFetcher(
  responder: (call: FetchCall) => Promise<Response> | Response,
) {
  const calls: FetchCall[] = [];
  const fn: typeof fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const call: FetchCall = { url, init: init ?? {} };
    calls.push(call);
    return await responder(call);
  });
  return Object.assign(fn, { calls });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const REQ: GraphQLRequest = {
  query: "query Hello { hello }",
  operationName: "Hello",
  variables: { x: 1 },
};

describe("subgraphProxy — cache behavior", () => {
  let nowMs = 1_000_000;
  beforeEach(() => {
    nowMs = 1_000_000;
  });

  it("returns fresh on first call and hits upstream once", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({ data: { hello: "world" } }));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("fresh");
    expect(v.subgraphState).toBe("ok");
    expect(v.body).toEqual({ data: { hello: "world" } });
    expect(fetcher.calls).toHaveLength(1);
  });

  it("serves cached responses on subsequent calls within TTL", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({ data: { hello: "world" } }));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    await proxy.getCachedOrFetch(REQ);
    nowMs += 30_000; // < default 60s TTL
    const second = await proxy.getCachedOrFetch(REQ);

    expect(second.kind).toBe("fresh");
    expect(fetcher.calls).toHaveLength(1);
  });

  it("re-fetches upstream after TTL expires", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({ data: { hello: "world" } }));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    await proxy.getCachedOrFetch(REQ);
    nowMs += 61_000; // past 60s default TTL
    await proxy.getCachedOrFetch(REQ);

    expect(fetcher.calls).toHaveLength(2);
  });

  it("does not cache responses that contain GraphQL errors", async () => {
    const fetcher = makeFakeFetcher(() =>
      jsonResponse({ errors: [{ message: "oops" }] }),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    const first = await proxy.getCachedOrFetch(REQ);
    const second = await proxy.getCachedOrFetch(REQ);
    expect(first.kind).toBe("fresh");
    expect(second.kind).toBe("fresh");
    expect(fetcher.calls).toHaveLength(2);
  });

  it("evicts the oldest entry when the cache cap is exceeded", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({ data: {} }));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
      cacheCapacity: 2,
    });

    await proxy.getCachedOrFetch({ query: "q1", operationName: "A" });
    await proxy.getCachedOrFetch({ query: "q2", operationName: "B" });
    await proxy.getCachedOrFetch({ query: "q3", operationName: "C" }); // evicts A

    expect(proxy.__stats().cacheSize).toBe(2);

    // Fetching A again should miss cache and call upstream.
    fetcher.calls.length = 0;
    await proxy.getCachedOrFetch({ query: "q1", operationName: "A" });
    expect(fetcher.calls).toHaveLength(1);
  });

  it("LRU bumps a cache entry on read so it is not the next to evict", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({ data: {} }));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
      cacheCapacity: 2,
    });

    await proxy.getCachedOrFetch({ query: "q1", operationName: "A" });
    await proxy.getCachedOrFetch({ query: "q2", operationName: "B" });
    // Read A → it becomes the newest, B is now the oldest.
    await proxy.getCachedOrFetch({ query: "q1", operationName: "A" });
    // Insert C → evicts B.
    await proxy.getCachedOrFetch({ query: "q3", operationName: "C" });

    fetcher.calls.length = 0;
    // A still cached.
    await proxy.getCachedOrFetch({ query: "q1", operationName: "A" });
    expect(fetcher.calls).toHaveLength(0);
    // B evicted.
    await proxy.getCachedOrFetch({ query: "q2", operationName: "B" });
    expect(fetcher.calls).toHaveLength(1);
  });
});

describe("subgraphProxy — circuit breaker on 429", () => {
  let nowMs = 1_000_000;
  beforeEach(() => {
    nowMs = 1_000_000;
  });

  it("opens the breaker on 429 and serves stale cache on next call", async () => {
    let mode: "ok" | "limit" = "ok";
    const fetcher = makeFakeFetcher(() =>
      mode === "ok"
        ? jsonResponse({ data: { v: 1 } })
        : jsonResponse({ errors: [{ message: "rate limited" }] }, 429),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    // Prime the cache.
    await proxy.getCachedOrFetch(REQ);
    expect(proxy.__stats().breaker).toBe("closed");

    // Force TTL to expire so next call attempts upstream.
    nowMs += 61_000;
    mode = "limit";

    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("stale");
    expect(v.subgraphState).toBe("degraded");
    if (v.kind === "stale") expect(v.reason).toBe("rate_limited");
    expect(proxy.__stats().breaker).toBe("open");
  });

  it("returns rate-limited error envelope when breaker is open and no cache", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({}, 429));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("error");
    expect(v.status).toBe(429);
    expect(v.subgraphState).toBe("down");
    expect((v.body as { errors: Array<{ extensions: { code: string } }> }).errors[0].extensions.code).toBe(
      RATE_LIMIT_ERROR_CODE,
    );
  });

  it("does not call upstream while breaker is open", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({}, 429));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    await proxy.getCachedOrFetch(REQ);
    expect(fetcher.calls).toHaveLength(1);
    await proxy.getCachedOrFetch(REQ);
    await proxy.getCachedOrFetch(REQ);
    // Still only the one trip — breaker is open, no further upstream calls.
    expect(fetcher.calls).toHaveLength(1);
  });

  it("transitions to half-open after breakerOpenMs and closes on a successful trial", async () => {
    let mode: "ok" | "limit" = "limit";
    const fetcher = makeFakeFetcher(() =>
      mode === "ok"
        ? jsonResponse({ data: { v: 2 } })
        : jsonResponse({}, 429),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
      breakerOpenMs: 1000,
    });

    await proxy.getCachedOrFetch(REQ); // trips
    expect(proxy.__stats().breaker).toBe("open");

    nowMs += 1500; // past open window
    mode = "ok";
    const v = await proxy.getCachedOrFetch(REQ);

    expect(v.kind).toBe("fresh");
    expect(v.subgraphState).toBe("ok");
    expect(proxy.__stats().breaker).toBe("closed");
  });

  it("re-opens the breaker if the half-open trial also returns 429", async () => {
    const fetcher = makeFakeFetcher(() => jsonResponse({}, 429));
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
      breakerOpenMs: 1000,
    });

    await proxy.getCachedOrFetch(REQ); // trips
    nowMs += 1500;
    await proxy.getCachedOrFetch(REQ); // half-open trial → 429 again
    expect(proxy.__stats().breaker).toBe("open");
  });

  it("treats a 200 body containing rate-limit errors as a 429", async () => {
    const fetcher = makeFakeFetcher(() =>
      jsonResponse({
        errors: [{ message: "Rate limit exceeded", extensions: { code: "RATE_LIMITED" } }],
      }),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("error");
    expect(v.status).toBe(429);
    expect(proxy.__stats().breaker).toBe("open");
  });

  it("stops serving stale once past STALE_GRACE_MULT * ttl", async () => {
    let mode: "ok" | "limit" = "ok";
    const fetcher = makeFakeFetcher(() =>
      mode === "ok" ? jsonResponse({ data: { v: 1 } }) : jsonResponse({}, 429),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
      breakerOpenMs: 10 * 60_000,
    });

    await proxy.getCachedOrFetch(REQ); // primes cache; storedAt = nowMs
    mode = "limit";
    nowMs += 61_000; // past TTL → triggers upstream which returns 429
    const stale = await proxy.getCachedOrFetch(REQ);
    expect(stale.kind).toBe("stale");

    // Past 6 * 60s = 360s grace; cache is no longer eligible.
    nowMs += 6 * 60_000;
    const downed = await proxy.getCachedOrFetch(REQ);
    expect(downed.kind).toBe("error");
    expect(downed.subgraphState).toBe("down");
  });
});

describe("subgraphProxy — network and HTTP errors", () => {
  let nowMs = 1_000_000;
  beforeEach(() => {
    nowMs = 1_000_000;
  });

  it("does not trip the breaker on transient network errors", async () => {
    let mode: "ok" | "throw" = "ok";
    const fetcher = vi.fn(async () => {
      if (mode === "throw") throw new Error("ECONNREFUSED");
      return jsonResponse({ data: { v: 1 } });
    });
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });

    await proxy.getCachedOrFetch(REQ);
    nowMs += 61_000;
    mode = "throw";
    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("stale");
    if (v.kind === "stale") expect(v.reason).toBe("network");
    expect(proxy.__stats().breaker).toBe("closed");
  });

  it("returns a 502 envelope when network fails and there is no cache", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });
    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("error");
    expect(v.status).toBe(502);
    expect(v.subgraphState).toBe("down");
  });

  it("passes through non-429 HTTP errors with the upstream status", async () => {
    const fetcher = makeFakeFetcher(() =>
      jsonResponse({ errors: [{ message: "boom" }] }, 500),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
      now: () => nowMs,
    });
    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("error");
    expect(v.status).toBe(500);
    expect(proxy.__stats().breaker).toBe("closed");
  });
});

describe("subgraphProxy — __reset", () => {
  it("clears cache and resets breaker", async () => {
    let mode: "ok" | "limit" = "limit";
    const fetcher = makeFakeFetcher(() =>
      mode === "ok" ? jsonResponse({ data: {} }) : jsonResponse({}, 429),
    );
    const proxy = createSubgraphProxy({
      upstreamUrl: "https://example.test/q",
      fetcher,
    });

    await proxy.getCachedOrFetch(REQ);
    expect(proxy.__stats().breaker).toBe("open");
    proxy.__reset();
    expect(proxy.__stats().breaker).toBe("closed");
    expect(proxy.__stats().cacheSize).toBe(0);

    mode = "ok";
    const v = await proxy.getCachedOrFetch(REQ);
    expect(v.kind).toBe("fresh");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
