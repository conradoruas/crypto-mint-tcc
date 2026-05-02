# 4. Security Analysis

---

## 4.1 Reentrancy

### Risk

Multiple functions send ETH to external addresses via `payable(x).call{value: ...}`. A malicious contract at the recipient address could re-enter the marketplace before state is finalized.

### Mitigations

**`ReentrancyGuard`** is applied to all state-mutating ETH-sending functions: `mint`, `withdraw` (collection), `buyItem`, `makeOffer`, `acceptOffer`, `cancelOffer`, `reclaimExpiredOffer`, `pruneExpiredOffers`, `withdrawPending`, `withdraw` (marketplace).

**Checks-Effects-Interactions (CEI)** pattern is applied throughout. State changes always precede external calls:

```solidity
// buyItem — CEI
delete listings[nftContract][tokenId];           // Effect: clear listing
// ... fee calculation (view only) ...
accumulatedFees += marketFee;                    // Effect: update fee accounting
_paySeller(listing.seller, sellerProceeds);      // Interaction 1
_payRoyalty(royaltyReceiver, royaltyFee);        // Interaction 2
if (ghostRefund > 0) { ... refund buyer ... }    // Interaction 3
IERC721(nftContract).safeTransferFrom(...);      // Interaction 4 — NFT last
```

**Test validation:** Two attacker contracts (`ReentrancyAttacker`, `ReentrancyCancelAttacker`) are included in the test suite. Both attempt to re-enter from their `receive()` function and are verified to fail:

- `ReentrancyAttacker`: re-enters `buyItem` during seller payment — blocked by `nonReentrant`.
- `ReentrancyCancelAttacker`: re-enters `cancelOffer` during refund — the offer is already deleted at that point, so the re-entrant call reverts with `OfferNotActive`.

**Slither annotations:** `_paySeller`, `_payRoyalty`, and expired-offer refund paths are marked `// slither-disable-next-line reentrancy-benign`. These are false positives: the relevant state (listing, offer) is already deleted before the call, so a re-entrant invocation finds no active state to exploit.

---

## 4.2 Integer Overflows / Underflows

Solidity `^0.8.20` has checked arithmetic by default. Every arithmetic operation reverts on overflow/underflow unless explicitly wrapped in `unchecked`.

Intentional `unchecked` blocks are limited and justified:

| Location | Expression | Justification |
|----------|-----------|---------------|
| `buyItem` / `acceptOffer` | `accumulatedFees += marketFee` | `marketFee` is derived from `uint128`-bounded input; both values are bounded well below `uint256.max` |
| `getCollections`, `getOfferBuyersPaginated` | Array slice arithmetic | Bounds checks (`if (offset >= total)`) precede all arithmetic |

---

## 4.3 Access Control

| Function | Guard | Notes |
|----------|-------|-------|
| `loadTokenURIs`, `appendTokenURIs` | `onlyOwner` | Only before first mint (`totalSupply == 0`) |
| `commitMintSeed`, `revealMintSeed` | `onlyOwner` | Can only be called once each |
| `withdraw()` (collection) | `onlyOwner`, `nonReentrant` | Transfers entire contract balance to owner |
| `cancelListing` | seller OR marketplace `owner()` | Admin override enables moderation |
| `updateListingPrice` | listing seller only | Verified against stored `listing.seller` |
| `acceptOffer` | current `ownerOf(tokenId)` | Checked on-chain at call time, not at list time |
| `setMarketplaceFee` | `onlyOwner` | Hard-capped at 1000 bps |
| `withdraw()` (marketplace) | `onlyOwner`, `nonReentrant` | Only withdraws `accumulatedFees`, not escrow |

**Critical trust assumption:** The marketplace `owner` can cancel any listing but **cannot access escrowed offer ETH**. `withdraw()` transfers only `accumulatedFees` — a separately tracked ledger variable — not `address(this).balance`. This invariant is tested in `test_withdraw_doesNotDrainEscrow`.

---

## 4.4 Front-Running / MEV Risks

### Listing Price Updates

A naive cancel-then-relist flow for price changes creates a two-transaction gap. During that gap, a front-runner monitoring the mempool could buy at the old price between the cancel and the relist. `updateListingPrice` was added specifically to perform an atomic price update in a single transaction, closing this window.

### Mint URI Assignment

`blockhash(block.number - 1)` is finalized and unknown to users until their transaction is included. However, a PoS block proposer who also wants to mint can observe the pending transaction in the mempool and selectively include it in a block where `blockhash` yields a favorable URI index. This is a known, accepted limitation of commit-reveal on PoS Ethereum.

### Offer Race Condition

When a seller calls `acceptOffer`, the buyer could simultaneously call `cancelOffer`. Since `cancelOffer` deletes the offer slot before issuing the refund, and `acceptOffer` checks `offer.active`, whichever transaction is included first wins. This is the correct behaviour given EVM sequential execution — it is not a vulnerability.

---

## 4.5 Denial of Service

### Gas Bomb in `royaltyInfo`

A malicious NFT collection could implement `royaltyInfo` to consume unbounded gas or return large calldata. Both vectors are blocked by the assembly implementation in `_calculateFees`:

```solidity
// 1. Gas ceiling: at most 30k gas forwarded to the external call
// 2. Return-bomb prevention: only the first 64 bytes of returndata are copied
assembly {
    let ptr := mload(0x40)
    ok := staticcall(ROYALTY_INFO_GAS, nftContract, add(payload, 0x20), mload(payload), ptr, 0x40)
    if and(ok, gt(returndatasize(), 0x3f)) {
        receiver := mload(ptr)
        amount   := mload(add(ptr, 0x20))
    }
}
```

If `royaltyInfo` reverts or returns malformed data, `royaltyFee` defaults to zero and the sale proceeds without royalty payment. The seller still receives their full proceeds minus the marketplace fee.

### Unbounded `_offerBuyers` Array

A token with many active offers could cause `getOfferBuyers` and `pruneExpiredOffers` to approach block gas limits. Mitigations:

- `pruneExpiredOffers` accepts a `maxIterations` parameter (`0 = unbounded`). Callers should pass a safe value for crowded tokens.
- `getOfferBuyersPaginated(start, count)` provides a paginated view.
- The swap-and-pop pattern keeps the array compact as offers are removed.
- Each offer requires a minimum of `0.0001 ETH` of real locked capital, making large-scale array inflation costly.

### Unbounded `getAllCollections()` (Factory)

Returns the full `_collections` array in a single call. The NatDoc warns: "Unbounded — only safe while the registry is small. Prefer `getCollections(offset, limit)` for production use." The subgraph should be the primary browse source at scale.

### Rejecting ETH Receiver (Griefing)

Any seller, royalty receiver, or offer-maker could be a contract that reverts on `receive()`. The pull-payment fallback (`pendingWithdrawals`) ensures one rejecting party never bricks a transaction for others. One bad buyer in `pruneExpiredOffers` gets credited via the pull-payment ledger and does not break the rest of the batch:

```solidity
(bool r, ) = payable(buyer).call{value: refund}("");
if (!r) {
    pendingWithdrawals[buyer] += refund;
    pendingDelta += refund;
}
// loop continues to next buyer
```

---

## 4.6 Ghost Offers

When a buyer purchases an NFT via `buyItem`, they now own the token — but any active offer they previously made on that same token would remain escrowed, locking their ETH permanently. `buyItem` detects this scenario and clears the offer atomically:

```solidity
Offer memory buyerOffer = offers[nftContract][tokenId][msg.sender];
if (buyerOffer.active) {
    ghostRefund = buyerOffer.amount;
    delete offers[nftContract][tokenId][msg.sender];
    _removeOfferBuyer(nftContract, tokenId, msg.sender);
}
// ... complete purchase ...
// refund ghost ETH after sale completes
```

---

## 4.7 Known Limitations and Accepted Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|-----------|---------|
| PoS block proposer biases URI assignment | Low | Commit-reveal + blockhash | Accepted — testnet scope |
| `blockhash` returns `bytes32(0)` on same-block inclusion | Low | Revert `BlockhashUnavailable`; user retries | Rare on public networks |
| `getAllCollections()` DoS at scale | Medium | `getCollections(offset, limit)` available | Caller discipline required |
| Marketplace fee change between list and buy | Low | Fee capped at 10%; change is auditable on-chain | No per-listing fee lock |
| `contractURIStorage` immutable post-deploy | Medium | New collection required to change schema | Accepted — prevents metadata manipulation |
| No batch minting | UX | Out of scope for V2 | Future enhancement |
