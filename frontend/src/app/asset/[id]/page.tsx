import type { Metadata } from "next";
import AssetPageClient from "./AssetPageClient";
import type { NFTItem } from "@/types/nft";
import { ALCHEMY_API_KEY as ALCHEMY_KEY } from "@/lib/env";
import { parseAddress, parseTokenId } from "@/lib/schemas";
import { normalizeNftText, resolveNftImage } from "@/lib/nftMetadata";
import { getSafeImageUrl } from "@/lib/resourceSecurity";

const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

async function fetchNFTMeta(contract: string, tokenId: string) {
  try {
    const res = await fetch(
      `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${contract}&tokenId=${tokenId}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return res.json() as Promise<Record<string, unknown>>;
  } catch {
    return null;
  }
}

/**
 * Parses the raw Alchemy NFT metadata response into an NFTItem.
 * Includes a tokenUri IPFS fallback for NFTs where Alchemy has no cached image.
 */
async function parseNFTToItem(
  data: Record<string, unknown>,
  tokenId: string,
  contract: string,
): Promise<NFTItem> {
  const imageData = data.image as
    | { cachedUrl?: string; originalUrl?: string }
    | undefined;
  const image = await resolveNftImage(
    imageData,
    typeof data.tokenUri === "string" ? data.tokenUri : undefined,
    { ipfsOnlyTokenUri: true },
  );

  return {
    tokenId: normalizeNftText(data.tokenId, tokenId, 100),
    name: normalizeNftText(data.name, `NFT #${tokenId}`, 500),
    description: normalizeNftText(data.description, "", 10_000),
    image,
    nftContract: contract as `0x${string}`,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contract?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { contract } = await searchParams;
  const nftContract = parseAddress(contract);
  const tokenId = parseTokenId(id);

  const fallback: Metadata = { title: `NFT #${tokenId ?? id} | CryptoMint` };
  if (!nftContract || !tokenId) return fallback;

  const data = await fetchNFTMeta(nftContract, tokenId);
  if (!data) return fallback;

  const name: string =
    normalizeNftText(
      data.name ?? (data.contract as { name?: string } | undefined)?.name,
      `NFT #${tokenId}`,
      500,
    );
  const description: string | undefined =
    normalizeNftText(data.description, "", 10_000) || undefined;
  const imageData = data.image as
    | { cachedUrl?: string; originalUrl?: string }
    | undefined;
  const image: string | undefined =
    getSafeImageUrl(imageData?.cachedUrl ?? imageData?.originalUrl ?? "") ?? undefined;

  return {
    title: `${name} | CryptoMint`,
    description,
    openGraph: { title: name, description, images: image ? [{ url: image }] : [] },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contract?: string }>;
}) {
  const { id } = await params;
  const { contract } = await searchParams;
  const nftContract = parseAddress(contract);
  const tokenId = parseTokenId(id);

  let initialNft: NFTItem | null = null;
  if (nftContract && tokenId) {
    const data = await fetchNFTMeta(nftContract, tokenId);
    if (data) initialNft = await parseNFTToItem(data, tokenId, nftContract);
  }

  return <AssetPageClient initialNft={initialNft} />;
}
