import type { Metadata } from "next";
import AssetPageClient from "./AssetPageClient";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_BASE = `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

async function fetchNFTMeta(contract: string, tokenId: string) {
  try {
    const res = await fetch(
      `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${contract}&tokenId=${tokenId}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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

  const nft = await fetchNFTMeta(contract, id);
  if (!nft) return fallback;

  const name: string = nft.name ?? nft.contract?.name ?? `NFT #${id}`;
  const description: string | undefined = nft.description || undefined;
  const image: string | undefined =
    nft.image?.cachedUrl ?? nft.image?.originalUrl ?? undefined;

  return {
    title: `${name} | CryptoMint`,
    description,
    openGraph: {
      title: name,
      description,
      images: image ? [{ url: image }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: image ? [image] : [],
    },
  };
}

export default function AssetPage() {
  return <AssetPageClient />;
}
