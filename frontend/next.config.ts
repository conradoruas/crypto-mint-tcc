import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

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
      // 'unsafe-inline' kept only for style-src (required by Next.js style injection).
      // script-src uses 'strict-dynamic' with 'unsafe-inline' as a fallback for
      // browsers that don't support strict-dynamic (the fallback is ignored when
      // strict-dynamic is supported). 'unsafe-eval' has been removed.
      // React dev mode uses eval() for stack-trace reconstruction; only
      // enable 'unsafe-eval' in development.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://ipfs.io https://*.ipfs.dweb.link https://nft-cdn.alchemy.com https://cloudflare-ipfs.com https://nftstorage.link",
      "connect-src 'self' https://*.alchemy.com wss://*.walletconnect.com https://api.pinata.cloud https://ipfs.io https://*.ipfs.dweb.link https://cloudflare-ipfs.com https://nftstorage.link https://relay.walletconnect.com https://explorer-api.walletconnect.com https://api.studio.thegraph.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
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
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "*.ipfs.dweb.link",
      },
      {
        protocol: "https",
        hostname: "nft-cdn.alchemy.com",
      },
      {
        protocol: "https",
        hostname: "cloudflare-ipfs.com",
      },
      {
        protocol: "https",
        hostname: "nftstorage.link",
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

