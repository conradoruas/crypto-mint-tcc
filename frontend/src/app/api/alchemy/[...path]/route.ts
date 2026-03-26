import { NextRequest } from "next/server";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join("/");
  const search = req.nextUrl.search;
  const upstream = `${ALCHEMY_BASE}/${endpoint}${search}`;

  const res = await fetch(upstream);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join("/");
  const body = await req.json();
  const upstream = `${ALCHEMY_BASE}/${endpoint}`;

  const res = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
