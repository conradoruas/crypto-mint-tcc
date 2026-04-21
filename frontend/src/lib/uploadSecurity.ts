import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyMessage, type Address } from "viem";
import { buildUploadAuthMessage } from "@/lib/uploadAuthMessage";

/** Max body size for JSON profile uploads (bytes). */
export const MAX_JSON_UPLOAD_BYTES = 256 * 1024;

/** Max image / multipart file part size (bytes). */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Max total multipart body (file + fields) for /api/upload. */
export const MAX_UPLOAD_COMBINED_BYTES = 11 * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Signature must be at most this many seconds old (either direction). */
const AUTH_MAX_SKEW_SEC = 300;

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT_IP_UPLOADS = 120;
const LIMIT_ADDRESS_UPLOADS = 80;

type Bucket = { count: number; windowStart: number };

const ipBuckets = new Map<string, Bucket>();
const addrBuckets = new Map<string, Bucket>();

function pruneOld(map: Map<string, Bucket>, now: number) {
  for (const [k, v] of map) {
    if (now - v.windowStart > WINDOW_MS) map.delete(k);
  }
}

function takeSlot(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
): boolean {
  const now = Date.now();
  pruneOld(map, now);
  const cur = map.get(key);
  if (!cur || now - cur.windowStart > WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitByIp(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  if (!takeSlot(ipBuckets, `ip:${ip}`, LIMIT_IP_UPLOADS)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
  return null;
}

export function rateLimitByAddress(address: string): NextResponse | null {
  const key = address.toLowerCase();
  if (!takeSlot(addrBuckets, `addr:${key}`, LIMIT_ADDRESS_UPLOADS)) {
    return NextResponse.json(
      { error: "Upload limit reached for this wallet. Try again later." },
      { status: 429 },
    );
  }
  return null;
}

export function assertContentLength(
  req: NextRequest,
  maxBytes: number,
): NextResponse | null {
  const raw = req.headers.get("content-length");
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (n > maxBytes) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 },
    );
  }
  return null;
}

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mime.toLowerCase());
}

export function validateImageFile(file: File): NextResponse | null {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image file too large." },
      { status: 413 },
    );
  }
  if (!isAllowedImageMime(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
      { status: 400 },
    );
  }
  return null;
}

/**
 * IP rate limit → body size → wallet signature → per-wallet rate limit.
 * Returns the verified signer address or an error response.
 */
export async function runUploadGate(
  req: NextRequest,
  pathname: string,
  maxBodyBytes: number,
): Promise<{ address: Address } | NextResponse> {
  const ipLimited = rateLimitByIp(req);
  if (ipLimited) return ipLimited;

  const tooLarge = assertContentLength(req, maxBodyBytes);
  if (tooLarge) return tooLarge;

  const auth = await verifyUploadAuth(req, pathname);
  if (auth instanceof NextResponse) return auth;

  const addrLimited = rateLimitByAddress(auth.address);
  if (addrLimited) return addrLimited;

  return auth;
}

/** For tests only — resets rate-limit buckets between test cases. */
export function _resetBucketsForTests() {
  ipBuckets.clear();
  addrBuckets.clear();
}

export async function verifyUploadAuth(
  req: NextRequest,
  pathname: string,
): Promise<{ address: Address } | NextResponse> {
  const address = req.headers.get("x-cryptomint-address");
  const ts = req.headers.get("x-cryptomint-timestamp");
  const sig = req.headers.get("x-cryptomint-signature");

  if (!address || !ts || !sig) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Sign the upload challenge in your wallet.",
      },
      { status: 401 },
    );
  }

  let tsNum: number;
  try {
    tsNum = parseInt(ts, 10);
    if (Number.isNaN(tsNum) || tsNum <= 0) throw new Error("bad ts");
  } catch {
    return NextResponse.json(
      { error: "Invalid authentication." },
      { status: 401 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > AUTH_MAX_SKEW_SEC) {
    return NextResponse.json(
      { error: "Signature expired. Refresh and try again." },
      { status: 401 },
    );
  }

  const message = buildUploadAuthMessage(pathname, tsNum);

  let ok: boolean;
  try {
    ok = await verifyMessage({
      address: address as Address,
      message,
      signature: sig as `0x${string}`,
    });
  } catch {
    ok = false;
  }

  if (!ok) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  return { address: address as Address };
}
