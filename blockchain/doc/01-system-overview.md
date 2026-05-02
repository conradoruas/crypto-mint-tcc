# 1. System Overview

## 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│   Apollo Client → SubgraphProxy → The Graph (Sepolia subgraph)  │
│                         ↕ RPC fallback                          │
└──────────────┬──────────────────────────────────┬──────────────┘
               │  write / read                    │ read
               ▼                                  ▼
┌──────────────────────┐            ┌──────────────────────────┐
│ NFTCollectionFactory │            │     NFTMarketplace       │
│ NFTCollectionFactory │            │  (generic ERC-721 market)│
│        V2            │            └──────────┬───────────────┘
└────────┬─────────────┘                       │ safeTransferFrom
         │ deploys                              ▼
         ▼                         ┌──────────────────────────┐
┌──────────────────────┐           │  NFTCollection /         │
│  NFTCollection       │◄──────────│  NFTCollectionV2         │
│  NFTCollectionV2     │           │  (ERC-721 + ERC-2981)    │
│  (per collection)    │           └──────────────────────────┘
└──────────────────────┘
         │ emits events
         ▼
┌──────────────────────────────────────────────────────────────┐
│        The Graph Subgraph (Sepolia) — event indexer          │
│  CollectionCreated / NFTMinted / ItemListed / ItemSold       │
│  OfferMade / OfferAccepted / RoyaltyPaid / ...               │
└──────────────────────────────────────────────────────────────┘
```

## 1.2 Contract Interaction Map

| Caller | Contract | Action |
|--------|----------|--------|
| User | `NFTCollectionFactoryV2` | `createCollection()` → deploys `NFTCollectionV2` |
| Creator | `NFTCollectionV2` | `loadTokenURIs()`, `commitMintSeed()`, `withdraw()` |
| Minter | `NFTCollectionV2` | `mint(to)` |
| Seller | `NFTMarketplace` | `listItem()`, `cancelListing()`, `acceptOffer()` |
| Buyer | `NFTMarketplace` | `buyItem()`, `makeOffer()`, `cancelOffer()` |
| Anyone | `NFTMarketplace` | `reclaimExpiredOffer()`, `pruneExpiredOffers()` |
| Admin | `NFTMarketplace` | `setMarketplaceFee()`, `withdraw()` |

## 1.3 Subgraph-First Design Philosophy

The system is intentionally **subgraph-first**: all state the frontend needs (collections, listings, offers, royalties, sales history) is derived from on-chain events rather than RPC `eth_call` polling. Every write function emits at least one indexed event with sufficient data for the subgraph to reconstruct full application state without secondary calls.

The frontend routes GraphQL queries through a `SubgraphProxy` that implements a **429 circuit-breaker** with in-memory cache, degrading gracefully to direct RPC reads when The Graph rate-limits the indexer. This is a resilience pattern, not a data-source switch — the subgraph remains the source of truth.

## 1.4 Contract Versioning

Two parallel generations of collection contracts are deployed:

| Contract | Factory | Key Difference |
|----------|---------|---------------|
| `NFTCollection` | `NFTCollectionFactory` | No `contractURI`; no trait schema |
| `NFTCollectionV2` | `NFTCollectionFactoryV2` | Adds `contractURI()` → IPFS JSON with `trait_schema` |

`NFTMarketplace` is version-agnostic: it accepts any ERC-721/ERC-165-compliant token, including both V1 and V2 collections.
