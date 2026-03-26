// Shapes returned by the Alchemy NFT API

export interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  contract?: { address: string };
  collection?: { name?: string };
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
  };
}

/** Minimal metadata used across UI components */
export type NFTMeta = { name: string; image: string };

/** tokenKey → NFTMeta, where tokenKey = `${contractAddress.toLowerCase()}-${tokenId}` */
export type MetaMap = Map<string, NFTMeta>;
