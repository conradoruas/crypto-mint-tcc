/**
 * Next.js Middleware — runs on the Edge before every matched request.
 *
 * Applies rate limiting and origin checks to API proxy routes.
 * See `src/proxy.ts` for the underlying logic.
 */
import { proxy } from "@/lib/apiProxy";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ["/api/alchemy/:path*", "/api/rpc"],
};
