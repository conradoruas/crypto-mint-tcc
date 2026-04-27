export const NFT_COLLECTION_FACTORY_V2_ABI = [
  // ─── Write ───
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "symbol", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "string", name: "image", type: "string" },
      { internalType: "uint256", name: "maxSupply", type: "uint256" },
      { internalType: "uint256", name: "mintPrice", type: "uint256" },
      { internalType: "string", name: "contractURI", type: "string" },
    ],
    name: "createCollection",
    outputs: [{ internalType: "address", name: "collectionAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ─── Views ───
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getCollection",
    outputs: [
      {
        components: [
          { internalType: "address", name: "contractAddress", type: "address" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "description", type: "string" },
          { internalType: "string", name: "image", type: "string" },
          { internalType: "string", name: "contractURI", type: "string" },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
          { internalType: "uint256", name: "mintPrice", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
        ],
        internalType: "struct NFTCollectionFactoryV2.CollectionInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllCollections",
    outputs: [
      {
        components: [
          { internalType: "address", name: "contractAddress", type: "address" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "description", type: "string" },
          { internalType: "string", name: "image", type: "string" },
          { internalType: "string", name: "contractURI", type: "string" },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
          { internalType: "uint256", name: "mintPrice", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
        ],
        internalType: "struct NFTCollectionFactoryV2.CollectionInfo[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "getCreatorCollections",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalCollections",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ─── Events ───
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: true, internalType: "address", name: "contractAddress", type: "address" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
      { indexed: true, internalType: "uint256", name: "collectionId", type: "uint256" },
      { indexed: false, internalType: "string", name: "contractURI", type: "string" },
    ],
    name: "CollectionCreated",
    type: "event",
  },
] as const;
