import { parseAddress } from "@/lib/schemas";

export const MARKETPLACE_ADDRESS = parseAddress(
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
);

export const FACTORY_ADDRESS = parseAddress(
  process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS,
);

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const FACTORY_V2_ADDRESS = parseAddress(
  process.env.NEXT_PUBLIC_FACTORY_V2_CONTRACT_ADDRESS,
);

// The subgraph URL is server-only — see SUBGRAPH_URL in lib/subgraphProxy.ts.
// On the public side we only need to know whether the subgraph is configured,
// so client code can decide between the GraphQL path and the RPC path.
//
// Canonical signal: NEXT_PUBLIC_SUBGRAPH_ENABLED=true. For backward compat we
// also accept a non-empty NEXT_PUBLIC_SUBGRAPH_URL so existing .env files keep
// working until the migration is complete.
export const SUBGRAPH_ENABLED =
  process.env.NEXT_PUBLIC_SUBGRAPH_ENABLED === "true" ||
  !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;
