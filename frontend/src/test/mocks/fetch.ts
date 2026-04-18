import { vi } from "vitest";

type FetchMatcher =
  | { url: string | RegExp; method?: string }
  | ((req: Request) => boolean);

type FetchHandler = (req: Request) => Response | Promise<Response>;

interface FetchMockHandle {
  when: (matcher: FetchMatcher, handler: FetchHandler) => void;
  whenJson: (matcher: FetchMatcher, body: unknown, init?: ResponseInit) => void;
  whenError: (matcher: FetchMatcher, error: Error) => void;
  reset: () => void;
  calls: () => Request[];
}

function matches(matcher: FetchMatcher, req: Request): boolean {
  if (typeof matcher === "function") return matcher(req);
  const urlOk =
    typeof matcher.url === "string"
      ? req.url.includes(matcher.url)
      : matcher.url.test(req.url);
  const methodOk = !matcher.method || req.method === matcher.method;
  return urlOk && methodOk;
}

export function installFetchMock(): FetchMockHandle {
  const handlers: Array<{ matcher: FetchMatcher; handler: FetchHandler }> = [];
  const _calls: Request[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      _calls.push(req.clone());
      for (const { matcher, handler } of handlers) {
        if (matches(matcher, req)) return handler(req);
      }
      throw new Error(`[fetchMock] No handler for ${req.method} ${req.url}`);
    },
  );

  return {
    when(matcher, handler) {
      handlers.unshift({ matcher, handler });
    },
    whenJson(matcher, body, init) {
      handlers.unshift({
        matcher,
        handler: () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
            ...init,
          }),
      });
    },
    whenError(matcher, error) {
      handlers.unshift({
        matcher,
        handler: () => Promise.reject(error),
      });
    },
    reset() {
      handlers.length = 0;
      _calls.length = 0;
      vi.mocked(globalThis.fetch).mockReset();
    },
    calls: () => [..._calls],
  };
}

// ── Pre-canned helpers ────────────────────────────────────────────────────────

export function mockIpfsGateway(
  cid: string,
  body: unknown,
  handle: FetchMockHandle,
) {
  const pattern = new RegExp(`/ipfs/${cid}`);
  handle.whenJson({ url: pattern }, body);
}

export function mockPinataPinFile(
  result: { IpfsHash: string },
  handle: FetchMockHandle,
) {
  handle.whenJson(
    { url: "api.pinata.cloud/pinning/pinFileToIPFS", method: "POST" },
    result,
  );
}

export function mockPinataPinJson(
  result: { IpfsHash: string },
  handle: FetchMockHandle,
) {
  handle.whenJson(
    { url: "api.pinata.cloud/pinning/pinJSONToIPFS", method: "POST" },
    result,
  );
}

export function mockAlchemyRpc(
  method: string,
  result: unknown,
  handle: FetchMockHandle,
) {
  handle.when(
    (req) => req.url.includes("/alchemy/") || req.url.includes("alchemyapi"),
    async (req) => {
      const body = await req.clone().json();
      if (body?.method === method) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`[mockAlchemyRpc] Unexpected method: ${body?.method}`);
    },
  );
}

export function mockSubgraphQuery(
  operationName: string,
  data: unknown,
  handle: FetchMockHandle,
) {
  handle.when(
    (req) => req.url.includes("subgraph") || req.url.includes("graphql"),
    async (req) => {
      const body = await req.clone().json();
      if (!operationName || body?.operationName === operationName) {
        return new Response(JSON.stringify({ data }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(
        `[mockSubgraphQuery] Unexpected operation: ${body?.operationName}`,
      );
    },
  );
}
