import { CollectionCreated } from "../generated/NFTCollectionFactoryV2/NFTCollectionFactoryV2";
import { NFTCollectionFactoryV2 } from "../generated/NFTCollectionFactoryV2/NFTCollectionFactoryV2";
import { Collection } from "../generated/schema";
import { NFTCollectionV2, CollectionContractURI } from "../generated/templates";
import { BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import { getOrCreateStats } from "./helpers";

export function handleCollectionCreatedV2(event: CollectionCreated): void {
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
  collection.rarityFinalized = false;

  // Fetch full metadata from the v2 factory contract
  let factory = NFTCollectionFactoryV2.bind(event.address);
  let info = factory.try_getCollection(event.params.collectionId);

  if (!info.reverted) {
    collection.name = info.value.name;
    collection.symbol = info.value.symbol;
    collection.description = info.value.description;
    collection.image = info.value.image;
    collection.maxSupply = info.value.maxSupply;
    collection.mintPrice = info.value.mintPrice;
    collection.contractURI = info.value.contractURI;
  } else {
    collection.name = event.params.name;
    collection.symbol = "";
    collection.description = "";
    collection.image = "";
    collection.maxSupply = BigInt.fromI32(0);
    collection.mintPrice = BigInt.fromI32(0);
    collection.contractURI = event.params.contractURI;
  }

  collection.save();

  // Spawn a v2 NFT-events template for this collection contract
  NFTCollectionV2.create(event.params.contractAddress);

  // If a contractURI was provided, spawn the File Data Source to parse the trait schema
  let contractURI = collection.contractURI;
  if (contractURI && contractURI.length > 0) {
    let cid = extractIpfsCid(contractURI);
    if (cid.length > 0) {
      let ctx = new DataSourceContext();
      ctx.setString("collectionId", id);
      CollectionContractURI.createWithContext(cid, ctx);
    }
  }

  let stats = getOrCreateStats();
  stats.totalCollections = stats.totalCollections.plus(BigInt.fromI32(1));
  stats.save();
}

/** Extracts the raw CID from an ipfs:// URI.  Returns empty string on failure. */
export function extractIpfsCid(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.slice(7);
  }
  return "";
}
