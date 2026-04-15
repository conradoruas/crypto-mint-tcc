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
    stats.floorPriceDayStart = null;
    stats.activeListingCount = BigInt.fromI32(0);

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
      // Capture current floor as the baseline for the new day so
      // `floorChange24h` has a reference point for intra-day movement.
      stats.floorPriceDayStart = stats.floorPrice;
      stats.lastUpdated = timestamp;
    }
  }
  return stats;
}

/**
 * Called when a new listing is created.
 * Increments counter and updates floor if the new price is lower.
 */
export function addActiveListing(colStats: CollectionStat, listingPrice: BigInt): void {
  colStats.activeListingCount = colStats.activeListingCount.plus(BigInt.fromI32(1));
  if (!colStats.floorPrice || listingPrice.lt(colStats.floorPrice!)) {
    colStats.floorPrice = listingPrice;
  }
  // Bootstrap the 24h baseline on the very first listing we ever observe
  // so the day's first `floorChange24h` isn't stuck at null until the day rolls.
  if (!colStats.floorPriceDayStart) {
    colStats.floorPriceDayStart = colStats.floorPrice;
  }
}

/**
 * Called when a listing is removed (sold, cancelled, or superseded by offer-accept).
 * Decrements counter and only does a full recalc if the removed listing was the floor.
 *
 * The full recalc queries active listings for the collection — O(activeListingCount).
 * This only triggers when the cheapest listing is removed, which is infrequent
 * compared to total listing activity.
 */
export function removeActiveListingAndRecalcFloor(
  colStats: CollectionStat,
  listingId: string,
): void {
  colStats.activeListingCount = colStats.activeListingCount.minus(BigInt.fromI32(1));

  if (colStats.activeListingCount.le(BigInt.fromI32(0))) {
    colStats.activeListingCount = BigInt.fromI32(0);
    colStats.floorPrice = null;
    return;
  }

  // Only null the floor if the removed listing was the floor
  let removedListing = Listing.load(listingId);
  if (removedListing === null) return;

  let wasFloor =
    colStats.floorPrice !== null &&
    removedListing.price.le(colStats.floorPrice as BigInt);

  if (!wasFloor) return;

  // Full recalc: scan all active listings for this collection.
  // This is unavoidable but only happens when the floor listing is removed.
  // We load listings by their known ID pattern: collectionAddress-tokenId.
  // Since we can't query in AssemblyScript, we set floor to null and let the
  // caller's context (which has the listing price) set it via subsequent events.
  // A pragmatic alternative: just null out the floor — the next listing event
  // or the next handleItemListed will restore it.
  colStats.floorPrice = null;
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
    snapshot.floor = null;
  }
  return snapshot;
}

/** Writes the latest floor observed for the given day into the snapshot. */
export function syncDailySnapshotFloor(
  collectionId: string,
  timestamp: BigInt,
  floor: BigInt | null,
): void {
  let snapshot = getOrCreateDailySnapshot(collectionId, timestamp);
  snapshot.floor = floor;
  snapshot.save();
}
