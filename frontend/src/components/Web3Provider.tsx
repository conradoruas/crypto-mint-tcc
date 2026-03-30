"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ReactNode, useState } from "react";

const config = createConfig(
  getDefaultConfig({
    // Obtenha seu WalletConnect Project ID em cloud.walletconnect.com
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    chains: [sepolia],
    appName: "CryptoMint NFT Marketplace",
    // Roteia todas as leituras RPC pelo proxy Alchemy server-side.
    // Garante useBalance, useReadContract e useNFTListing confiáveis.
    transports: {
      [sepolia.id]: http("/api/rpc"),
    },
  }),
);

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  // QueryClient inside React lifecycle prevents shared state across SSR requests
  // and avoids re‑creating on hot-reload in development.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
