import { type NextRequest } from "next/server";
import { getDefaultProxy, type GraphQLRequest } from "@/lib/subgraphProxy";
import { SUBGRAPH_STATE_HEADER } from "@/lib/subgraphErrors";
import { logger } from "@/lib/logger";

// Force the Node.js runtime so the module-level cache + breaker state
// persists across requests on the same lambda instance.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

function isGraphQLRequest(value: unknown): value is GraphQLRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.query !== "string" || v.query.length === 0) return false;
  if (v.operationName !== undefined && typeof v.operationName !== "string") {
    return false;
  }
  if (
    v.variables !== undefined &&
    (v.variables === null || typeof v.variables !== "object" || Array.isArray(v.variables))
  ) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json(
      { errors: [{ message: "Request body too large." }] },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { errors: [{ message: "Invalid JSON body." }] },
      { status: 400 },
    );
  }

  if (!isGraphQLRequest(body)) {
    return Response.json(
      { errors: [{ message: "Invalid GraphQL request body." }] },
      { status: 400 },
    );
  }

  let proxy;
  try {
    proxy = getDefaultProxy();
  } catch (err) {
    logger.error("Subgraph proxy not configured", err);
    return Response.json(
      { errors: [{ message: "Subgraph endpoint not configured." }] },
      { status: 503 },
    );
  }

  const verdict = await proxy.getCachedOrFetch(body);

  return Response.json(verdict.body, {
    status: verdict.status,
    headers: { [SUBGRAPH_STATE_HEADER]: verdict.subgraphState },
  });
}
