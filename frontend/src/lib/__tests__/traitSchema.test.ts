import { describe, it, expect } from "vitest";
import { traitSchemaSchema, attributesForSchema, nftAttributesSchema } from "@/lib/traitSchema";
import type { TraitSchema, NftAttribute } from "@/types/traits";

// ─── traitSchemaSchema ────────────────────────────────────────────────────

const minimalEnumSchema: TraitSchema = {
  version: 1,
  fields: [{ key: "rarity", label: "Rarity", type: "enum", required: true, options: ["Common", "Rare"] }],
};

describe("traitSchemaSchema", () => {
  it("accepts a minimal valid enum schema", () => {
    expect(traitSchemaSchema.safeParse(minimalEnumSchema).success).toBe(true);
  });

  it("accepts all supported field types", () => {
    const schema = {
      version: 1,
      fields: [
        { key: "class", label: "Class", type: "enum", required: true, options: ["Mage", "Warrior"] },
        { key: "level", label: "Level", type: "number", required: true, min: 1, max: 10, integer: true },
        { key: "power", label: "Power", type: "number", required: false, min: 0, max: 100 },
        { key: "description", label: "Description", type: "string", required: false, maxLength: 200 },
        { key: "is_legendary", label: "Legendary", type: "boolean", required: false },
        { key: "created", label: "Created", type: "date", required: false },
      ],
    };
    expect(traitSchemaSchema.safeParse(schema).success).toBe(true);
  });

  it("rejects missing version field", () => {
    const r = traitSchemaSchema.safeParse({ fields: minimalEnumSchema.fields });
    expect(r.success).toBe(false);
  });

  it("rejects empty fields array", () => {
    const r = traitSchemaSchema.safeParse({ version: 1, fields: [] });
    expect(r.success).toBe(false);
  });

  it("rejects more than 32 fields", () => {
    const fields = Array.from({ length: 33 }, (_, i) => ({
      key: `f${i}`, label: `F${i}`, type: "string" as const, required: false,
    }));
    expect(traitSchemaSchema.safeParse({ version: 1, fields }).success).toBe(false);
  });

  it("rejects enum with no options", () => {
    const r = traitSchemaSchema.safeParse({
      version: 1,
      fields: [{ key: "k", label: "K", type: "enum", required: false, options: [] }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects enum with more than 64 options", () => {
    const r = traitSchemaSchema.safeParse({
      version: 1,
      fields: [{ key: "k", label: "K", type: "enum", required: false, options: Array.from({ length: 65 }, (_, i) => `opt${i}`) }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate keys (case-insensitive)", () => {
    const r = traitSchemaSchema.safeParse({
      version: 1,
      fields: [
        { key: "Class", label: "Class", type: "string", required: false },
        { key: "class", label: "Class2", type: "string", required: false },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("accepts unique keys with different cases in label but different keys", () => {
    const r = traitSchemaSchema.safeParse({
      version: 1,
      fields: [
        { key: "class", label: "Class", type: "string", required: false },
        { key: "weapon", label: "Weapon", type: "string", required: false },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects field key with illegal characters", () => {
    const r = traitSchemaSchema.safeParse({
      version: 1,
      fields: [{ key: "bad<key>", label: "Bad", type: "string", required: false }],
    });
    expect(r.success).toBe(false);
  });
});

// ─── nftAttributesSchema (item-level) ────────────────────────────────────

describe("nftAttributesSchema", () => {
  it("accepts valid mixed-type attributes", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 7, display_type: "number" },
      { trait_type: "legendary", value: true },
    ];
    expect(nftAttributesSchema.safeParse(attrs).success).toBe(true);
  });

  it("rejects more than 64 attributes", () => {
    const attrs = Array.from({ length: 65 }, (_, i) => ({ trait_type: `t${i}`, value: "v" }));
    expect(nftAttributesSchema.safeParse(attrs).success).toBe(false);
  });

  it("rejects attribute with empty trait_type", () => {
    expect(nftAttributesSchema.safeParse([{ trait_type: "", value: "v" }]).success).toBe(false);
  });
});

// ─── attributesForSchema ─────────────────────────────────────────────────

describe("attributesForSchema", () => {
  const schema: TraitSchema = {
    version: 1,
    fields: [
      { key: "class",  label: "Class",  type: "enum",    required: true,  options: ["Mage", "Warrior", "Rogue"] },
      { key: "level",  label: "Level",  type: "number",  required: true,  min: 1, max: 10, integer: true },
      { key: "power",  label: "Power",  type: "number",  required: false, min: 0, max: 100 },
      { key: "bio",    label: "Bio",    type: "string",  required: false, maxLength: 50 },
      { key: "active", label: "Active", type: "boolean", required: false },
      { key: "born",   label: "Born",   type: "date",    required: false },
    ],
  };

  const validator = attributesForSchema(schema);

  it("accepts a fully valid attributes array", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class",  value: "Mage"  },
      { trait_type: "level",  value: 5       },
      { trait_type: "power",  value: 75.5    },
      { trait_type: "bio",    value: "Hello" },
      { trait_type: "active", value: true    },
      { trait_type: "born",   value: "2024-01-01" },
    ];
    expect(validator.safeParse(attrs).success).toBe(true);
  });

  it("accepts when optional fields are absent", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Warrior" },
      { trait_type: "level", value: 3 },
    ];
    expect(validator.safeParse(attrs).success).toBe(true);
  });

  it("rejects when a required field is missing", () => {
    const attrs: NftAttribute[] = [{ trait_type: "level", value: 3 }];
    const r = validator.safeParse(attrs);
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range enum value", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Paladin" },
      { trait_type: "level", value: 1 },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects a number below min", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 0 },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects a number above max", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 11 },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects a non-integer when integer:true", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 2.5 },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects wrong type for number field", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: "five" },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects string exceeding maxLength", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 1 },
      { trait_type: "bio",   value: "X".repeat(51) },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects non-boolean for boolean field", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 1 },
      { trait_type: "active", value: "yes" },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("rejects invalid date string", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 1 },
      { trait_type: "born", value: "not-a-date" },
    ];
    expect(validator.safeParse(attrs).success).toBe(false);
  });

  it("accepts valid ISO-8601 date", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 1 },
      { trait_type: "born", value: "2024-03-15T10:00:00Z" },
    ];
    expect(validator.safeParse(attrs).success).toBe(true);
  });

  it("ignores unknown trait_type keys (not in schema)", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "class", value: "Mage" },
      { trait_type: "level", value: 1 },
      { trait_type: "unknown_key", value: "whatever" },
    ];
    expect(validator.safeParse(attrs).success).toBe(true);
  });

  it("is case-insensitive on trait_type keys", () => {
    const attrs: NftAttribute[] = [
      { trait_type: "Class", value: "Warrior" },
      { trait_type: "LEVEL", value: 5 },
    ];
    expect(validator.safeParse(attrs).success).toBe(true);
  });
});
