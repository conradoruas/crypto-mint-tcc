import type { NextConfig } from "next";
import {
  getAllowedImageHosts,
  getAllowedIpfsGatewayHosts,
} from "./src/lib/resourceSecurity";

const isDev = process.env.NODE_ENV !== "production";
const allowedImageHosts = getAllowedImageHosts();
const allowedGatewayHosts = getAllowedIpfsGatewayHosts();

function toHttpsOrigins(hosts: string[]) {
  return hosts.map((host) => `https://${host}`);
}

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is required for Next.js style and inline script injection.
      // 'strict-dynamic' is NOT currently set — adding it would require per-request
      // nonces threaded through Next.js middleware, which is a future improvement.
      // 'unsafe-eval' is only enabled in dev for React stack-trace reconstruction.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob: ${toHttpsOrigins(allowedImageHosts).join(" ")} https://*.ipfs.dweb.link`,
      `connect-src 'self' https://*.alchemy.com wss://*.walletconnect.com https://api.pinata.cloud ${toHttpsOrigins(allowedGatewayHosts).join(" ")} https://*.ipfs.dweb.link https://relay.walletconnect.com https://explorer-api.walletconnect.com https://api.studio.thegraph.com`,
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      ...allowedImageHosts.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
      {
        protocol: "https",
        hostname: "*.ipfs.dweb.link",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
