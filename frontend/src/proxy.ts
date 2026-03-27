import { NextRequest, NextResponse } from "next/server";

// ─── Rate limit config ────────────────────────────────────────────────────────
// Requests allowed per IP per WINDOW_MS for each proxy prefix
const WINDOW_MS = 60_000; // 1 minute

const LIMITS: [prefix: string, max: number][] = [
  ["/api/alchemy", 60],
  ["/api/rpc", 120],
];

// In-memory sliding-window store: key → array of timestamps
// Shared within a single serverless instance; resets on cold start.
const store = new Map<string, number[]>();

function isRateLimited(ip: string, pathname: string): boolean {
  const entry = LIMITS.find(([prefix]) => pathname.startsWith(prefix));
  if (!entry) return false;
  const [prefix, max] = entry;

  const key = `${ip}||${prefix}`;
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= max) return true;

  hits.push(now);
  store.set(key, hits);
  return false;
}

// ─── Origin check ─────────────────────────────────────────────────────────────
// Rejects cross-origin browser requests.  Server-side calls (no Origin header)
// are allowed — Next.js server components / unstable_cache use them internally.

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-side or same-origin browser request

  const host = req.headers.get("host") ?? "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip, req.nextUrl.pathname)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/alchemy/:path*", "/api/rpc"],
};
