# 2. Contract Architecture

---

## 2.1 `NFTCollection` / `NFTCollectionV2`

**Purpose:** ERC-721 collection with bounded supply, a fixed mint price, and pseudo-random URI assignment via an in-place Fisher-Yates shuffle mixed with a commit-reveal seed.

### Inheritance

```
NFTCollectionV2
├── ERC721          (OpenZeppelin) — token ownership and transfer
├── ERC2981         (OpenZeppelin) — on-chain royalty standard
├── Ownable         (OpenZeppelin) — creator-only admin functions
└── ReentrancyGuard (OpenZeppelin) — reentrancy protection on mint/withdraw
```

### State Variables

| Variable | Type | Visibility | Purpose |
|----------|------|-----------|---------|
| `maxSupply` | `uint256` | public | Hard cap on minted tokens |
| `mintPrice` | `uint256` | public | Cost per mint in wei |
| `totalSupply` | `uint256` | public | Monotonically increasing token ID counter |
| `revealed` | `bool` | public | True once the last URI is consumed from the pool |
| `mintSeedCommitment` | `bytes32` | public | `keccak256(seed)` published before minting opens |
| `mintSeedRevealed` | `bytes32` | public | The pre-image, published post-sale for auditing |
| `mintSeedCommitted` | `bool` | public | Guard flag: minting blocked until true |
| `_availableURIs` | `string[]` | private | URI pool; shrinks by one per mint via swap-and-pop |
| `_tokenURIs` | `mapping(uint256 => string)` | private | Permanent URI storage indexed by token ID |
| `contractURIStorage` | `string` | public | *(V2 only)* IPFS URI for collection metadata + trait schema |
| `factory` | `address` | public | Factory contract that deployed this collection |
| `collectionDescription` | `string` | public | Off-chain display metadata |
| `collectionImage` | `string` | public | Cover image URI for indexers |

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `loadTokenURIs(uris[])` | `onlyOwner` | Loads the full URI pool before any mint; reverts if minting has started (`totalSupply != 0`) |
| `appendTokenURIs(uris[])` | `onlyOwner` | Batch-appends URIs; useful for large collections uploaded in chunks |
| `commitMintSeed(bytes32)` | `onlyOwner` | Publishes `keccak256(seed)`; requires all URIs loaded; irreversible |
| `revealMintSeed(bytes32)` | `onlyOwner` | Publishes the seed pre-image; validates `keccak256(seed) == commitment` |
| `mint(address to)` | `payable`, anyone | Mints one token with pseudo-randomly drawn URI; refunds excess ETH |
| `withdraw()` | `onlyOwner`, `nonReentrant` | Transfers accumulated mint revenue to the owner |
| `tokenURI(uint256)` | `view` | Returns the immutable URI assigned to a minted token |
| `contractURI()` | `view` | *(V2 only)* Returns the IPFS contract-level metadata URI |
| `urisLoaded()` | `view` | Returns true once the URI pool is non-empty or collection is fully minted |

### Pre-Mint Setup Sequence (enforced by the contract)

```
loadTokenURIs(batch_1) [+ appendTokenURIs(batch_2..N)]
    → _availableURIs.length == maxSupply

commitMintSeed(keccak256(secret))
    → mintSeedCommitted = true
    → _availableURIs locked

mint() now enabled
```

### Randomness Model

```solidity
uint256 index = uint256(
    keccak256(abi.encodePacked(
        mintSeedCommitment,        // committed before sale — opaque to users
        blockhash(block.number - 1), // finalized — unknown until prev block mined
        to,                        // recipient — known but not independently controllable
        tokenId                    // sequential — predictable but harmless
    ))
) % remaining;
```

The two entropy sources (pre-committed seed + finalized blockhash) together make pre-computation impractical in the honest-miner model. A colluding PoS block proposer could selectively include/exclude transactions to bias outcomes — this residual risk is accepted given the testnet scope.

### V2 Additions

`NFTCollectionV2` adds a single field set immutably at construction:

```solidity
string public contractURIStorage;

function contractURI() external view returns (string memory) {
    return contractURIStorage;
}
```

There is intentionally no `setContractURI` function. The URI is set once and cannot be changed, providing a stable reference for indexers. An empty string is a valid value for schema-less collections.

---

## 2.2 `NFTCollectionFactory` / `NFTCollectionFactoryV2`

**Purpose:** Permissionless factory that deploys collection instances and maintains an append-only on-chain registry of all deployed collections.

### State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `_collections` | `CollectionInfo[]` | Flat, append-only registry of all deployed collections |
| `_creatorCollections` | `mapping(address => uint256[])` | Creator address → list of registry indices |

### `CollectionInfo` Struct

```solidity
// NFTCollectionFactory (V1)
struct CollectionInfo {
    address contractAddress;
    address creator;
    string  name;
    string  symbol;
    string  description;
    string  image;
    uint256 maxSupply;
    uint256 mintPrice;
    uint256 createdAt;
}

// NFTCollectionFactoryV2 — adds contractURI
struct CollectionInfo {
    address contractAddress;
    address creator;
    string  name;
    string  symbol;
    string  description;
    string  image;
    string  contractURI;   // ← V2 addition
    uint256 maxSupply;
    uint256 mintPrice;
    uint256 createdAt;
}
```

### Key Functions

| Function | Description |
|----------|-------------|
| `createCollection(...)` | Deploys a new collection, registers it, emits `CollectionCreated` |
| `getCollection(id)` | Returns `CollectionInfo` by registry index |
| `getAllCollections()` | Returns entire registry (unbounded — safe only for small registries) |
| `getCollections(offset, limit)` | Paginated slice; safe for large registries |
| `getCreatorCollections(address)` | Returns registry indices belonging to a creator |
| `totalCollections()` | Returns registry size |

### Access Control

No `Ownable`. Any EOA or contract may call `createCollection()`; the caller (`msg.sender`) becomes the deployed collection's owner and default royalty receiver. Validation is limited to:

- `bytes(name).length > 0` — `NameRequired`
- `maxSupply > 0` — `SupplyMustBePositive`

---

## 2.3 `NFTMarketplace`

**Purpose:** Generic ERC-721 marketplace supporting fixed-price listings, buyer offers with ETH escrow, ERC-2981 royalties with a hard cap, configurable platform fees, and pull-payment fallbacks for all ETH recipients.

### Inheritance

```
NFTMarketplace
├── Ownable         (OpenZeppelin) — admin fee management and config
└── ReentrancyGuard (OpenZeppelin) — reentrancy protection
```

### Packed Structs

Both structs are packed into exactly 2 storage slots each:

```solidity
// Slot 1: seller (20 B) + active (1 B) + 11 B padding
// Slot 2: price  (16 B)
struct Listing {
    address seller;
    bool    active;
    uint128 price;
}

// Slot 1: buyer (20 B) + active (1 B) + expiresAt (8 B) + 3 B padding
// Slot 2: amount (16 B)
struct Offer {
    address buyer;
    bool    active;
    uint64  expiresAt;
    uint128 amount;
}
```

### State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `marketplaceFee` | `uint256` | Platform fee in basis points (default 250 = 2.5%) |
| `accumulatedFees` | `uint256` | Tracked platform fees pending owner withdrawal |
| `listings` | `mapping(address => mapping(uint256 => Listing))` | Active listings indexed by NFT contract + token ID |
| `offers` | `mapping(address => mapping(uint256 => mapping(address => Offer)))` | Active offers indexed by contract + tokenId + buyer |
| `_offerBuyers` | `mapping(address => mapping(uint256 => address[]))` | Ordered list of offer-makers per token |
| `_offerBuyerIndex` | `mapping(address => mapping(uint256 => mapping(address => uint256)))` | 1-indexed position in `_offerBuyers` for O(1) removal |
| `pendingWithdrawals` | `mapping(address => uint256)` | Pull-payment ledger for failed ETH push transfers |
| `totalPendingWithdrawals` | `uint256` | Sum of pending withdrawals (used by `totalEscrow()`) |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `OFFER_DURATION` | `7 days` | Fixed offer validity window |
| `MAX_ROYALTY_BPS` | `1000` (10%) | Hard cap on ERC-2981 royalties to protect sellers |
| `ROYALTY_INFO_GAS` | `30_000` | Gas forwarded to `royaltyInfo` — prevents gas bombs |
| `RECLAIM_BOUNTY_BPS` | `50` (0.5%) | Bounty paid to third parties who clean up expired offers |

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `listItem(nft, id, price)` | anyone | Lists NFT at fixed price; validates ERC-721, ownership, approval |
| `updateListingPrice(nft, id, price)` | listing seller | Atomically updates price; avoids the cancel-relist front-run gap |
| `buyItem(nft, id)` | `payable`, `nonReentrant` | Buys listed NFT; distributes proceeds, royalty, and fee atomically |
| `cancelListing(nft, id)` | seller or marketplace owner | Cancels active listing; admin override for moderation |
| `makeOffer(nft, id)` | `payable`, `nonReentrant` | Escrows ETH as offer; auto-refunds expired previous offer from same buyer |
| `acceptOffer(nft, id, buyer)` | NFT owner, `nonReentrant` | Accepts active unexpired offer; auto-cancels any concurrent listing |
| `cancelOffer(nft, id)` | offer maker, `nonReentrant` | Cancels own offer and refunds escrowed ETH |
| `reclaimExpiredOffer(nft, id, buyer)` | anyone, `nonReentrant` | Refunds expired offer to buyer; pays 0.5% bounty to caller if third party |
| `pruneExpiredOffers(nft, id, maxIter)` | anyone, `nonReentrant` | Batch-prunes expired offers; pays bounties; pull-payment fallback per buyer |
| `withdrawPending()` | pull-payment creditor, `nonReentrant` | Withdraws ETH from pull-payment ledger |
| `setMarketplaceFee(bps)` | `onlyOwner` | Updates platform fee; max 1000 bps (10%) |
| `withdraw()` | `onlyOwner`, `nonReentrant` | Withdraws only `accumulatedFees` — never touches offer escrow |

### O(1) Offer Buyer Tracking

The dual-mapping `_offerBuyers` + `_offerBuyerIndex` pattern enables constant-time removal from the buyer list:

```solidity
// _offerBuyerIndex stores (position + 1); 0 means "not present"
function _removeOfferBuyer(address nftContract, uint256 tokenId, address buyer) internal {
    uint256 idx  = _offerBuyerIndex[nftContract][tokenId][buyer];
    if (idx == 0) return;

    address[] storage list    = _offerBuyers[nftContract][tokenId];
    uint256           lastIdx = list.length;

    if (idx != lastIdx) {
        address last = list[lastIdx - 1];
        list[idx - 1] = last;
        _offerBuyerIndex[nftContract][tokenId][last] = idx; // update displaced element
    }
    list.pop();
    _offerBuyerIndex[nftContract][tokenId][buyer] = 0;
}
```

Without this, removal would be O(n), becoming expensive for tokens with many concurrent offers.

### Fee Calculation (Internal)

```solidity
function _calculateFees(address nftContract, uint256 tokenId, uint256 salePrice)
    internal view
    returns (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds)
{
    marketFee = (salePrice * marketplaceFee) / 10000;

    // staticcall with 30k gas cap + 64-byte returndata cap (return-bomb prevention)
    // royalty is capped at MAX_ROYALTY_BPS (10%)

    sellerProceeds = salePrice - marketFee - royaltyFee;
}
```

All three participants (seller, royalty receiver, marketplace) receive their share in the same transaction. If any ETH push fails, the amount is credited to `pendingWithdrawals` instead of reverting.
