import type { Metadata } from "next";
import AssetPageClient from "./AssetPageClient";
import type { NFTItem } from "@/types/nft";
import { ALCHEMY_API_KEY as ALCHEMY_KEY } from "@/lib/env";
import { resolveIpfsUrl } from "@/lib/ipfs";

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
  let image = imageData?.cachedUrl ?? imageData?.originalUrl ?? "";

  if (!image && data.tokenUri) {
    try {
      const metaRes = await fetch(resolveIpfsUrl(data.tokenUri as string));
      const meta = await metaRes.json() as Record<string, unknown>;
      image = resolveIpfsUrl((meta.image as string | undefined) ?? "");
    } catch {
      // image stays empty — client will show placeholder
    }
  }

  return {
    tokenId: (data.tokenId as string | undefined) ?? tokenId,
    name: (data.name as string | undefined) ?? `NFT #${tokenId}`,
    description: (data.description as string | undefined) ?? "",
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

  const fallback: Metadata = { title: `NFT #${id} | CryptoMint` };
  if (!contract) return fallback;

  const data = await fetchNFTMeta(contract, id);
  if (!data) return fallback;

  const name: string =
    (data.name as string | undefined) ??
    (data.contract as { name?: string } | undefined)?.name ??
    `NFT #${id}`;
  const description: string | undefined =
    (data.description as string | undefined) || undefined;
  const imageData = data.image as
    | { cachedUrl?: string; originalUrl?: string }
    | undefined;
  const image: string | undefined =
    imageData?.cachedUrl ?? imageData?.originalUrl ?? undefined;

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

  let initialNft: NFTItem | null = null;
  if (contract) {
    const data = await fetchNFTMeta(contract, id);
    if (data) initialNft = await parseNFTToItem(data, id, contract);
  }

  return <AssetPageClient initialNft={initialNft} />;
}
