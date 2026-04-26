import {
  NFTMinted,
  Transfer,
  MintSeedCommitted,
  MintSeedRevealed,
  Revealed,
  Withdrawn,
} from "../generated/templates/NFTCollectionV2/NFTCollectionV2";
import { NFT, Collection, Listing, CollectionWithdrawal, ActivityEvent, Attribute, TraitOption, CollectionStat } from "../generated/schema";
import { BigInt, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts";
import {
  getOrCreateStats,
  getOrCreateCollectionStat,
  removeActiveListingAndRecalcFloor,
} from "./helpers";
import { extractIpfsCid } from "./factory-v2";
import { TokenMetadata } from "../generated/templates";

export function handleNFTMintedV2(event: NFTMinted): void {
  let collectionId = event.address.toHexString();
  let nftId = collectionId + "-" + event.params.tokenId.toString();

  let nft = new NFT(nftId);
  nft.tokenId = event.params.tokenId;
  nft.tokenUri = event.params.tokenUri;
  nft.owner = event.params.to;
  nft.collection = collectionId;
  nft.mintedAt = event.block.timestamp;
  nft.metadataResolved = false;
  nft.save();

  // Increment collection totalSupply
  let collection = Collection.load(collectionId);
  if (collection) {
    collection.totalSupply = collection.totalSupply.plus(BigInt.fromI32(1));
    collection.save();
  }

  // Activity event
  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "mint";
  act.nftContract = event.address;
  act.tokenId = event.params.tokenId;
  act.from = event.params.to;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();

  // Global stats
  let stats = getOrCreateStats();
  stats.totalNFTs = stats.totalNFTs.plus(BigInt.fromI32(1));
  stats.save();

  // Spawn TokenMetadata File Data Source for this token's IPFS JSON
  let cid = extractIpfsCid(event.params.tokenUri);
  if (cid.length > 0) {
    let ctx = new DataSourceContext();
    ctx.setString("nftId", nftId);
    ctx.setString("collectionId", collectionId);
    TokenMetadata.createWithContext(cid, ctx);
  }
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from.toHexString() == "0x0000000000000000000000000000000000000000") {
    return;
  }

  let nftId = event.address.toHexString() + "-" + event.params.tokenId.toString();
  let nft = NFT.load(nftId);
  if (nft) {
    if (nft.listing) {
      let listing = Listing.load(nft.listing!);
      if (listing && listing.active) {
        listing.active = false;
        listing.updatedAt = event.block.timestamp;
        listing.save();

        let stats = getOrCreateStats();
        if (stats.totalListed.gt(BigInt.fromI32(0))) {
          stats.totalListed = stats.totalListed.minus(BigInt.fromI32(1));
        }
        stats.save();

        let collectionId = event.address.toHexString();
        let colStats = getOrCreateCollectionStat(collectionId, event.block.timestamp);
        removeActiveListingAndRecalcFloor(colStats, nftId);
        colStats.save();
      }
      nft.listing = null;
    }
    nft.owner = event.params.to;
    nft.save();
  }

  let actId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "transfer";
  act.nftContract = event.address;
  act.tokenId = event.params.tokenId;
  act.from = event.params.from;
  act.to = event.params.to;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();
}

export function handleMintSeedCommitted(event: MintSeedCommitted): void {
  let collection = Collection.load(event.address.toHexString());
  if (collection) {
    collection.mintSeedCommitted = true;
    collection.save();
  }
}

export function handleMintSeedRevealed(event: MintSeedRevealed): void {
  let collection = Collection.load(event.address.toHexString());
  if (collection) {
    collection.mintSeedRevealed = true;
    collection.save();
  }
}

/**
 * Handles Revealed() on v2 collections.
 * Computes rarity scores and ranks for all minted NFTs once the supply is exhausted
 * and trait frequencies are final.
 */
export function handleRevealedV2(event: Revealed): void {
  let collectionId = event.address.toHexString();
  let collection = Collection.load(collectionId);
  if (!collection) return;

  collection.revealed = true;
  collection.save();

  _finalizeRarity(collectionId, collection.totalSupply, event.block.timestamp);
}

export function handleCollectionWithdrawn(event: Withdrawn): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rec = new CollectionWithdrawal(id);
  rec.collection = event.address;
  rec.owner = event.params.owner;
  rec.amount = event.params.amount;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();
}

// ─── Rarity finalization ─────────────────────────────────────────────────────

/**
 * Computes rarityScore and rarityRank for every NFT in a collection.
 *
 * Algorithm: statistical rarity — for each attribute of an NFT, its rarity
 * contribution is (totalSupply / traitOption.count).  rarityScore is the sum
 * of all per-trait contributions.  NFTs are then ranked by descending score.
 *
 * Only runs on v2 collections where tokenUri File DS has resolved attributes.
 * For very large collections (>10k) the O(N²) sort can be expensive — the plan
 * notes an off-chain fallback for that scenario.
 */
function _finalizeRarity(
  collectionId: string,
  totalSupply: BigInt,
  timestamp: BigInt
): void {
  if (totalSupply.equals(BigInt.fromI32(0))) return;

  let supply = totalSupply.toBigDecimal();

  // Update TraitOption frequencies first
  // (count is already kept up-to-date by tokenMetadata.ts)
  // We just need to recompute frequency = count / totalSupply
  let collection = Collection.load(collectionId);
  if (!collection) return;

  // We can't iterate @derivedFrom relations in graph-ts — use IDs stored
  // on TraitDefinition entities by loading them via getOrCreate patterns.
  // Since we can't query arbitrary sets, rarity is approximated by iterating
  // Attribute entries keyed by NFT.  The constraint is that graph-ts has no
  // built-in "load all by field" query.
  //
  // Practical approach: iterate nftIds 0..(totalSupply-1), load each NFT,
  // load its attributes, compute score, then sort.  O(N * traits).

  let n = totalSupply.toI32();
  let scores = new Array<BigDecimal>(n);
  let nftIds = new Array<string>(n);

  for (let i = 0; i < n; i++) {
    let nftId = collectionId + "-" + i.toString();
    nftIds[i] = nftId;
    let nft = NFT.load(nftId);
    if (!nft || !nft.metadataResolved) {
      scores[i] = BigDecimal.fromString("0");
      continue;
    }

    // Sum 1/frequency for each attribute
    let score = BigDecimal.fromString("0");
    // We can only access attributes by IDs formed as "<collectionId>-<tokenId>-<traitType>"
    // but we don't know which traitTypes exist here without the TraitDefinition list.
    // Alternative: use a dedicated score pre-accumulated in tokenMetadata.ts.
    // See collection-v2.ts note: we store pre-accumulated score in nft.rarityScore.
    // By the time Revealed() fires, all tokenMetadata File DS handlers should have run.
    let preScore = nft.rarityScore;
    score = preScore ? preScore : BigDecimal.fromString("0");
    scores[i] = score;
  }

  // Rank by descending score (rank 1 = highest score = rarest)
  // Simple insertion sort — O(N²) but fine for typical collection sizes
  let indices = new Array<i32>(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  for (let i = 1; i < n; i++) {
    let key = indices[i];
    let keyScore = scores[key];
    let j = i - 1;
    while (j >= 0 && scores[indices[j]].lt(keyScore)) {
      indices[j + 1] = indices[j];
      j--;
    }
    indices[j + 1] = key;
  }

  for (let rank = 0; rank < n; rank++) {
    let idx = indices[rank];
    let nft = NFT.load(nftIds[idx]);
    if (!nft) continue;

    nft.rarityRank = rank + 1;
    let pct = BigDecimal.fromString((rank + 1).toString()).div(
      BigDecimal.fromString(n.toString())
    );

    // Tier thresholds (percentile buckets)
    let p01 = BigDecimal.fromString("0.01");
    let p05 = BigDecimal.fromString("0.05");
    let p20 = BigDecimal.fromString("0.20");
    let p50 = BigDecimal.fromString("0.50");

    if (pct.le(p01)) {
      nft.rarityTier = "Mythic";
    } else if (pct.le(p05)) {
      nft.rarityTier = "Legendary";
    } else if (pct.le(p20)) {
      nft.rarityTier = "Epic";
    } else if (pct.le(p50)) {
      nft.rarityTier = "Rare";
    } else {
      nft.rarityTier = "Common";
    }
    nft.save();
  }

  // Mark collection rarity as finalized and record timestamp in CollectionStat
  collection = Collection.load(collectionId);
  if (collection) {
    collection.rarityFinalized = true;
    collection.save();
  }

  let colStats = CollectionStat.load(collectionId);
  if (colStats) {
    colStats.rarityComputedAt = timestamp;
    colStats.save();
  }
}
