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

export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
export const SUBGRAPH_ENABLED = !!SUBGRAPH_URL;
