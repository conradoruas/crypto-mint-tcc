import { type ReactElement, type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { renderHook, type RenderHookResult } from "@testing-library/react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { vi } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProvidersOptions {
  apolloMocks?: MockLink.MockedResponse[];
  queryClient?: QueryClient;
}

// ── Internal wrapper ──────────────────────────────────────────────────────────

function buildWrapper(options: ProvidersOptions = {}) {
  const { apolloMocks = [], queryClient } = options;

  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  const link = new MockLink(apolloMocks, { showWarnings: false });
  const apolloClient = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: "no-cache" },
      query: { fetchPolicy: "no-cache" },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark">
        <QueryClientProvider client={qc}>
          <ApolloProvider client={apolloClient}>
            {children}
            <Toaster />
          </ApolloProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return { Wrapper, queryClient: qc, apolloClient };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderWithProviders(
  ui: ReactElement,
  options?: ProvidersOptions,
): RenderResult & { queryClient: QueryClient } {
  const { Wrapper, queryClient } = buildWrapper(options);
  const result = render(ui, { wrapper: Wrapper });
  return { ...result, queryClient };
}

export function wrapperWithProviders(options?: ProvidersOptions) {
  const { Wrapper } = buildWrapper(options);
  return Wrapper;
}

export function renderHookWithProviders<T>(
  hook: () => T,
  options?: ProvidersOptions,
): RenderHookResult<T, unknown> & { queryClient: QueryClient } {
  const { Wrapper, queryClient } = buildWrapper(options);
  const result = renderHook(hook, { wrapper: Wrapper });
  return { ...result, queryClient };
}

// ── Wagmi mock factory ────────────────────────────────────────────────────────
// Use this in vi.mock("wagmi", () => makeWagmiMocks()) at the top of test files.
// Call configureWagmiMocks() inside beforeEach to change the connected wallet.

export interface WalletConfig {
  address?: `0x${string}`;
  chainId?: number;
  isConnected?: boolean;
  status?: "connected" | "connecting" | "disconnected" | "reconnecting";
}

let _walletConfig: WalletConfig = {
  address: undefined,
  chainId: 1,
  isConnected: false,
  status: "disconnected",
};

export function configureWagmiMocks(config: WalletConfig) {
  _walletConfig = { ..._walletConfig, ...config };
}

export function resetWagmiMocks() {
  _walletConfig = {
    address: undefined,
    chainId: 1,
    isConnected: false,
    status: "disconnected",
  };
}

/**
 * Returns a vi.mock("wagmi") factory that reads from configureWagmiMocks().
 * Usage:
 *   import { makeWagmiMocks } from "@/test/renderWithProviders";
 *   vi.mock("wagmi", makeWagmiMocks);
 */
export function makeWagmiMocks() {
  const mutateAsync = vi.fn();
  const writeContract = { mutateAsync, isPending: false, reset: vi.fn() };

  return {
    useAccount: vi.fn(() => ({
      address: _walletConfig.address,
      isConnected: _walletConfig.isConnected ?? !!_walletConfig.address,
      status: _walletConfig.status ?? (_walletConfig.address ? "connected" : "disconnected"),
    })),
    useConnection: vi.fn(() => ({
      address: _walletConfig.address,
      isConnected: _walletConfig.isConnected ?? !!_walletConfig.address,
    })),
    useChainId: vi.fn(() => _walletConfig.chainId ?? 1),
    useSwitchChain: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    usePublicClient: vi.fn(() => ({
      readContract: vi.fn(),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
    })),
    useWalletClient: vi.fn(() => ({ data: null })),
    useWriteContract: vi.fn(() => writeContract),
    useWaitForTransactionReceipt: vi.fn(() => ({
      isLoading: false,
      isSuccess: false,
      data: undefined,
    })),
    useReadContract: vi.fn(() => ({ data: undefined, isLoading: false })),
    useReadContracts: vi.fn(() => ({ data: undefined, isLoading: false })),
    useBlockNumber: vi.fn(() => ({ data: undefined })),
    useBalance: vi.fn(() => ({ data: undefined })),
    useSignMessage: vi.fn(() => ({ signMessageAsync: vi.fn() })),
    useSignTypedData: vi.fn(() => ({ signTypedDataAsync: vi.fn() })),
    useDisconnect: vi.fn(() => ({ mutate: vi.fn(), disconnect: vi.fn() })),
  };
}
