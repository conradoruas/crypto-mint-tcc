import {
  NFTMinted,
  Transfer,
  MintSeedCommitted,
  MintSeedRevealed,
  Revealed,
  Withdrawn,
} from "../generated/templates/NFTCollection/NFTCollection";
import { NFT, Collection, Listing, CollectionWithdrawal, ActivityEvent } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { getOrCreateStats, getOrCreateCollectionStat, removeActiveListingAndRecalcFloor } from "./helpers";

export function handleNFTMinted(event: NFTMinted): void {
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
}

/**
 * Handles ERC-721 Transfer events to keep NFT ownership in sync.
 *
 * Skips mint transfers (from == 0x0) because handleNFTMinted already
 * creates the entity and sets the owner. For all other transfers
 * (marketplace sales, peer-to-peer, etc.) it updates the owner field.
 */
export function handleTransfer(event: Transfer): void {
  // Mint transfers are handled by handleNFTMinted — skip to avoid duplicate processing
  if (event.params.from.toHexString() == "0x0000000000000000000000000000000000000000") {
    return;
  }

  let nftId = event.address.toHexString() + "-" + event.params.tokenId.toString();
  let nft = NFT.load(nftId);
  if (nft) {
    // Deactivate stale listing — the NFT changed hands outside the marketplace
    // (peer-to-peer transfer, other contract, etc.), so any active listing is invalid.
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

  // Activity event for non-marketplace transfers
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

export function handleRevealed(event: Revealed): void {
  let collection = Collection.load(event.address.toHexString());
  if (collection) {
    collection.revealed = true;
    collection.save();
  }
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
