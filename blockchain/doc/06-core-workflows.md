# 6. Core Workflows

---

## 6.1 Minting an NFT

**Prerequisites:** Creator must have loaded all URIs and committed the mint seed before any mint can proceed.

```
Creator                    NFTCollectionV2
   │                              │
   ├─ loadTokenURIs(batch_1) ────►│ stores URIs in _availableURIs[]
   ├─ appendTokenURIs(batch_2) ───►│ (may be split across multiple txs)
   │   ...until _availableURIs.length == maxSupply
   │                              │
   ├─ commitMintSeed(keccak256(secret)) ──►│
   │                              │ mintSeedCommitted = true
   │                              │ emit MintSeedCommitted(commitment)
   │                              │
Minter                            │
   ├─ mint{value ≥ mintPrice}(to) ─►│
   │                              │ ① check totalSupply < maxSupply
   │                              │ ② check _availableURIs.length > 0
   │                              │ ③ check mintSeedCommitted == true
   │                              │ ④ check msg.value >= mintPrice
   │                              │
   │                              │ tokenId = totalSupply++
   │                              │ bhash   = blockhash(block.number - 1)
   │                              │ index   = keccak256(seed, bhash, to, tokenId) % remaining
   │                              │ chosenUri = _availableURIs[index]
   │                              │ swap-and-pop _availableURIs
   │                              │ _tokenURIs[tokenId] = chosenUri
   │                              │
   │                              │ _safeMint(to, tokenId)
   │                              │ refund excess ETH to msg.sender
   │                              │ emit NFTMinted(to, tokenId, chosenUri)
   │                              │ if last token: emit Revealed()
   │◄── tokenId ─────────────────┤
```

---

## 6.2 Creating a Collection with Custom Traits (V2)

```
Creator                  NFTCollectionFactoryV2          IPFS
   │                              │                        │
   ├─ upload trait schema JSON ──────────────────────────►│
   │  (contractURI JSON with       │                        │
   │   trait_schema extension)     │◄── ipfs://QmCID ───────┤
   │                              │                        │
   ├─ createCollection(           │
   │    name, symbol,             │
   │    description, image,        │
   │    maxSupply, mintPrice,       │
   │    "ipfs://QmCID"            │
   │  ) ─────────────────────────►│
   │                              │ ① validate name != ""
   │                              │ ② validate maxSupply > 0
   │                              │ deploy NFTCollectionV2(
   │                              │   ..., msg.sender, contractURI)
   │                              │ register in _collections[]
   │                              │ _creatorCollections[msg.sender].push(id)
   │                              │ emit CollectionCreated(
   │                              │   creator, address, name, id, contractURI)
   │◄── collectionAddress ────────┤
```

The subgraph picks up `CollectionCreated`, resolves `contractURI` from IPFS, and parses `trait_schema` for explore-page filters.

---

## 6.3 Listing an NFT

```
Seller                   NFTMarketplace          NFTCollection(V2)
   │                           │                       │
   ├─ approve(marketplace) OR  │                       │
   │  setApprovalForAll ───────►│ (sent to collection)  │
   │                           │                       │
   ├─ listItem(nft, id, price) ►│
   │                           │ ① IERC165.supportsInterface(ERC721)
   │                           │ ② ownerOf(id) == msg.sender
   │                           │ ③ price >= 0.0001 ETH
   │                           │ ④ price <= uint128.max
   │                           │ ⑤ isApproved(id) || isApprovedForAll
   │                           │ ⑥ !listings[nft][id].active
   │                           │
   │                           │ listings[nft][id] = Listing{
   │                           │   seller: msg.sender,
   │                           │   active: true,
   │                           │   price:  uint128(price)
   │                           │ }
   │                           │ emit ItemListed(nft, id, seller, price)
```

---

## 6.4 Buying an NFT

```
Buyer          NFTMarketplace         Seller      Royalty Receiver
   │                  │                  │               │
   ├─ buyItem{value}(nft,id) ──────────►│
   │                  │
   │                  │ ① listing.active == true
   │                  │ ② msg.value == listing.price (exact)
   │                  │ ③ msg.sender != listing.seller
   │                  │
   │                  │ delete listings[nft][id]
   │                  │ clear ghost offer (if buyer has active offer)
   │                  │
   │                  │ _calculateFees(price):
   │                  │   marketFee     = price × 2.5%
   │                  │   royaltyInfo() via staticcall (30k gas, 64B cap)
   │                  │   royalty       = min(returned, price × 10%)
   │                  │   sellerProceeds = price − fee − royalty
   │                  │
   │                  │ accumulatedFees += marketFee
   │                  │
   │                  ├─ _paySeller ─────────────────────────────►│
   │                  │   (push; credit pendingWithdrawals if fail)
   │                  │
   │                  ├─ _payRoyalty ──────────────────────────────────────►│
   │                  │   (push; emit RoyaltyPaid or RoyaltyPending)
   │                  │
   │                  ├─ refund ghost offer ETH ──────────────────►│ (to buyer)
   │                  │
   │                  ├─ safeTransferFrom(seller, buyer, id) ──────►│ (NFT transfer)
   │                  │
   │                  │ emit ItemSold(nft, id, seller, buyer, price)
```

---

## 6.5 Making and Accepting an Offer

### Making an Offer

```
Buyer                   NFTMarketplace
   │                          │
   ├─ makeOffer{ETH}(nft,id) ─►│
   │                          │ ① ERC-165 check
   │                          │ ② ownerOf(id) != address(0)
   │                          │ ③ msg.value >= 0.0001 ETH
   │                          │ ④ msg.value <= uint128.max
   │                          │ ⑤ tokenOwner != msg.sender
   │                          │
   │                          │ if existing offer:
   │                          │   if active && !expired → revert ActiveOfferExists
   │                          │   if active && expired  → stage expiredRefund
   │                          │
   │                          │ offers[nft][id][buyer] = Offer{
   │                          │   buyer, active: true,
   │                          │   expiresAt: now + 7 days,
   │                          │   amount: msg.value
   │                          │ }
   │                          │ _addOfferBuyer(nft, id, buyer)
   │                          │
   │                          │ push expired refund (if any)
   │                          │   → fall back to pendingWithdrawals if fails
   │                          │
   │                          │ emit OfferMade(nft, id, buyer, amount, expiresAt)
```

### Accepting an Offer

```
Seller                  NFTMarketplace            Buyer
   │                          │                     │
   ├─ acceptOffer(nft, id, buyer) ──────────────────►│
   │                          │
   │                          │ ① ownerOf(id) == msg.sender
   │                          │ ② marketplace is approved
   │                          │ ③ offer.active == true
   │                          │ ④ block.timestamp <= offer.expiresAt
   │                          │
   │                          │ delete offers[nft][id][buyer]
   │                          │ _removeOfferBuyer(nft, id, buyer)
   │                          │ if listing active: delete + emit ListingCancelled
   │                          │
   │                          │ _calculateFees(offer.amount)
   │                          │ accumulatedFees += marketFee
   │                          │
   │                          ├─ _paySeller(seller, proceeds) ──────►│
   │                          ├─ _payRoyalty(receiver, royalty)
   │                          ├─ safeTransferFrom(seller, buyer, id) ──────────────►│
   │                          │
   │                          │ emit OfferAccepted(nft, id, seller, buyer, amount)
```

---

## 6.6 Cancelling an Offer

```
Buyer                   NFTMarketplace
   │                          │
   ├─ cancelOffer(nft,id) ────►│
   │                          │ ① offer.active == true
   │                          │
   │                          │ delete offers[nft][id][msg.sender]
   │                          │ _removeOfferBuyer(nft, id, msg.sender)
   │                          │
   │                          │ push refund to msg.sender
   │                          │   → credit pendingWithdrawals if push fails
   │                          │
   │                          │ emit OfferCancelled(nft, id, buyer)
```

---

## 6.7 Reclaiming an Expired Offer

Anyone (including the buyer) can reclaim an expired offer after the 7-day window. A third-party caller earns a 0.5% bounty:

```
Caller (anyone)         NFTMarketplace            Buyer
   │                          │                     │
   ├─ reclaimExpiredOffer(nft, id, buyer) ──────────►│
   │                          │
   │                          │ ① offer.active == true
   │                          │ ② block.timestamp > offer.expiresAt
   │                          │
   │                          │ delete offers[nft][id][buyer]
   │                          │ _removeOfferBuyer(nft, id, buyer)
   │                          │
   │                          │ if caller != buyer:
   │                          │   bounty = amount × 0.5%
   │                          │   refund = amount − bounty
   │                          │   push bounty to caller
   │                          │
   │                          │ push refund to buyer
   │                          │   → credit pendingWithdrawals if fails
   │                          │
   │                          │ emit OfferExpiredRefund(nft, id, buyer, amount)
   │                          │ emit ReclaimBountyPaid(caller, buyer, bounty)
```

---

## 6.8 Royalty Handling (Internal Detail)

```
_calculateFees(nftContract, tokenId, salePrice)
   │
   ├── marketFee = salePrice × marketplaceFee / 10000
   │
   ├── assembly staticcall(30_000 gas, nftContract, royaltyInfo(id, price), 64-byte output)
   │       returns (receiver address, royalty amount)
   │       if call fails or returns < 64 bytes → royalty = 0
   │
   ├── if royalty > salePrice × 10%: royalty = salePrice × 10%  (hard cap)
   │
   ├── if marketFee + royalty > salePrice: revert FeesExceedSalePrice
   │
   └── sellerProceeds = salePrice − marketFee − royalty

_payRoyalty(receiver, amount)
   ├── push: payable(receiver).call{value: amount}
   │       success → emit RoyaltyPaid(receiver, amount)
   │       failure → pendingWithdrawals[receiver] += amount
   │                 emit RoyaltyPending(receiver, amount)
   └── receiver later calls withdrawPending() to claim
```
