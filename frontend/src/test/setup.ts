import "@testing-library/jest-dom";

// Required env vars — must be set before any module imports @/lib/env
process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS =
  "0x0000000000000000000000000000000000000001";
process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000002";
process.env.ALCHEMY_API_KEY = "test-alchemy-key";
process.env.PINATA_JWT = "test-pinata-jwt";
// Force GraphQL path in useCollections (avoids needing a WagmiProvider)
process.env.NEXT_PUBLIC_SUBGRAPH_URL = "http://localhost:8000/subgraph";
