import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { ALCHEMY_API_KEY as ALCHEMY_KEY } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CLIENT_UPSTREAM_FAILED, peekErrorBody } from "@/lib/apiUpstream";

const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

/** Allowed Alchemy NFT API endpoints — requests to unlisted endpoints are rejected. */
const ALLOWED_ENDPOINTS = new Set([
  "getNFTMetadata",
  "getNFTMetadataBatch",
  "getContractsForOwner",
  "getContractMetadata",
  "getNFTsForContract",
  "getOwnersForNFT",
  "getOwnersForContract",
  "getNFTsForOwner",
]);

/** TTL in seconds per endpoint category */
function getTTL(endpoint: string): number {
  // NFT metadata is immutable (IPFS) — cache aggressively
  if (endpoint === "getNFTMetadata" || endpoint === "getNFTMetadataBatch")
    return 3600;
  // Collection/contract info changes rarely
  if (
    endpoint === "getContractsForOwner" ||
    endpoint === "getContractMetadata"
  )
    return 300;
  // Ownership and balances change with transfers — short TTL
  return 60;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let endpoint = "unknown";
  try {
    const { path } = await params;
    endpoint = path.join("/");

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return Response.json({ error: "Endpoint not allowed" }, { status: 403 });
    }

    const search = req.nextUrl.search;
    const upstream = `${ALCHEMY_BASE}/${endpoint}${search}`;
    // Next.js data cache: deduplicates concurrent requests and revalidates by TTL
    const res = await fetch(upstream, { next: { revalidate: getTTL(endpoint) } });

    if (!res.ok) {
      const preview = await peekErrorBody(res);
      logger.error("Alchemy NFT API GET failed", undefined, {
        endpoint,
        status: res.status,
        bodyPreview: preview,
      });
      return Response.json(
        { error: CLIENT_UPSTREAM_FAILED },
        { status: res.status },
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    logger.error("Alchemy NFT API GET exception", err, { endpoint });
    return Response.json({ error: CLIENT_UPSTREAM_FAILED }, { status: 502 });
  }
}


// Cached POST fetcher — cache key is (endpoint, serialized body)
const cachedPostFetch = unstable_cache(
  async (endpoint: string, bodyStr: string): Promise<unknown> => {
    const res = await fetch(`${ALCHEMY_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
    if (!res.ok) {
      const preview = await peekErrorBody(res);
      logger.error("Alchemy NFT API POST (cached) failed", undefined, {
        endpoint,
        status: res.status,
        bodyPreview: preview,
      });
      throw new Error("alchemy_upstream_error");
    }
    return res.json();
  },
  ["alchemy-post"],
  { revalidate: 3600 },
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join("/");

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return Response.json({ error: "Endpoint not allowed" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const data = await cachedPostFetch(endpoint, JSON.stringify(body));
    return Response.json(data);
  } catch (cacheErr) {
    logger.warn("Alchemy NFT API POST cache miss", {
      endpoint,
      cause:
        cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
    });
    try {
      const res = await fetch(`${ALCHEMY_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const preview = await peekErrorBody(res);
        logger.error("Alchemy NFT API POST fallback failed", undefined, {
          endpoint,
          status: res.status,
          bodyPreview: preview,
        });
        return Response.json(
          { error: CLIENT_UPSTREAM_FAILED },
          { status: res.status },
        );
      }
      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        logger.error("Alchemy NFT API POST invalid JSON", parseErr, {
          endpoint,
        });
        return Response.json({ error: CLIENT_UPSTREAM_FAILED }, { status: 502 });
      }
      return Response.json(data);
    } catch (fallbackErr) {
      logger.error("Alchemy NFT API POST fallback exception", fallbackErr, {
        endpoint,
      });
      return Response.json({ error: CLIENT_UPSTREAM_FAILED }, { status: 502 });
    }
  }
}
