# 10. Limitations & Future Improvements

---

## 10.1 Known Technical Limitations

### Randomness

| Issue | Detail |
|-------|--------|
| PoS block proposer bias | A colluding block proposer can observe the mint transaction in the mempool and selectively include it in a block where `blockhash(block.number - 1)` yields a favourable URI index. The commit-reveal scheme prevents user-side pre-computation but does not fully remove proposer influence. |
| `blockhash` unavailability | `mint()` reverts with `BlockhashUnavailable` if `blockhash(block.number - 1)` returns `bytes32(0)`. This is extremely rare on public Ethereum but can occur in local test environments without `--block-time`. |

### Collection Contract

| Issue | Detail |
|-------|--------|
| Immutable `contractURIStorage` | The trait schema encoded in `contractURI` cannot be amended post-deploy. Errors in the schema require deploying a new collection. |
| No batch minting | Each mint is a separate transaction. A 10,000-supply collection requires 10,000 user transactions. |
| URI pool load cost | Loading all URIs requires N `SSTORE` operations (one per URI string). For large collections (> 1,000 tokens) this must be batched across multiple `loadTokenURIs` / `appendTokenURIs` calls to stay under block gas limits. |
| No royalty mutability | ERC-2981 `_setDefaultRoyalty` is called once in the constructor. The creator cannot update the royalty after deployment without a new collection. |

### Marketplace

| Issue | Detail |
|-------|--------|
| Fee applies at purchase time | The `marketplaceFee` used in a sale is read at the moment of purchase, not at listing time. A seller who listed expecting 2.5% could experience a fee increase before their token sells. |
| No auction mechanism | Only fixed-price listings and open offers are supported. Dutch auctions, English auctions, and timed bids are not implemented. |
| `getAllCollections()` is unbounded | Will become unusable as the factory registry grows. Pagination via `getCollections(offset, limit)` is available but not enforced. |
| `_offerBuyers` array growth | Very popular tokens could accumulate a large `_offerBuyers` array over time. `pruneExpiredOffers(maxIterations)` mitigates this but requires off-chain keepers or bounty-motivated callers. |
| No ERC-1155 support | `listItem` and `makeOffer` both require `supportsInterface(IERC721)`. ERC-1155 tokens cannot be listed. |

### Infrastructure

| Issue | Detail |
|-------|--------|
| Single subgraph dependency | The frontend falls back to RPC on 429 errors, but complex queries (multi-token filters, trait search) are not available via RPC fallback. |
| Subgraph lag | The Graph subgraph can be up to a few blocks behind the chain. UI state may briefly show stale data after a transaction. |

---

## 10.2 Scalability Concerns

**Factory Registry**  
The `_collections` array in both factories is append-only and never pruned. At 100 collections/day it grows by ~3,000 entries/month. `getAllCollections()` becomes unusable; `getCollections(offset, limit)` handles this but the subgraph should own browsing at scale.

**Offer Arrays per Token**  
Popular tokens (high floor, active speculation) could have dozens of concurrent offers. Each offer escrows at least `0.0001 ETH`, making spam expensive but not impossible. The `_offerBuyers` array grows until offers expire and are pruned. At 100 concurrent offers, `pruneExpiredOffers(100)` costs roughly `100 × (1 SLOAD + 1 SSTORE + 1 external call)` ≈ 500k gas — within block limits but non-trivial.

**URI Storage**  
`_availableURIs` holds N string values in contract storage. A 10,000-token collection loading 100-character IPFS URIs uses roughly `10,000 × ceil(100/32) × 20,000 gas ≈ 63M gas` to load — requiring ~9 batches at the 7M gas limit. This is a one-time cost but imposes a real operational burden on collection creators.

---

## 10.3 Suggestions for Future Enhancements

### Chainlink VRF for Mint Randomness

Replace the `blockhash + commit-reveal` scheme with Chainlink VRF v2.5. This provides verifiably random outputs that a block proposer cannot bias.

```
mint() request → emit VRF request → Chainlink fulfillRandomness(requestId, randomWord)
              → post-assignment: tokenId linked to chosenUri
```

**Trade-off:** Two-transaction mint flow; LINK cost per mint; added oracle dependency.

---

### ERC-721A for Gas-Efficient Batch Minting

Adopt Azuki's ERC-721A implementation which amortizes `SSTORE` operations across batch mints. Minting 10 tokens costs approximately the same as minting 1 token in standard ERC-721.

**Trade-off:** More complex ownership storage; sequential `tokenId` assignment without gaps; different internal accounting.

---

### Upgradeable Marketplace (UUPS)

Introduce a UUPS proxy for `NFTMarketplace` to allow:
- Fee changes without re-deployment
- New sale types (Dutch auction, English auction)
- Bug fixes post-deployment

**Trade-off:** Requires a trusted upgrade key (admin multisig); introduces storage layout constraints; reduces immutability guarantees for users.

---

### Mutable `contractURI`

Add a setter behind `onlyOwner`:

```solidity
function setContractURI(string calldata newURI) external onlyOwner {
    contractURIStorage = newURI;
    emit ContractURIUpdated(newURI);
}
```

The emitted event enables the subgraph to re-index the trait schema. This removes the "redeploy to fix schema" limitation at the cost of mutability in the trait definition.

---

### Per-Offer Duration

Allow buyers to specify a custom validity window:

```solidity
function makeOffer(address nftContract, uint256 tokenId, uint256 duration)
    external payable nonReentrant
{
    require(duration >= 1 days && duration <= 30 days, "Invalid duration");
    uint256 expiresAt = block.timestamp + duration;
    // ...
}
```

---

### Auction Mechanism

Add a `createAuction` function supporting English (ascending bid) or Dutch (descending price) auctions. Key additions:

- `Auction` struct: `startPrice`, `endPrice`, `startTime`, `endTime`, `highestBidder`, `highestBid`
- `bid()` function escrows ETH and refunds previous highest bidder
- `settleAuction()` transfers NFT to winner and distributes funds

---

### Per-Listing Fee Lock

Store `feeAtListTime` in the `Listing` struct to protect sellers from fee increases between list and sale:

```solidity
struct Listing {
    address seller;
    bool    active;
    uint16  feeAtListTime; // +2 bytes — still fits in slot 1 with padding
    uint128 price;
}
```

This costs one additional `SSTORE` per listing but provides stronger seller guarantees.

---

### Decentralised Subgraph Allocation

Move from a hosted service endpoint to a decentralised Graph Network allocation. This eliminates the rate-limit risk entirely and removes the need for the circuit-breaker fallback architecture, at the cost of query fees (GRT).

---

### On-Chain Trait Storage (Optional)

For collections with simple, bounded traits (e.g., 3–5 enum-valued properties), consider packing traits into a `mapping(uint256 => bytes32)` at mint time:

```solidity
// Pack up to 8 uint32 trait values into one bytes32
mapping(uint256 => bytes32) private _packedTraits;
```

This enables on-chain rarity queries and smart contract composability (e.g., game contracts reading traits) at the cost of higher mint gas (one additional `SSTORE` per token).
