import "@testing-library/jest-dom";

// Env vars consumed at module level by hooks
process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS =
  "0x0000000000000000000000000000000000000001";
process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000002";
// Force GraphQL path in useCollections (avoids needing a WagmiProvider)
process.env.NEXT_PUBLIC_SUBGRAPH_URL = "http://localhost:8000/subgraph";
