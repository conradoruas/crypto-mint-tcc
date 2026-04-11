import {
  ItemListed,
  ItemSold,
  ListingCancelled,
  OfferMade,
  OfferAccepted,
  OfferCancelled,
  OfferExpiredRefund,
  MarketplaceFeeUpdated,
  FeesWithdrawn,
  RoyaltyPaid,
  RoyaltyPending,
  PendingWithdrawn,
} from "../generated/NFTMarketplace/NFTMarketplace";
import {
  NFT,
  Listing,
  Offer,
  ActivityEvent,
  FeeUpdate,
  AdminWithdrawal,
  RoyaltyPayment,
  PendingWithdrawalEvent,
  PendingBalance,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  getOrCreateStats,
  getOrCreateCollectionStat,
  getOrCreateDailySnapshot,
  addActiveListing,
  removeActiveListingAndRecalcFloor,
} from "./helpers";

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
  listing.collection = event.params.nftContract.toHexString();
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

  // Track active listing and update floor price
  let colStats = getOrCreateCollectionStat(
    event.params.nftContract.toHexString(),
    event.block.timestamp
  );
  addActiveListing(colStats, event.params.price);
  colStats.save();
}

function deactivateOfferForBuyer(nftId: string, buyer: Bytes): void {
  let offerId = nftId + "-" + buyer.toHexString();
  let offer = Offer.load(offerId);
  if (offer && offer.active) {
    offer.active = false;
    offer.save();
  }
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

  // Prevenção de oferta fantasma: o comprador pode ter uma oferta ativa neste NFT
  // (ex.: fez uma oferta e depois comprou pelo preço de listagem).
  // Como agora é proprietário, uma oferta própria deve ser invalidada no subgraph.
  deactivateOfferForBuyer(id, event.params.buyer);

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

  // Collection stats (with day-based 24h reset)
  let collectionId = event.params.nftContract.toHexString();
  let colStats = getOrCreateCollectionStat(collectionId, event.block.timestamp);
  colStats.totalSales = colStats.totalSales.plus(BigInt.fromI32(1));
  colStats.totalVolume = colStats.totalVolume.plus(event.params.price);
  colStats.sales24h = colStats.sales24h.plus(BigInt.fromI32(1));
  colStats.volume24h = colStats.volume24h.plus(event.params.price);

  // Remove sold listing and recalculate floor from remaining active listings
  removeActiveListingAndRecalcFloor(colStats, id);

  colStats.save();

  // Daily snapshot — bucketed aggregate for accurate historical queries
  let snapshot = getOrCreateDailySnapshot(collectionId, event.block.timestamp);
  snapshot.volume = snapshot.volume.plus(event.params.price);
  snapshot.sales = snapshot.sales.plus(BigInt.fromI32(1));
  snapshot.save();
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

    // Remove cancelled listing and recalculate floor from remaining active listings
    let collectionId = event.params.nftContract.toHexString();
    let colStats = getOrCreateCollectionStat(collectionId, event.block.timestamp);
    removeActiveListingAndRecalcFloor(colStats, id);
    colStats.save();
  }

  let nft = NFT.load(id);
  if (nft) {
    nft.listing = null;
    nft.save();
  }
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
  let nftId =
    event.params.nftContract.toHexString() +
    "-" +
    event.params.tokenId.toString();

  // 1. Desativa a oferta aceita e remove oferta própria do novo proprietário (para o caso de oferta prévia)
  deactivateOfferForBuyer(nftId, event.params.buyer);

  // 2. Transfere a propriedade do NFT para o comprador
  //    (aceitar oferta transfere o NFT — o owner precisa ser atualizado no subgraph)
  let nft = NFT.load(nftId);
  if (nft) {
    nft.owner = event.params.buyer;
    nft.listing = null;
    nft.save();
  }

  // 3. Se havia listagem ativa, desativa — o NFT mudou de dono
  let hadActiveListing = false;
  let listing = Listing.load(nftId);
  if (listing && listing.active) {
    hadActiveListing = true;
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
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

  // Global stats
  let stats = getOrCreateStats();
  stats.totalSales = stats.totalSales.plus(BigInt.fromI32(1));
  stats.totalVolume = stats.totalVolume.plus(event.params.amount);
  if (hadActiveListing) {
    stats.totalListed = stats.totalListed.minus(BigInt.fromI32(1));
  }
  stats.save();

  // Collection stats (with day-based 24h reset)
  let collectionId = event.params.nftContract.toHexString();
  let colStats = getOrCreateCollectionStat(collectionId, event.block.timestamp);
  colStats.totalSales = colStats.totalSales.plus(BigInt.fromI32(1));
  colStats.totalVolume = colStats.totalVolume.plus(event.params.amount);
  colStats.sales24h = colStats.sales24h.plus(BigInt.fromI32(1));
  colStats.volume24h = colStats.volume24h.plus(event.params.amount);

  // If there was an active listing, remove it and recalculate floor
  if (hadActiveListing) {
    removeActiveListingAndRecalcFloor(colStats, nftId);
  }

  colStats.save();

  // Daily snapshot — bucketed aggregate for accurate historical queries
  let snapshot = getOrCreateDailySnapshot(collectionId, event.block.timestamp);
  snapshot.volume = snapshot.volume.plus(event.params.amount);
  snapshot.sales = snapshot.sales.plus(BigInt.fromI32(1));
  snapshot.save();
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

export function handleOfferExpiredRefund(event: OfferExpiredRefund): void {
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
  act.type = "offer_expired_refund";
  act.nftContract = event.params.nftContract;
  act.tokenId = event.params.tokenId;
  act.from = event.params.buyer;
  act.price = event.params.amount;
  act.timestamp = event.block.timestamp;
  act.blockNumber = event.block.number;
  act.txHash = event.transaction.hash;
  act.save();
}

// ─── Admin / royalty audit trail ────────────────────────────────────────────

function eventId(txHash: Bytes, logIndex: BigInt): string {
  return txHash.toHexString() + "-" + logIndex.toString();
}

export function handleMarketplaceFeeUpdated(event: MarketplaceFeeUpdated): void {
  let rec = new FeeUpdate(eventId(event.transaction.hash, event.logIndex));
  rec.oldFee = event.params.oldFee;
  rec.newFee = event.params.newFee;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();
}

export function handleFeesWithdrawn(event: FeesWithdrawn): void {
  let rec = new AdminWithdrawal(eventId(event.transaction.hash, event.logIndex));
  rec.owner = event.params.owner;
  rec.amount = event.params.amount;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();
}

export function handleRoyaltyPaid(event: RoyaltyPaid): void {
  let rec = new RoyaltyPayment(eventId(event.transaction.hash, event.logIndex));
  rec.receiver = event.params.receiver;
  rec.amount = event.params.amount;
  rec.pushed = true;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();
}

export function handleRoyaltyPending(event: RoyaltyPending): void {
  // Audit log entry
  let rec = new RoyaltyPayment(eventId(event.transaction.hash, event.logIndex));
  rec.receiver = event.params.receiver;
  rec.amount = event.params.amount;
  rec.pushed = false;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();

  // Mutable balance — credit
  let balanceId = event.params.receiver.toHexString();
  let bal = PendingBalance.load(balanceId);
  if (bal == null) {
    bal = new PendingBalance(balanceId);
    bal.receiver = event.params.receiver;
    bal.balance = BigInt.zero();
  }
  bal.balance = bal.balance.plus(event.params.amount);
  bal.lastUpdated = event.block.timestamp;
  bal.save();
}

export function handlePendingWithdrawn(event: PendingWithdrawn): void {
  // Audit log entry
  let rec = new PendingWithdrawalEvent(
    eventId(event.transaction.hash, event.logIndex)
  );
  rec.receiver = event.params.receiver;
  rec.amount = event.params.amount;
  rec.timestamp = event.block.timestamp;
  rec.blockNumber = event.block.number;
  rec.txHash = event.transaction.hash;
  rec.save();

  // Mutable balance — debit (clamp to zero for defensive safety)
  let balanceId = event.params.receiver.toHexString();
  let bal = PendingBalance.load(balanceId);
  if (bal != null) {
    let next = bal.balance.minus(event.params.amount);
    if (next.lt(BigInt.zero())) {
      bal.balance = BigInt.zero();
    } else {
      bal.balance = next;
    }
    bal.lastUpdated = event.block.timestamp;
    bal.save();
  }
}
