# 8. Testing & Validation

---

## 8.1 Test Infrastructure

| File | Framework | Scope |
|------|-----------|-------|
| [test/NFTMarketplace.t.sol](../test/NFTMarketplace.t.sol) | Foundry / Forge | Marketplace + V1 collection + factory: unit, integration, fuzz, security |
| [test/NFTCollectionV2.t.sol](../test/NFTCollectionV2.t.sol) | Foundry / Forge | V2 collection + V2 factory: unit tests + contractURI-specific cases |

**Test actors:**

```solidity
address owner    = makeAddr("owner");    // marketplace deployer / admin
address seller   = makeAddr("seller");   // NFT owner / collection creator
address buyer    = makeAddr("buyer");
address buyer2   = makeAddr("buyer2");
address stranger = makeAddr("stranger"); // unauthorized party
```

**Test constants:**

```solidity
uint256 MINT_PRICE   = 0.0001 ether;
uint256 LIST_PRICE   = 0.05 ether;
uint256 OFFER_AMOUNT = 0.03 ether;
uint256 FEE_BPS      = 250;   // 2.5%
uint256 MAX_SUPPLY   = 5;
```

---

## 8.2 Test Coverage by Component

### `NFTCollection` — URI Loading

| Test | Validates |
|------|-----------|
| `test_collection_urisLoaded` | `urisLoaded()` returns true after `loadTokenURIs` |
| `test_collection_loadURIs_revertsIfMintAlreadyStarted` | `MintingAlreadyStarted` on post-mint `loadTokenURIs` |
| `test_collection_loadURIs_revertsIfExceedsSupply` | `ExceedsMaxSupply` when URI count > `maxSupply` |
| `test_collection_loadURIs_revertsIfNotOwner` | Access control on `loadTokenURIs` |

### `NFTCollection` — Minting

| Test | Validates |
|------|-----------|
| `test_collection_mint_success` | Token minted, owner set, URI non-empty, `totalSupply` incremented |
| `test_collection_mint_emitsEvent` | `NFTMinted` event with correct indexed fields |
| `test_collection_mint_revertsIfURIsNotLoaded` | `URIsNotLoaded` before setup |
| `test_collection_mint_revertsIfInsufficientPayment` | `InsufficientPayment` |
| `test_collection_mint_revertsIfSupplyExceeded` | `SupplyExhausted` on supply-1 collection |
| `test_collection_mint_allTokensUnique` | All 5 URIs non-empty after exhausting supply |
| `test_collection_mint_refundsExcess` | ETH overpayment refunded exactly |

### `NFTCollectionFactory`

| Test | Validates |
|------|-----------|
| `test_factory_createCollection_success` | Registry entry correctness |
| `test_factory_createCollection_emitsEvent` | `CollectionCreated` event |
| `test_factory_creatorCollections` | `getCreatorCollections` returns correct index |
| `test_factory_createCollection_revertsIfNoName` | `NameRequired` |
| `test_factory_createCollection_revertsIfZeroSupply` | `SupplyMustBePositive` |

### `NFTCollectionV2` — Specific

| Test | Validates |
|------|-----------|
| `test_contractURI_isSetAtConstruction` | `contractURI()` matches deploy arg |
| `test_contractURI_hasNoSetter` | No `setContractURI` function exists (call reverts) |
| `test_contractURI_emptyStringAllowed` | Empty string is a valid `contractURI` |
| `test_factory_collectionCreatedEventIncludesContractURI` | V2 event includes `contractURI` field |
| `test_factory_storesContractURIInRegistry` | Factory registry stores `contractURI` |
| `test_mint_allTokensUnique` | Cross-product uniqueness check (all pairs `(i,j)` distinct) |
| `test_mint_revealedAfterSupplyExhausted` | `revealed == true` after last mint |
| `test_revealSeed_verifiable` | `revealMintSeed` sets `mintSeedRevealed` correctly |
| `test_royalty_defaultFivePercent` | `royaltyInfo(0, 1 ether)` returns `(creator, 0.05 ether)` |
| `test_supportsInterface_ERC721` | ERC-165 for ERC-721 |
| `test_supportsInterface_ERC2981` | ERC-165 for ERC-2981 |

### `NFTMarketplace` — Listing

| Test | Validates |
|------|-----------|
| `test_listItem_success` | Listing created with correct seller, price, active flag |
| `test_listItem_emitsEvent` | `ItemListed` event |
| `test_listItem_revertsIfNotOwner` | `NotNFTOwner` |
| `test_listItem_revertsIfPriceTooLow` | `PriceTooLow` (< 0.0001 ETH) |
| `test_listItem_revertsIfNotApproved` | `MarketplaceNotApproved` |
| `test_listItem_revertsIfAlreadyListed` | `AlreadyListed` |
| `test_listItem_revertsIfNotERC721` | Reverts on non-ERC-721 contract |

### `NFTMarketplace` — Cancel Listing

| Test | Validates |
|------|-----------|
| `test_cancelListing_success` | Listing deactivated by seller |
| `test_cancelListing_byOwnerAdmin` | Admin can cancel any listing |
| `test_cancelListing_emitsEvent` | `ListingCancelled` event |
| `test_cancelListing_revertsIfNotListed` | `NotListed` |
| `test_cancelListing_revertsIfStranger` | `NotAuthorizedToCancel` |

### `NFTMarketplace` — Buying

| Test | Validates |
|------|-----------|
| `test_buyItem_success` | NFT transferred, listing cleared, seller receives `price - fee` |
| `test_buyItem_revertsIfOverpay` | `IncorrectPayment` |
| `test_buyItem_emitsEvent` | `ItemSold` event |
| `test_buyItem_revertsIfNotListed` | `NotForSale` |
| `test_buyItem_revertsIfIncorrectPayment` | `IncorrectPayment` |
| `test_buyItem_revertsIfSellerTriesToBuy` | `SellerCannotBuyOwn` |
| `test_buyItem_feeCalculation` | Seller receives exactly `price - fee`; marketplace balance equals `fee` |

### `NFTMarketplace` — Offers

| Test | Validates |
|------|-----------|
| `test_makeOffer_success` | Offer stored, ETH escrowed, expiry set |
| `test_makeOffer_registresBuyerInList` | Buyer appears in `getOfferBuyers` |
| `test_makeOffer_multipleOffers` | Two buyers tracked correctly |
| `test_makeOffer_emitsEvent` | `OfferMade` event |
| `test_makeOffer_revertsIfAmountTooLow` | `OfferTooLow` |
| `test_makeOffer_revertsIfOwnerTriesToOffer` | `OwnerCannotOffer` |
| `test_makeOffer_revertsIfDuplicateOffer` | `ActiveOfferExists` on unexpired duplicate |
| `test_makeOffer_autoRefundsExpiredOffer` | Expired offer refunded; new offer accepted |
| `test_makeOffer_autoRefundEmitsEvent` | `OfferExpiredRefund` before `OfferMade` |
| `test_makeOffer_revertsIfActiveOfferNotExpired` | `ActiveOfferExists` on active offer |
| `test_makeOffer_autoRefundThenNewOfferCanBeAccepted` | Full flow: expire → re-offer → accept |
| `test_makeOffer_revertsIfNotERC721` | Reverts on non-ERC-721 contract |
| `test_acceptOffer_success` | NFT transferred; seller receives `amount - fee` |
| `test_acceptOffer_cancelsPreviousListing` | Active listing auto-cancelled |
| `test_acceptOffer_sellerReceivesCorrectAmount` | Exact balance assertions |
| `test_acceptOffer_emitsEvent` | `OfferAccepted` event |
| `test_acceptOffer_revertsIfNotOwner` | `NotNFTOwner` |
| `test_acceptOffer_revertsIfOfferNotActive` | `OfferNotActive` |
| `test_acceptOffer_revertsIfExpired` | `OfferExpired` after 8 days |
| `test_acceptOffer_revertsIfNotApproved` | `MarketplaceNotApproved` |
| `test_cancelOffer_success` | Offer cleared; ETH refunded |
| `test_cancelOffer_emitsEvent` | `OfferCancelled` event |
| `test_cancelOffer_revertsIfNoActiveOffer` | `OfferNotActive` |
| `test_reclaimExpiredOffer_success` | Buyer receives `amount - bounty`; caller receives bounty |
| `test_reclaimExpiredOffer_revertsIfNotExpired` | `OfferNotExpired` |
| `test_reclaimExpiredOffer_revertsIfNoOffer` | `OfferNotActive` |

### Security Tests

| Test | Validates |
|------|-----------|
| `test_withdraw_doesNotDrainEscrow` | `withdraw()` only removes `accumulatedFees`; buyer escrow intact |
| `test_buyItem_reentrancyProtected` | `ReentrancyAttacker` re-enters `buyItem`; must revert |
| `test_cancelOffer_reentrancySafe` | `ReentrancyCancelAttacker` re-enters `cancelOffer`; no double refund |

### Fuzz Tests

| Test | Property |
|------|----------|
| `testFuzz_feeCalculation_invariants(uint256 price)` | For all valid prices: `sellerProceeds + platformFee == price`; fee == exact 2.5%; no ETH stuck beyond tracked fees |
| `testFuzz_offerAmount_roundTrip(uint256 amount)` | For all valid amounts: full amount escrowed; full amount refunded on cancel; zero ETH left after cancel |

### Integration Tests

| Test | Scenario |
|------|----------|
| `test_fullFlow_mintListBuy` | Complete mint → list → buy with balance assertions |
| `test_fullFlow_mintOfferAccept` | Complete mint → offer → accept with balance assertions |
| `test_fullFlow_listThenAcceptOffer` | Listed NFT sold via offer (listing auto-cancelled) |
| `test_fullFlow_offerCancelledAndNewOffer` | Cancel → re-offer: `_offerBuyers` must have exactly 1 entry (no duplicate) |
| `test_fullFlow_multipleCollections` | Two collections in same marketplace operate independently |
| `test_sellerReceivesPaymentFromBuyer` | Precise balance assertions across all three parties |

---

## 8.3 Invariants

1. **Fee conservation:** `sellerProceeds + marketFee + royaltyFee == salePrice` for every sale.
2. **Escrow integrity:** `address(marketplace).balance == accumulatedFees + totalPendingWithdrawals + Σ(active offer amounts)` at all times.
3. **Buyer tracking consistency:** An address in `_offerBuyers[nft][id]` always has a corresponding `active == true` entry in `offers[nft][id][buyer]`, and vice versa.
4. **URI uniqueness:** Each URI in `_availableURIs` is assigned to exactly one token — the pool shrinks by exactly one per mint.
5. **Supply monotonicity:** `totalSupply` is strictly monotonically increasing; once equal to `maxSupply`, no further mints succeed.
6. **No ETH loss:** The sum of all escrow + `accumulatedFees` + `totalPendingWithdrawals` must equal `address(marketplace).balance` at all times.

---

## 8.4 Running the Test Suite

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run a specific test
forge test --match-test test_buyItem_reentrancyProtected -vv

# Run fuzz tests with more runs
forge test --match-test testFuzz_ --fuzz-runs 10000

# Run with coverage (requires lcov)
forge coverage
```
