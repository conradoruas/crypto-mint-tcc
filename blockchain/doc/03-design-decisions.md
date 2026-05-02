# 3. Design Decisions

---

## 3.1 ERC-721 over ERC-1155

ERC-721 was chosen for uniqueness semantics: every token is a distinct asset with its own URI and owner. ERC-1155 would enable fungible editions but adds complexity (balance-based ownership, multi-token transfers, approval semantics) that does not fit the "one NFT, one URI, one owner" model.

The sequential `tokenId` counter simplifies URI assignment: the Fisher-Yates index draw operates over a pool of size `remaining`, and `tokenId` increments predictably, making on-chain bookkeeping straightforward.

---

## 3.2 ERC-2981 for Royalties

ERC-2981 is the dominant on-chain royalty standard, supported by OpenSea, Blur, and all major aggregators. The default royalty is 5% (`500` basis points) payable to the collection creator, set via `_setDefaultRoyalty(_creator, 500)` in the constructor.

The marketplace hard-caps royalties at **10% (`MAX_ROYALTY_BPS = 1000`)** to protect sellers from collections that return inflated or adversarial `royaltyInfo` values:

```solidity
uint256 maxRoyalty = (salePrice * MAX_ROYALTY_BPS) / 10000;
if (amount > maxRoyalty) amount = maxRoyalty;
```

---

## 3.3 Custom Traits via `contractURI` (V2)

Per-collection traits are **not stored on-chain**. Storing trait names and values as string arrays would cost thousands of `SSTORE` operations per collection — prohibitively expensive and immutable once set.

Instead, `NFTCollectionV2` exposes a `contractURI()` function returning an IPFS URI to a JSON blob that conforms to the OpenSea `contractURI` standard and extends it with a `trait_schema` field:

```json
{
  "name": "Sky Mages",
  "description": "...",
  "image": "ipfs://...",
  "trait_schema": [
    { "name": "Element", "type": "string", "values": ["Fire", "Water", "Earth"] },
    { "name": "Rarity",  "type": "string", "values": ["Common", "Rare", "Legendary"] },
    { "name": "Power",   "type": "number", "min": 1, "max": 100 }
  ]
}
```

The `CollectionCreated` event (V2) includes the `contractURI` string. The subgraph ingests this event, resolves the IPFS URI, and parses `trait_schema` to populate explore-page filter UI — without additional RPC calls to each collection.

Individual token traits are encoded in each token's own IPFS metadata JSON, not on-chain.

**Trade-off:** Traits are not queryable on-chain. Filtering by trait requires the subgraph or frontend to parse off-chain JSON. This is acceptable for a rarity/explore-page feature and avoids the gas and rigidity cost of on-chain storage.

**Immutability trade-off:** `contractURIStorage` has no setter — the trait schema is fixed at deploy time. If the creator needs to amend the schema, they must deploy a new collection. This was chosen deliberately to prevent post-deploy manipulation of rarity metadata.

---

## 3.4 No Upgradeable Contracts

None of the contracts use `TransparentUpgradeableProxy`, `UUPS`, or beacon patterns. This is intentional:

- **Auditability:** A non-upgradeable contract has no admin key that could silently change business logic after deployment.
- **User trust:** Buyers and sellers can be certain that listing rules, fee logic, and royalty handling cannot change mid-sale.
- **Simplicity:** No storage layout collision risks, no proxy admin management, no initializer complexity.

The V1 → V2 migration is handled by deploying new factory and collection contracts. Existing V1 collections continue operating under V1 rules indefinitely, and `NFTMarketplace` accepts both.

---

## 3.5 Non-Upgradeable Marketplace Fee

The marketplace fee is configurable by the owner (`setMarketplaceFee`) but is bounded by a hard-coded cap of 1000 bps (10%). A fee change takes effect only on future sales — existing listings are not retroactively affected because `listing.price` is stored at list time and the fee is calculated at purchase time from `marketplaceFee`.

Sellers implicitly accept the current fee at the moment of purchase. This is a known trade-off: a seller who listed at a 2.5% fee environment could be surprised by a fee increase before their token sells. A mitigation would be to store `feeAtListTime` in the `Listing` struct, at the cost of one additional storage slot.

---

## 3.6 Commit-Reveal for Mint Randomness

Pure on-chain entropy (`block.prevrandao`, `block.timestamp`) can be observed or biased by block proposers on PoS Ethereum. The commit-reveal scheme adds a second entropy source:

1. **Before sale:** Owner publishes `keccak256(secret)` — commits to a value without revealing it.
2. **During mint:** `blockhash(block.number - 1)` provides finalized, unpredictable entropy for that block.
3. **After sale:** Owner publishes `secret` so anyone can replay and verify every mint's URI assignment.

Together these prevent a regular user from pre-computing which URI they'll receive. A colluding block proposer could bias results by selectively including/excluding transactions — this residual risk is documented and accepted at testnet scope.

---

## 3.7 Indexing Strategy: Subgraph-First with RPC Fallback

All marketplace state (listings, offers, sales, royalties) is recoverable from events alone. The frontend queries The Graph subgraph for all read paths.

A `SubgraphProxy` wraps the Apollo client and implements:
1. **In-memory cache** with TTL to avoid redundant queries.
2. **429 circuit-breaker:** If the subgraph returns rate-limit errors, the proxy signals `isRateLimited = true` and marketplace hooks fall back to direct Ethereum RPC calls.

This design means the subgraph is the primary read source but is never a single point of failure.

---

## 3.8 Pull-Payment Fallback

Any ETH push (`payable(x).call{value: ...}`) can fail if the recipient is a contract that reverts on `receive()`. Rather than reverting the entire transaction when a single recipient rejects ETH, the marketplace credits the amount to `pendingWithdrawals[recipient]`. The recipient then calls `withdrawPending()` to claim.

This pattern appears in three places:
- `_paySeller` — seller payment on buy/acceptOffer
- `_payRoyalty` — royalty payment on every sale
- Expired offer refunds in `cancelOffer`, `reclaimExpiredOffer`, `pruneExpiredOffers`, and `makeOffer` (auto-refund)

A rejecting royalty receiver does **not** have their royalty returned to the seller — that would enable malicious sellers to deploy rejecting receiver contracts to evade royalties.
