import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export interface NFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  listingPrice: string | null; // null = não listado
}

interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
  };
}

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;
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

export function useExploreNFTs() {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNFTs = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForContract?contractAddress=${CONTRACT_ADDRESS}&withMetadata=true`,
        );
        const data = await res.json();

        const items: NFTItem[] = await Promise.all(
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

            // Busca o preço de listagem do contrato
            let listingPrice: string | null = null;
            try {
              const listing = (await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: NFT_MARKETPLACE_ABI,
                functionName: "getListing",
                args: [BigInt(nft.tokenId)],
              })) as { seller: string; price: bigint; active: boolean };

              if (listing.active) {
                listingPrice = formatEther(listing.price);
              }
            } catch {
              listingPrice = null;
            }

            return {
              tokenId: nft.tokenId,
              name: nft.name ?? `NFT #${nft.tokenId}`,
              description: nft.description ?? "",
              image,
              listingPrice,
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
  }, []);

  return { nfts, isLoading };
}
