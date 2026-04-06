import { BigInt } from "@graphprotocol/graph-ts";
import {
  MarketplaceStats,
  CollectionStats,
  DailyCollectionSnapshot,
  Collection,
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

export function getOrCreateCollectionStats(
  collectionId: string,
  timestamp: BigInt = BigInt.fromI32(0),
): CollectionStats {
  let stats = CollectionStats.load(collectionId);
  if (!stats) {
    stats = new CollectionStats(collectionId);
    stats.collection = collectionId;
    stats.totalVolume = BigInt.fromI32(0);
    stats.totalSales = BigInt.fromI32(0);
    stats.volume24h = BigInt.fromI32(0);
    stats.sales24h = BigInt.fromI32(0);
    stats.lastUpdated = timestamp;
    stats.floorPrice = null;

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
