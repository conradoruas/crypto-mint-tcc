import { NextRequest } from "next/server";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_RPC = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(ALCHEMY_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
