import { NextRequest, NextResponse } from "next/server";
import { ALCHEMY_API_KEY as ALCHEMY_KEY } from "@/lib/env";
import { logger } from "@/lib/logger";

const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

/**
 * POST /api/alchemy/getOwnerCountsBatch
 *
 * Body: { contractAddresses: string[] }
 * Response: { [address_lowercase]: number }
 *
 * Fans out to Alchemy on the server so the browser pays only one round-trip
 * regardless of how many contracts are requested. Each upstream request is
 * individually cached by Next.js data cache (60 s TTL).
 */
export async function POST(req: NextRequest) {
  const { contractAddresses } = (await req.json()) as {
    contractAddresses: string[];
  };

  if (!Array.isArray(contractAddresses) || contractAddresses.length === 0) {
    return NextResponse.json({});
  }

  const entries = await Promise.all(
    contractAddresses.map(async (addr) => {
      try {
        const res = await fetch(
          `${ALCHEMY_BASE}/getOwnersForContract?contractAddress=${addr}&withTokenBalances=false`,
          { next: { revalidate: 60 } },
        );
        const data = (await res.json()) as { owners?: string[] };
        return [addr.toLowerCase(), data.owners?.length ?? 0] as const;
      } catch (err) {
        logger.error("getOwnerCountsBatch: falha ao buscar owners", err, {
          contractAddress: addr,
        });
        return [addr.toLowerCase(), 0] as const;
      }
    }),
  );

  return NextResponse.json(Object.fromEntries(entries));
}
