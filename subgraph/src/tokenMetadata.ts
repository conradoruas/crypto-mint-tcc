import { json, Bytes, dataSource, log, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { NFT, Attribute, TraitOption, TraitDefinition, Collection } from "../generated/schema";
import { _safeOptionId } from "./collectionMetadata";

/**
 * File Data Source handler for TokenMetadata.
 * Receives the raw bytes of a token's IPFS metadata JSON and parses the
 * `attributes` array into Attribute entities.  Also accumulates TraitOption
 * counts and updates the NFT's pre-computed rarityScore.
 *
 * Expected JSON shape (OpenSea ERC-721 metadata standard):
 * {
 *   "name": "...",
 *   "description": "...",
 *   "image": "ipfs://...",
 *   "attributes": [
 *     { "trait_type": "class", "value": "Mage" },
 *     { "trait_type": "level", "value": 7, "display_type": "number" },
 *     ...
 *   ]
 * }
 */
export function handleTokenMetadata(content: Bytes): void {
  let ctx = dataSource.context();
  let nftId = ctx.getString("nftId");
  let collectionId = ctx.getString("collectionId");

  let nft = NFT.load(nftId);
  if (!nft) {
    log.warning("TokenMetadata: NFT not found for id {}", [nftId]);
    return;
  }

  let tryValue = json.try_fromBytes(content);
  if (tryValue.isError) {
    log.warning("TokenMetadata: invalid JSON for NFT {}", [nftId]);
    nft.metadataResolved = false;
    nft.save();
    return;
  }

  let rootObj = tryValue.value.toObject();
  if (!rootObj) {
    nft.metadataResolved = false;
    nft.save();
    return;
  }

  let attrsEntry = rootObj.get("attributes");
  if (!attrsEntry || attrsEntry.isNull()) {
    nft.metadataResolved = true;
    nft.save();
    return;
  }

  let attrsArr = attrsEntry.toArray();
  if (!attrsArr) {
    nft.metadataResolved = true;
    nft.save();
    return;
  }

  let col = Collection.load(collectionId);
  let supply = col
    ? col.totalSupply.toBigDecimal()
    : BigDecimal.fromString("1");

  let rarityScore = BigDecimal.fromString("0");

  for (let i = 0; i < attrsArr.length; i++) {
    let attrObj = attrsArr[i].toObject();
    if (!attrObj) continue;

    let traitTypeEntry = attrObj.get("trait_type");
    let valueEntry = attrObj.get("value");
    if (!traitTypeEntry || !valueEntry) continue;

    let traitType = traitTypeEntry.toString();
    let displayTypeEntry = attrObj.get("display_type");
    let displayType = displayTypeEntry && !displayTypeEntry.isNull()
      ? displayTypeEntry.toString()
      : null;

    let attrId = collectionId + "-" + nftId.split("-")[1] + "-" + traitType;
    let attr = Attribute.load(attrId);
    if (!attr) {
      attr = new Attribute(attrId);
    }
    attr.nft = nftId;
    attr.collection = collectionId;
    attr.traitType = traitType;
    attr.displayType = displayType;

    // Determine whether value is string or number
    let valueKind = valueEntry.kind;
    // JSONValueKind: 0=Null, 1=Bool, 2=Number, 3=String, 4=Array, 5=Object
    if (valueKind == 2) {
      // number
      let num = valueEntry.toF64();
      attr.valueNum = BigDecimal.fromString(num.toString());
      attr.valueStr = null;
    } else {
      // string or bool — store as string
      let strVal = valueEntry.toString();
      attr.valueStr = strVal;
      attr.valueNum = null;

      // Accumulate TraitOption count for string/enum/boolean traits
      let optId = _safeOptionId(collectionId, traitType, strVal);
      let opt = TraitOption.load(optId);
      if (!opt) {
        // Unknown option (string/boolean not in enum schema) — create on the fly
        let defId = collectionId + "-" + traitType.toLowerCase();
        let def = TraitDefinition.load(defId);
        opt = new TraitOption(optId);
        opt.definition = defId;
        opt.collection = collectionId;
        opt.value = strVal;
        opt.count = BigInt.fromI32(0);
        opt.frequency = BigDecimal.fromString("0");
        // Only save if the definition exists (don't create orphan options)
        if (!def) {
          attr.save();
          continue;
        }
      }
      opt.count = opt.count.plus(BigInt.fromI32(1));
      // frequency = count / totalSupply (approximate; recomputed at reveal)
      if (supply.gt(BigDecimal.fromString("0"))) {
        opt.frequency = opt.count.toBigDecimal().div(supply);
      }
      opt.save();

      // Rarity contribution: totalSupply / count (higher = rarer)
      if (opt.count.gt(BigInt.fromI32(0)) && supply.gt(BigDecimal.fromString("0"))) {
        let contrib = supply.div(opt.count.toBigDecimal());
        rarityScore = rarityScore.plus(contrib);
      }
    }

    attr.save();
  }

  // Pre-accumulate rarityScore so handleRevealedV2 can use it directly
  nft.rarityScore = rarityScore;
  nft.metadataResolved = true;
  nft.save();
}

