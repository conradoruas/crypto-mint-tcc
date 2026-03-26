import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

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
  const { path } = await params;
  const endpoint = path.join("/");
  const search = req.nextUrl.search;
  const upstream = `${ALCHEMY_BASE}/${endpoint}${search}`;

  // Next.js data cache: deduplicates concurrent requests and revalidates by TTL
  const res = await fetch(upstream, { next: { revalidate: getTTL(endpoint) } });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

// Cached POST fetcher — cache key is (endpoint, serialized body)
const cachedPostFetch = unstable_cache(
  async (endpoint: string, bodyStr: string): Promise<unknown> => {
    const res = await fetch(`${ALCHEMY_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
    if (!res.ok) throw new Error(`Alchemy error ${res.status}`);
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
  const body = await req.json();

  try {
    const data = await cachedPostFetch(endpoint, JSON.stringify(body));
    return Response.json(data);
  } catch {
    // On upstream error, fall back to uncached request so caller gets the real status
    const res = await fetch(`${ALCHEMY_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  }
}
