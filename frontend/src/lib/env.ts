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

/** Alchemy API key — used by the /api/alchemy proxy and server-side metadata fetching. */
export const ALCHEMY_API_KEY = required("ALCHEMY_API_KEY");

/** Pinata JWT — used by the /api/upload* routes to pin files to IPFS. */
export const PINATA_JWT = required("PINATA_JWT");
