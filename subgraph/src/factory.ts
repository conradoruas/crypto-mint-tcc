import { CollectionCreated } from "../generated/NFTCollectionFactory/NFTCollectionFactory";
import { NFTCollectionFactory } from "../generated/NFTCollectionFactory/NFTCollectionFactory";
import { Collection, MarketplaceStats } from "../generated/schema";
import { NFTCollection } from "../generated/templates";
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

export function handleCollectionCreated(event: CollectionCreated): void {
  let id = event.params.contractAddress.toHexString();
  let collection = new Collection(id);
  collection.contractAddress = event.params.contractAddress;
  collection.creator = event.params.creator;
  collection.collectionId = event.params.collectionId;
  collection.createdAt = event.block.timestamp;
  collection.totalSupply = BigInt.fromI32(0);

  // Fetch full metadata from the factory contract
  let factory = NFTCollectionFactory.bind(event.address);
  let info = factory.try_getCollection(event.params.collectionId);

  if (!info.reverted) {
    collection.name = info.value.name;
    collection.symbol = info.value.symbol;
    collection.description = info.value.description;
    collection.image = info.value.image;
    collection.maxSupply = info.value.maxSupply;
    collection.mintPrice = info.value.mintPrice;
  } else {
    collection.name = event.params.name;
    collection.symbol = "";
    collection.description = "";
    collection.image = "";
    collection.maxSupply = BigInt.fromI32(0);
    collection.mintPrice = BigInt.fromI32(0);
  }

  collection.save();

  // Start tracking NFTMinted events for this new collection contract
  NFTCollection.create(event.params.contractAddress);

  // Update global stats
  let stats = getOrCreateStats();
  stats.totalCollections = stats.totalCollections.plus(BigInt.fromI32(1));
  stats.save();
}
