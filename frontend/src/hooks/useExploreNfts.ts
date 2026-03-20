import { useEffect, useState } from "react";
import { formatEther, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";

export interface NFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
}

export interface NFTItemWithMarket extends NFTItem {
  listingPrice: string | null;
  topOffer: string | null;
}

export interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
  };
}

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

async function fetchTopOffer(
  nftContract: `0x${string}`,
  tokenId: string,
): Promise<string | null> {
  try {
    const buyers = (await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "getOfferBuyers",
      args: [nftContract, BigInt(tokenId)],
    })) as `0x${string}`[];

    if (buyers.length === 0) return null;

    const uniqueBuyers = [...new Set(buyers)];
    const now = BigInt(Math.floor(Date.now() / 1000));

    const offerAmounts = await Promise.all(
      uniqueBuyers.map(async (buyer) => {
        try {
          const offer = (await publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: NFT_MARKETPLACE_ABI,
            functionName: "getOffer",
            args: [nftContract, BigInt(tokenId), buyer],
          })) as {
            buyer: string;
            amount: bigint;
            expiresAt: bigint;
            active: boolean;
          };

          if (offer.active && offer.expiresAt > now) return offer.amount;
          return null;
        } catch {
          return null;
        }
      }),
    );

    const active = offerAmounts.filter((a): a is bigint => a !== null);
    if (active.length === 0) return null;

    const top = active.reduce(
      (max, curr) => (curr > max ? curr : max),
      active[0],
    );
    return formatEther(top);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// useExploreNFTs
// Aceita collectionAddress para buscar NFTs de uma coleção específica.
// Na Opção A, sempre passa o endereço da coleção — não há "coleção padrão".
// ─────────────────────────────────────────────

export function useExploreNFTs(collectionAddress?: string) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ collectionAddress é obrigatório na Opção A
  // Se não vier, retorna vazio — o Explorer deve passar o endereço da coleção
  const nftContract = collectionAddress as `0x${string}` | undefined;

  useEffect(() => {
    if (!nftContract) {
      setNfts([]);
      setIsLoading(false);
      return;
    }

    const fetchNFTs = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForContract?contractAddress=${nftContract}&withMetadata=true&refreshCache=false`,
        );
        const data = await res.json();

        if (!data.nfts || data.nfts.length === 0) {
          setNfts([]);
          return;
        }

        const items: NFTItemWithMarket[] = await Promise.all(
          data.nfts.map(async (nft: AlchemyNFT) => {
            let image = nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "";
            if (!image && nft.tokenUri) {
              try {
                const metaRes = await fetch(resolveIpfsUrl(nft.tokenUri));
                const meta = await metaRes.json();
                image = resolveIpfsUrl(meta.image ?? "");
              } catch {
                image = "";
              }
            }

            let listingPrice: string | null = null;
            try {
              const listing = (await publicClient.readContract({
                address: MARKETPLACE_ADDRESS,
                abi: NFT_MARKETPLACE_ABI,
                functionName: "getListing",
                args: [nftContract, BigInt(nft.tokenId)],
              })) as { seller: string; price: bigint; active: boolean };

              if (listing.active) listingPrice = formatEther(listing.price);
            } catch {
              listingPrice = null;
            }

            const topOffer = await fetchTopOffer(nftContract, nft.tokenId);

            return {
              tokenId: nft.tokenId,
              name: nft.name ?? `NFT #${nft.tokenId}`,
              description: nft.description ?? "",
              image,
              nftContract,
              listingPrice,
              topOffer,
            };
          }),
        );

        setNfts(items);
      } catch (error) {
        console.error("Erro ao buscar NFTs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [nftContract]);

  return { nfts, isLoading };
}
