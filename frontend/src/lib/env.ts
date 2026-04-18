/**
 * Runtime environment validation — SERVER ONLY.
 *
 * Import this file only from server components, API routes, and server-side
 * utilities. Never import it from client components ("use client") or any
 * module that is bundled for the browser — non-NEXT_PUBLIC_ vars are stripped
 * from the client bundle and would trigger false "missing variable" errors.
 *
 * Required vars throw immediately on import so the server crashes with a clear
 * message instead of failing silently later with a cryptic error.
 *
 * Optional vars are exported as `string | undefined`; the consuming code is
 * already guarded (feature flags, fallback values, etc.).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${name}\n` +
        `      Set it in .env.local (development) or in the Vercel dashboard (production).`,
    );
  }
  return value;
}

// ── Required ──────────────────────────────────────────────────────────────────

/** Address of the deployed NFT marketplace contract. */
export const MARKETPLACE_ADDRESS = required(
  "NEXT_PUBLIC_MARKETPLACE_ADDRESS",
) as `0x${string}`;

/** Address of the deployed NFT collection factory contract. */
export const FACTORY_ADDRESS = required(
  "NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS",
) as `0x${string}`;

/** Alchemy API key — used by the /api/alchemy proxy and server-side metadata fetching. */
export const ALCHEMY_API_KEY = required("ALCHEMY_API_KEY");

/** Pinata JWT — used by the /api/upload* routes to pin files to IPFS. */
export const PINATA_JWT = required("PINATA_JWT");

// ── Optional ──────────────────────────────────────────────────────────────────

/** WalletConnect project ID. If absent, WalletConnect is disabled in ConnectKit. */
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/** The Graph subgraph URL. If absent, all subgraph-dependent features are disabled. */
export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

/** True when a subgraph URL is configured; use to gate subgraph-dependent code paths. */
export const SUBGRAPH_ENABLED = !!SUBGRAPH_URL;

