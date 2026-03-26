import {
  ItemListed,
  ItemSold,
  ListingCancelled,
  OfferMade,
  OfferAccepted,
  OfferCancelled,
} from "../generated/NFTMarketplace/NFTMarketplace";
import {
  NFT,
  Listing,
  Offer,
  ActivityEvent,
  MarketplaceStats,
  CollectionStats,
  Collection,
} from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

function getOrCreateStats(): MarketplaceStats {
  let stats = MarketplaceStats.load("global");
  if (!stats) {
    stats = new MarketplaceStats("global");
    stats.totalCollections = BigInt.fromI32(0);
    stats.totalNFTs = BigInt.fromI32(0);
    stats.totalListed = BigInt.fromI32(0);
    stats.totalVolume = BigInt.fromI32(0);
    stats.totalSales = BigInt.fromI32(0);
  }
  return stats;
}

function getOrCreateCollectionStats(collectionId: string): CollectionStats {
  let stats = CollectionStats.load(collectionId);
  if (!stats) {
    stats = new CollectionStats(collectionId);
    stats.collection = collectionId;
    stats.totalVolume = BigInt.fromI32(0);
    stats.totalSales = BigInt.fromI32(0);

    // Link Collection.stats so queries from the Collection side also work
    let collection = Collection.load(collectionId);
    if (collection) {
      collection.stats = collectionId;
      collection.save();
    }
  }
  return stats;
}

export function handleItemListed(event: ItemListed): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString();

  let listing = new Listing(id);
  listing.nftContract = event.params.nftContract;
  listing.tokenId = event.params.tokenId;
  listing.seller = event.params.seller;
  listing.price = event.params.price;
  listing.active = true;
  listing.nft = id;
  listing.createdAt = event.block.timestamp;
  listing.updatedAt = event.block.timestamp;
  listing.save();

  let nft = NFT.load(id);
  if (nft) {
    nft.listing = id;
    nft.save();
  }

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "listing";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.seller;
  act.price = event.params.price;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();

  let stats = getOrCreateStats();
  stats.totalListed = stats.totalListed.plus(BigInt.fromI32(1));
  stats.save();

  // Ensure CollectionStats entity exists for this collection
  let colStats = getOrCreateCollectionStats(
    event.params.nftContract.toHexString()
  );
  colStats.save();
}

export function handleItemSold(event: ItemSold): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString();

  let listing = Listing.load(id);
  if (listing) {
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }

  let nft = NFT.load(id);
  if (nft) {
    nft.owner = event.params.buyer;
    nft.listing = null;
    nft.save();
  }

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "sale";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.seller;
  act.to = event.params.buyer;
  act.price = event.params.price;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();

  // Global stats
  let stats = getOrCreateStats();
  stats.totalSales = stats.totalSales.plus(BigInt.fromI32(1));
  stats.totalListed = stats.totalListed.minus(BigInt.fromI32(1));
  stats.totalVolume = stats.totalVolume.plus(event.params.price);
  stats.save();

  // Collection stats — all-time only (24h is computed on frontend via activityEvents)
  let colStats = getOrCreateCollectionStats(
    event.params.nftContract.toHexString()
  );
  colStats.totalSales = colStats.totalSales.plus(BigInt.fromI32(1));
  colStats.totalVolume = colStats.totalVolume.plus(event.params.price);
  colStats.save();
}

export function handleListingCancelled(event: ListingCancelled): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString();

  let listing = Listing.load(id);
  if (listing) {
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }

  let nft = NFT.load(id);
  if (nft) {
    nft.listing = null;
    nft.save();
  }

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "listing_cancelled";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.seller;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();

  let stats = getOrCreateStats();
  stats.totalListed = stats.totalListed.minus(BigInt.fromI32(1));
  stats.save();
}

export function handleOfferMade(event: OfferMade): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString() +
    "-" +
    event.params.buyer.toHexString();

  let nftId =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString();

  let offer = new Offer(id);
  offer.nftContract = event.params.nftContract;
  offer.tokenId = event.params.tokenId;
  offer.buyer = event.params.buyer;
  offer.amount = event.params.amount;
  offer.expiresAt = event.params.expiresAt;
  offer.active = true;
  offer.nft = nftId;
  offer.createdAt = event.block.timestamp;
  offer.save();

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "offer";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.buyer;
  act.price = event.params.amount;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();
}

export function handleOfferAccepted(event: OfferAccepted): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString() +
    "-" +
    event.params.buyer.toHexString();

  let offer = Offer.load(id);
  if (offer) {
    offer.active = false;
    offer.save();
  }

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "offer_accepted";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.seller;
  act.to = event.params.buyer;
  act.price = event.params.amount;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();

  let stats = getOrCreateStats();
  stats.totalSales = stats.totalSales.plus(BigInt.fromI32(1));
  stats.totalVolume = stats.totalVolume.plus(event.params.amount);
  stats.save();
}

export function handleOfferCancelled(event: OfferCancelled): void {
  let id =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString() +
    "-" +
    event.params.buyer.toHexString();

  let offer = Offer.load(id);
  if (offer) {
    offer.active = false;
    offer.save();
  }

  let actId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let act = new ActivityEvent(actId);
  act.type = "offer_cancelled";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.buyer;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();
}
