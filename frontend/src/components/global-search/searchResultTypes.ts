export type SearchCollectionResult = {
  contractAddress: string;
  name: string;
  symbol: string;
  image: string;
  totalSupply?: string;
};

export type SearchNftResult = {
  id: string;
  href: string;
  tokenId: string;
  collectionName: string;
  image: string;
  name: string;
};
