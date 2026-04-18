import { type NextRequest } from "next/server";
import { ALCHEMY_API_KEY as ALCHEMY_KEY } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CLIENT_UPSTREAM_FAILED } from "@/lib/apiUpstream";

const ALCHEMY_RPC = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

function sanitizeRpcResponse(
  data: unknown,
  res: Response,
  requestBody: unknown,
): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;
  const reqId =
    requestBody &&
    typeof requestBody === "object" &&
    !Array.isArray(requestBody) &&
    "id" in requestBody
      ? (requestBody as { id: unknown }).id
      : null;

  // Plain error objects (e.g. some gateways) — never forward `message` text
  if (typeof o.message === "string" && !("jsonrpc" in o)) {
    logger.error("RPC upstream plain error object", undefined, {
      payload: data,
      httpStatus: res.status,
    });
    return {
      jsonrpc: "2.0",
      id: reqId,
      error: { code: -32603, message: CLIENT_UPSTREAM_FAILED },
    };
  }

  if (!("jsonrpc" in o) || o.error == null) return data;

  logger.error("RPC upstream JSON-RPC error", undefined, { payload: data });

  const id = "id" in o ? o.id : null;
  const err = o.error as { code?: unknown };
  const code = typeof err?.code === "number" ? err.code : -32603;

  return {
    jsonrpc: typeof o.jsonrpc === "string" ? o.jsonrpc : "2.0",
    id,
    error: {
      code,
      message: CLIENT_UPSTREAM_FAILED,
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  let res: Response;
  try {
    res = await fetch(ALCHEMY_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error("RPC fetch failed", err);
    return Response.json(
      {
        jsonrpc: "2.0",
        id: (body as { id?: unknown })?.id ?? null,
        error: { code: -32603, message: CLIENT_UPSTREAM_FAILED },
      },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    logger.error("RPC non-JSON response", err, { status: res.status });
    return Response.json(
      {
        jsonrpc: "2.0",
        id: (body as { id?: unknown })?.id ?? null,
        error: { code: -32603, message: CLIENT_UPSTREAM_FAILED },
      },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  const out = sanitizeRpcResponse(data, res, body);
  return Response.json(out, { status: res.status });
}
