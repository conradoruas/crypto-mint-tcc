# ───────────────────────────────────────────────────────────────
# CryptoMint Frontend — Multi-stage Docker build
# Produces a ~180 MB image using Next.js standalone output
# ───────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build the application ────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (NEXT_PUBLIC_* are inlined at build time)
# These MUST be provided via --build-arg or docker-compose args
ARG NEXT_PUBLIC_MARKETPLACE_ADDRESS
ARG NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ARG NEXT_PUBLIC_SUBGRAPH_URL=""
ARG NEXT_PUBLIC_FAVORITES_ADDRESS=""

ENV NEXT_PUBLIC_MARKETPLACE_ADDRESS=$NEXT_PUBLIC_MARKETPLACE_ADDRESS
ENV NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS=$NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_SUBGRAPH_URL=$NEXT_PUBLIC_SUBGRAPH_URL
ENV NEXT_PUBLIC_FAVORITES_ADDRESS=$NEXT_PUBLIC_FAVORITES_ADDRESS

# next build needs at least dummy values for server-only vars
# so the build does not crash. Real values are injected at runtime.
ENV ALCHEMY_API_KEY="build-placeholder"
ENV PINATA_JWT="build-placeholder"

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output + static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Runtime env vars (server-only secrets injected here)
# ALCHEMY_API_KEY and PINATA_JWT must be passed via:
#   docker run -e ALCHEMY_API_KEY=... -e PINATA_JWT=...
#   or via docker-compose environment/env_file

CMD ["node", "server.js"]
