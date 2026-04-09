import { BigInt } from "@graphprotocol/graph-ts";
import {
  MarketplaceStats,
  CollectionStat,
  DailyCollectionSnapshot,
  Collection,
  Listing,
} from "../generated/schema";

const SECONDS_PER_DAY = 86400;

export function getOrCreateStats(): MarketplaceStats {
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

export function getOrCreateCollectionStat(
  collectionId: string,
  timestamp: BigInt = BigInt.fromI32(0),
): CollectionStat {
  let stats = CollectionStat.load(collectionId);
  if (!stats) {
    stats = new CollectionStat(collectionId);
    stats.collection = collectionId;
    stats.totalVolume = BigInt.fromI32(0);
    stats.totalSales = BigInt.fromI32(0);
    stats.volume24h = BigInt.fromI32(0);
    stats.sales24h = BigInt.fromI32(0);
    stats.lastUpdated = timestamp;
    stats.floorPrice = null;
    stats.activeListingIds = [];

    // Link Collection.stats so queries from the Collection side also work
    let collection = Collection.load(collectionId);
    if (collection) {
      collection.stats = collectionId;
      collection.save();
    }
  } else {
    // Day-based reset: if we crossed into a new calendar day, zero the 24h counters.
    // This avoids the old "lazy reset" bug where counters accumulated indefinitely
    // when events arrived within <24h of each other.
    let currentDay = timestamp.div(BigInt.fromI32(SECONDS_PER_DAY));
    let lastDay = stats.lastUpdated.div(BigInt.fromI32(SECONDS_PER_DAY));
    if (currentDay.gt(lastDay)) {
      stats.volume24h = BigInt.fromI32(0);
      stats.sales24h = BigInt.fromI32(0);
      stats.lastUpdated = timestamp;
    }
  }
  return stats;
}

export function addActiveListing(colStats: CollectionStat, listingId: string): void {
  let ids = colStats.activeListingIds;
  ids.push(listingId);
  colStats.activeListingIds = ids;
}

export function removeActiveListingAndRecalcFloor(colStats: CollectionStat, listingId: string): void {
  let ids = colStats.activeListingIds;
  let newIds: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] != listingId) {
      newIds.push(ids[i]);
    }
  }
  colStats.activeListingIds = newIds;

  // Recalculate floor from remaining active listings
  let floor: BigInt | null = null;
  for (let i = 0; i < newIds.length; i++) {
    let listing = Listing.load(newIds[i]);
    if (listing && listing.active) {
      if (!floor || listing.price.lt(floor!)) {
        floor = listing.price;
      }
    }
  }
  colStats.floorPrice = floor;
}

export function getOrCreateDailySnapshot(
  collectionId: string,
  timestamp: BigInt,
): DailyCollectionSnapshot {
  let dayId = timestamp.div(BigInt.fromI32(SECONDS_PER_DAY));
  let id = collectionId + "-" + dayId.toString();

  let snapshot = DailyCollectionSnapshot.load(id);
  if (!snapshot) {
    snapshot = new DailyCollectionSnapshot(id);
    snapshot.collection = collectionId;
    snapshot.dayId = dayId;
    snapshot.date = dayId.times(BigInt.fromI32(SECONDS_PER_DAY));
    snapshot.volume = BigInt.fromI32(0);
    snapshot.sales = BigInt.fromI32(0);
  }
  return snapshot;
}
