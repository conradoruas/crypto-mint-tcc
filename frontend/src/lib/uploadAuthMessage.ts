/**
 * Canonical message for EIP-191 `personal_sign` on upload requests.
 * Must match exactly on client (sign) and server (verify).
 */
/** Paths must match `req.nextUrl.pathname` when verifying on the server. */
export const UPLOAD_API_PATHS = {
  image: "/api/upload-image",
  profile: "/api/upload-profile",
  combined: "/api/upload",
} as const;

export function buildUploadAuthMessage(
  pathname: string,
  timestampSec: number,
): string {
  return `CryptoMint IPFS Upload\nPath: ${pathname}\nTimestamp: ${timestampSec}`;
}
