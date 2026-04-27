import { json, Bytes, dataSource, log, BigInt, BigDecimal, ByteArray, crypto } from "@graphprotocol/graph-ts";
import { Collection, TraitDefinition, TraitOption } from "../generated/schema";

/**
 * File Data Source handler for CollectionContractURI.
 * Receives the raw bytes of the collection's contractURI IPFS JSON and
 * parses the `trait_schema.fields` array into TraitDefinition + TraitOption entities.
 *
 * Expected JSON shape:
 * {
 *   "name": "...", "image": "...",
 *   "trait_schema": {
 *     "version": 1,
 *     "fields": [
 *       { "key": "class", "label": "Class", "type": "enum", "required": true, "options": ["Mage","Warrior"] },
 *       { "key": "level", "label": "Level", "type": "number", "required": true, "min": 1, "max": 10 },
 *       ...
 *     ]
 *   }
 * }
 */
export function handleCollectionContractURI(content: Bytes): void {
  let ctx = dataSource.context();
  let collectionId = ctx.getString("collectionId");

  let collection = Collection.load(collectionId);
  if (!collection) {
    log.warning("CollectionContractURI: collection not found for id {}", [collectionId]);
    return;
  }

  // Parse JSON defensively
  let tryValue = json.try_fromBytes(content);
  if (tryValue.isError) {
    log.warning("CollectionContractURI: invalid JSON for collection {}", [collectionId]);
    return;
  }

  let rootObj = tryValue.value.toObject();
  if (!rootObj) return;

  // Parse trait_schema.fields
  let schemaEntry = rootObj.get("trait_schema");
  if (!schemaEntry || schemaEntry.isNull()) {
    collection.save();
    return;
  }

  let schemaObj = schemaEntry.toObject();
  if (!schemaObj) {
    collection.save();
    return;
  }

  let fieldsEntry = schemaObj.get("fields");
  if (!fieldsEntry || fieldsEntry.isNull()) {
    collection.save();
    return;
  }

  let fieldsArr = fieldsEntry.toArray();
  if (!fieldsArr) {
    collection.save();
    return;
  }

  for (let i = 0; i < fieldsArr.length; i++) {
    let fieldObj = fieldsArr[i].toObject();
    if (!fieldObj) continue;

    let keyEntry = fieldObj.get("key");
    let labelEntry = fieldObj.get("label");
    let typeEntry = fieldObj.get("type");
    let requiredEntry = fieldObj.get("required");

    if (!keyEntry || !labelEntry || !typeEntry) continue;

    let key = keyEntry.toString();
    let label = labelEntry.toString();
    let fieldType = typeEntry.toString();
    let required = requiredEntry ? requiredEntry.toBool() : false;

    let defId = collectionId + "-" + key;
    let def = TraitDefinition.load(defId);
    if (!def) {
      def = new TraitDefinition(defId);
    }
    def.collection = collectionId;
    def.key = key;
    def.label = label;
    def.type = fieldType;
    def.required = required;
    def.position = i;

    // Number bounds
    if (fieldType == "number") {
      let minEntry = fieldObj.get("min");
      let maxEntry = fieldObj.get("max");
      if (minEntry && !minEntry.isNull()) {
        def.minValue = BigDecimal.fromString(minEntry.toF64().toString());
      }
      if (maxEntry && !maxEntry.isNull()) {
        def.maxValue = BigDecimal.fromString(maxEntry.toF64().toString());
      }
    }

    def.save();

    // Enum options → pre-create TraitOption entities with count=0
    if (fieldType == "enum") {
      let optionsEntry = fieldObj.get("options");
      if (optionsEntry && !optionsEntry.isNull()) {
        let optionsArr = optionsEntry.toArray();
        if (optionsArr) {
          for (let j = 0; j < optionsArr.length; j++) {
            let optValue = optionsArr[j].toString();
            let optId = _safeOptionId(collectionId, key, optValue);
            let opt = TraitOption.load(optId);
            if (!opt) {
              opt = new TraitOption(optId);
              opt.count = BigInt.fromI32(0);
              opt.frequency = BigDecimal.fromString("0");
            }
            opt.definition = defId;
            opt.collection = collectionId;
            opt.value = optValue;
            opt.save();
          }
        }
      }
    }
  }

  collection.save();
}

/** Builds a safe ID for a TraitOption that avoids special chars. */
export function _safeOptionId(collectionId: string, key: string, value: string): string {
  let digest = crypto.keccak256(ByteArray.fromUTF8(value)).toHexString();
  return collectionId + "-" + key.toLowerCase() + "-" + digest;
}
