import { json, Bytes, dataSource, log, BigDecimal } from "@graphprotocol/graph-ts";
import { Attribute } from "../generated/schema";

/**
 * File Data Source handler for TokenMetadata.
 *
 * Important Graph limitation:
 * file/ipfs handlers cannot load or update chain-based entities, and they also
 * cannot depend on entities created by other file data sources. This handler
 * therefore writes only per-token Attribute entities and links them back to the
 * chain-indexed NFT/Collection by ID.
 */
export function handleTokenMetadata(content: Bytes): void {
  let ctx = dataSource.context();
  let nftId = ctx.getString("nftId");
  let collectionId = ctx.getString("collectionId");

  let tryValue = json.try_fromBytes(content);
  if (tryValue.isError) {
    log.warning("TokenMetadata: invalid JSON for NFT {}", [nftId]);
    return;
  }

  let rootObj = tryValue.value.toObject();
  if (!rootObj) return;

  let attrsEntry = rootObj.get("attributes");
  if (!attrsEntry || attrsEntry.isNull()) return;

  let attrsArr = attrsEntry.toArray();
  if (!attrsArr) return;

  let tokenIdPart = nftId.split("-")[1];

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

    let attrId = collectionId + "-" + tokenIdPart + "-" + traitType;
    let attr = Attribute.load(attrId);
    if (!attr) {
      attr = new Attribute(attrId);
    }

    attr.nft = nftId;
    attr.collection = collectionId;
    attr.traitType = traitType;
    attr.displayType = displayType;

    // JSONValueKind: 0=Null, 1=Bool, 2=Number, 3=String, 4=Array, 5=Object
    if (valueEntry.kind == 2) {
      attr.valueNum = BigDecimal.fromString(valueEntry.toF64().toString());
      attr.valueStr = null;
    } else {
      attr.valueStr = valueEntry.toString();
      attr.valueNum = null;
    }

    attr.save();
  }
}
