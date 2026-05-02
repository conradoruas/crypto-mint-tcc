# 7. Events & Indexing

---

## 7.1 All Emitted Events

### `NFTCollectionFactory`

| Event | Signature | Indexed | Purpose |
|-------|-----------|---------|---------|
| `CollectionCreated` | `(address creator, address contractAddress, string name, uint256 collectionId)` | creator, contractAddress, collectionId | Subgraph entity creation for collection registry |

### `NFTCollectionFactoryV2`

| Event | Signature | Indexed | Purpose |
|-------|-----------|---------|---------|
| `CollectionCreated` | `(address creator, address contractAddress, string name, uint256 collectionId, string contractURI)` | creator, contractAddress, collectionId | V2 variant — includes `contractURI` for trait schema discovery by indexers |

### `NFTCollection` / `NFTCollectionV2`

| Event | Signature | Indexed | Purpose |
|-------|-----------|---------|---------|
| `NFTMinted` | `(address to, uint256 tokenId, string tokenUri)` | to, tokenId | Creates Token entity with initial owner and URI |
| `MintSeedCommitted` | `(bytes32 commitment)` | — | Marks collection as ready-to-mint; auditing record |
| `MintSeedRevealed` | `(bytes32 seed)` | — | Enables post-sale randomness audit |
| `Revealed` | `()` | — | Signals all supply minted; last URI consumed |
| `Withdrawn` | `(address owner, uint256 amount)` | owner | Creator revenue tracking |

### `NFTMarketplace`

| Event | Signature | Indexed | Purpose |
|-------|-----------|---------|---------|
| `ItemListed` | `(address nftContract, uint256 tokenId, address seller, uint256 price)` | nftContract, tokenId, seller | Creates Listing entity |
| `ListingPriceUpdated` | `(address nftContract, uint256 tokenId, address seller, uint256 oldPrice, uint256 newPrice)` | nftContract, tokenId, seller | Updates Listing entity price |
| `ItemSold` | `(address nftContract, uint256 tokenId, address seller, address buyer, uint256 price)` | nftContract, tokenId | Closes Listing; creates Sale entity; updates Token owner |
| `ListingCancelled` | `(address nftContract, uint256 tokenId, address seller)` | nftContract, tokenId, seller | Closes Listing entity |
| `OfferMade` | `(address nftContract, uint256 tokenId, address buyer, uint256 amount, uint256 expiresAt)` | nftContract, tokenId, buyer | Creates Offer entity with escrow amount |
| `OfferAccepted` | `(address nftContract, uint256 tokenId, address seller, address buyer, uint256 amount)` | nftContract, tokenId | Closes Offer; creates Sale entity; updates Token owner |
| `OfferCancelled` | `(address nftContract, uint256 tokenId, address buyer)` | nftContract, tokenId, buyer | Closes Offer entity (cancelled) |
| `OfferExpiredRefund` | `(address nftContract, uint256 tokenId, address buyer, uint256 amount)` | nftContract, tokenId, buyer | Closes Offer entity (expired + refunded) |
| `ReclaimBountyPaid` | `(address caller, address buyer, uint256 amount)` | caller, buyer | Bounty payment record |
| `ExpiredOffersPruned` | `(address nftContract, uint256 tokenId, uint256 prunedCount)` | nftContract, tokenId | Batch cleanup telemetry |
| `RoyaltyPaid` | `(address receiver, uint256 amount)` | receiver | On-chain royalty payment confirmation |
| `RoyaltyPending` | `(address receiver, uint256 amount)` | receiver | Pull-payment credit (push failed) |
| `PendingWithdrawn` | `(address receiver, uint256 amount)` | receiver | Pull-payment claim |
| `MarketplaceFeeUpdated` | `(uint256 oldFee, uint256 newFee)` | — | Admin config change audit |
| `FeesWithdrawn` | `(address owner, uint256 amount)` | owner | Platform revenue withdrawal tracking |

---

## 7.2 Subgraph Entity Mapping

The Graph subgraph maps events to entities. The table below shows which events drive each entity's lifecycle:

| Entity | Created by | Updated by | Closed / Removed by |
|--------|-----------|------------|---------------------|
| **Collection** | `CollectionCreated` | — | — (append-only) |
| **Token** | `NFTMinted` | `ItemSold`, `OfferAccepted` (owner update via `Transfer`) | — |
| **Listing** | `ItemListed` | `ListingPriceUpdated` | `ItemSold`, `ListingCancelled` |
| **Offer** | `OfferMade` | — | `OfferAccepted`, `OfferCancelled`, `OfferExpiredRefund` |
| **Sale** | `ItemSold` / `OfferAccepted` | — | — (immutable history) |
| **RoyaltyPayment** | `RoyaltyPaid` / `RoyaltyPending` | `PendingWithdrawn` | — |

### Trait Schema Resolution (V2)

When `CollectionCreated` is indexed for a V2 factory collection:

1. Subgraph reads `contractURI` from the event.
2. Subgraph resolves the IPFS URI to fetch the JSON blob.
3. The `trait_schema` array is parsed and stored per-collection.
4. Individual token traits are read from each token's metadata URI (from `NFTMinted.tokenUri`).

This allows the frontend to render dynamic filter UI for each collection's trait dimensions without on-chain queries.

---

## 7.3 Subgraph Rate Limits and Fallback Strategy

### Circuit-Breaker Architecture

The frontend's `SubgraphProxy` wraps Apollo Client with:

```
Request
   │
   ▼
┌─────────────────────────────────────────────┐
│               SubgraphProxy                 │
│  ┌──────────────────────────────────────┐   │
│  │  In-memory cache (TTL per query type)│   │
│  └──────────────────────────────────────┘   │
│            │ cache miss                     │
│            ▼                               │
│  ┌──────────────────────────────────────┐   │
│  │  The Graph subgraph (primary)        │   │
│  │  → 429 response?                     │   │
│  │    set isRateLimited = true          │   │
│  └──────────────────────────────────────┘   │
│            │ rate-limited                   │
│            ▼                               │
│  ┌──────────────────────────────────────┐   │
│  │  Direct RPC fallback                 │   │
│  │  (ethers.js / viem eth_call)         │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Impact on Data Availability

| Scenario | Effect |
|----------|--------|
| Subgraph healthy | All reads from indexed data; rich queries (filters, sorting, pagination) |
| Subgraph rate-limited | Falls back to direct RPC; limited to per-token/per-listing reads via `getListing`, `getOffer` |
| Subgraph lagging (not rate-limited) | Data may be stale by a few blocks; no fallback triggered |
| Subgraph recovers | Circuit-breaker resets; full indexing resumes; no data lost (events are on-chain permanently) |

Write operations (`listItem`, `buyItem`, `makeOffer`, `acceptOffer`) are always sent directly to the chain and never depend on subgraph availability.

---

## 7.4 Event Completeness Guarantee

Every state transition in the system emits at least one event with the complete data needed to reconstruct state:

- **No state is stored only on-chain without a corresponding event.** `listings`, `offers`, `pendingWithdrawals`, and `accumulatedFees` all have counterpart events.
- **Events are emitted before external calls** (following CEI), ensuring the subgraph sees the state change even if the external call reverts in an edge case.
- **The only partial exception** is `pendingWithdrawals` — credits are logged via `RoyaltyPending`/`OfferExpiredRefund` and debits via `PendingWithdrawn`, allowing the subgraph to reconstruct the ledger balance per address.
