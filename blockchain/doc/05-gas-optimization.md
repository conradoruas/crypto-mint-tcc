# 5. Gas Optimization

---

## 5.1 Packed Structs

`Listing` and `Offer` are tightly packed to minimize storage slot usage. Solidity packs adjacent values into a single 32-byte slot when their combined size allows it.

```
Listing — 2 slots total
  Slot 1: seller (20 B) + active (1 B) + [11 B padding]
  Slot 2: price  (16 B) + [16 B padding]

Offer — 2 slots total
  Slot 1: buyer (20 B) + active (1 B) + expiresAt (8 B) + [3 B padding]
  Slot 2: amount (16 B) + [16 B padding]
```

Without packing, a naively-ordered `Listing` (`address seller`, `bool active`, `uint256 price`) would occupy **3 slots** because `bool` between `address` and `uint256` forces a new slot. The current layout saves one `SSTORE`/`SLOAD` per listing operation, which at 20k/2.1k gas respectively is significant over many listings.

---

## 5.2 Custom Errors

All revert conditions use custom errors rather than string messages:

```solidity
// ✅ 4-byte selector, no string storage
error NotERC721();
revert NotERC721();

// ❌ costs string storage at deploy + larger calldata on revert
require(condition, "Contract is not ERC721");
```

Custom errors reduce deployment bytecode (no string literals) and revert calldata (4-byte selector vs arbitrary string). With ~40 distinct error types across the contracts, the savings are meaningful.

---

## 5.3 O(1) Offer Buyer Removal

The `_offerBuyers` + `_offerBuyerIndex` dual-mapping enables constant-time removal via swap-and-pop, rather than an O(n) linear scan:

```solidity
// Find position in O(1)
uint256 idx = _offerBuyerIndex[nft][id][buyer]; // 1-indexed

// Swap last element into the removed slot
address last = list[lastIdx - 1];
list[idx - 1] = last;
_offerBuyerIndex[nft][id][last] = idx;

// Remove last slot and clear index
list.pop();
_offerBuyerIndex[nft][id][buyer] = 0;
```

For a token with N active offers, O(n) removal would cost O(N) `SSTORE` operations; this pattern keeps removal at 3–4 `SSTORE` operations regardless of N.

---

## 5.4 `unchecked` Arithmetic

Fee accumulation uses `unchecked` where overflow is provably impossible:

```solidity
unchecked { accumulatedFees += marketFee; }
```

`marketFee` is bounded by `uint128.max` (derived from `uint128 price`). `accumulatedFees` would need to accumulate `2^128 / 1e18 ≈ 340 billion ETH` worth of 2.5% fees to overflow a `uint256` — physically impossible.

---

## 5.5 Memory vs Storage for Struct Reads

In `buyItem` and `acceptOffer`, the full struct is loaded into `memory` before the `delete`:

```solidity
Listing memory listing = listings[nftContract][tokenId]; // warm SLOAD
delete listings[nftContract][tokenId];                    // SSTORE → zero (refund)
// subsequent reads use `listing.xxx` — free memory access, no more SLOADs
```

After `delete`, the storage slot is zeroed and cold for any subsequent read. Loading into memory first avoids multiple SLOADs from a slot that is about to be zeroed anyway.

---

## 5.6 `uint128` Prices and `uint64` Timestamps

- `listing.price` and `offer.amount` are stored as `uint128` (max ~340 quintillion ETH — more than enough).
- `offer.expiresAt` is stored as `uint64` (valid until year 584 billion — sufficient).

These narrower types allow the packing described in §5.1 without any practical range limitation.

---

## 5.7 Gas-Limited `staticcall` for `royaltyInfo`

Rather than a high-level Solidity external call (which forwards all remaining gas by default), `_calculateFees` uses assembly with an explicit gas ceiling:

```solidity
ok := staticcall(ROYALTY_INFO_GAS, nftContract, ..., ptr, 0x40)
//               ^^^^^^^^^^^^^^^^
//               30,000 gas maximum — enough for a storage read, not a gas bomb
```

This prevents a malicious `royaltyInfo` from consuming the entire transaction's gas budget, which would otherwise cause the purchase to fail entirely.

---

## 5.8 URI Storage: Mapping over Struct Array

Token URIs are stored in `mapping(uint256 => string)` rather than a `TokenData[]` struct array. A mapping provides direct slot-addressed access by token ID without array length reads or struct offset calculations, and avoids packing side effects from adjacent fields.

---

## 5.9 Optimizer Configuration

`foundry.toml` configures:

```toml
optimizer = true
optimizer_runs = 200
```

`optimizer_runs = 200` is the standard setting, optimizing for an equal balance between deployment gas and per-call gas. For a marketplace where `buyItem` and `makeOffer` are called frequently, increasing `optimizer_runs` to `1000` would reduce per-call gas at the cost of slightly higher deployment bytecode — a reasonable trade-off for a production deployment.

---

## 5.10 Opportunities for Further Optimization

| Opportunity | Potential Saving | Trade-off |
|------------|-----------------|-----------|
| Increase `optimizer_runs` to 1000 | Lower per-call gas | Higher deploy gas |
| ERC-721A for batch minting | ~10× cheaper batch mint | More complex token ownership tracking |
| Pack `totalSupply` + `revealed` + `mintSeedCommitted` into one slot | 2 fewer storage slots in collection | Requires explicit bit manipulation |
| Bitmap for offer tracking instead of address array | Constant-size storage per token | Limits buyers to a known set |
| `SSTORE2` for URI storage on large collections | Cheaper URI reads (STATICCALL vs SLOAD) | Higher write cost; more complexity |
