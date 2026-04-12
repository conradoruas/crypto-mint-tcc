import { CollectionCreated } from "../generated/NFTCollectionFactory/NFTCollectionFactory";
import { NFTCollectionFactory } from "../generated/NFTCollectionFactory/NFTCollectionFactory";
import { Collection } from "../generated/schema";
import { NFTCollection } from "../generated/templates";
import { BigInt } from "@graphprotocol/graph-ts";
import { getOrCreateStats } from "./helpers";

export function handleCollectionCreated(event: CollectionCreated): void {
  let id = event.params.contractAddress.toHexString();
  let collection = new Collection(id);
  collection.contractAddress = event.params.contractAddress;
  collection.creator = event.params.creator;
  collection.collectionId = event.params.collectionId;
  collection.createdAt = event.block.timestamp;
  collection.totalSupply = BigInt.fromI32(0);
  collection.mintSeedCommitted = false;
  collection.mintSeedRevealed = false;
  collection.revealed = false;

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

  // Start tracking NFTMinted + Transfer events for this new collection contract
  NFTCollection.create(event.params.contractAddress);

  // Update global stats
  let stats = getOrCreateStats();
  stats.totalCollections = stats.totalCollections.plus(BigInt.fromI32(1));
  stats.save();
}
