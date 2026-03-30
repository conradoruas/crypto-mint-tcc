/**
 * Next.js Middleware — runs on the Edge before every matched request.
 *
 * Applies rate limiting and origin checks to API proxy routes.
 * See `src/proxy.ts` for the underlying logic.
 */
import { proxy } from "@/proxy";

export { proxy as middleware };

export const config = {
  matcher: ["/api/alchemy/:path*", "/api/rpc"],
};
