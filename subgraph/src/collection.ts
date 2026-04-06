import { NFTMinted, Transfer } from "../generated/templates/NFTCollection/NFTCollection";
import { NFT, Collection, ActivityEvent } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { getOrCreateStats } from "./helpers";

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
    nft.owner = event.params.to;
    nft.save();
  }
}
