import { NFTMinted } from "../generated/templates/NFTCollection/NFTCollection";
import { NFT, Collection, ActivityEvent, MarketplaceStats } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleNFTMinted(event: NFTMinted): void {
  let collectionId = event.address.toHexString();
  let nftId = collectionId + "-" + event.params.tokenId.toString();

  let nft = new NFT(nftId);
  nft.tokenId = event.params.tokenId;
  nft.tokenUri = event.params.tokenUri;
  nft.owner = event.params.to;
  nft.collection = collectionId;
  nft.mintedAt = event.block.timestamp;
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
  let stats = MarketplaceStats.load("global");
  if (stats) {
    stats.totalNFTs = stats.totalNFTs.plus(BigInt.fromI32(1));
    stats.save();
  }
}
