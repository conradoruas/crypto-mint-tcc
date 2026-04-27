import { z } from "zod";
import type { TraitSchema, NftAttribute } from "@/types/traits";

// ─── Field-type sub-schemas ────────────────────────────────────────────────

const traitFieldBase = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\- ]+$/, "Key must be alphanumeric, underscore, hyphen or space"),
  label: z.string().min(1).max(64),
  required: z.boolean(),
});

const traitFieldStringSchema = traitFieldBase.extend({
  type: z.literal("string"),
  maxLength: z.number().int().positive().max(1000).optional(),
});

const traitFieldNumberSchema = traitFieldBase.extend({
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
  displayType: z.enum(["number", "boost_number", "boost_percentage"]).optional(),
});

const traitFieldEnumSchema = traitFieldBase.extend({
  type: z.literal("enum"),
  options: z
    .array(z.string().min(1).max(128))
    .min(1, "Enum must have at least one option")
    .max(64, "Max 64 enum options"),
});

const traitFieldBooleanSchema = traitFieldBase.extend({
  type: z.literal("boolean"),
});

const traitFieldDateSchema = traitFieldBase.extend({
  type: z.literal("date"),
});

const traitFieldSchema = z.discriminatedUnion("type", [
  traitFieldStringSchema,
  traitFieldNumberSchema,
  traitFieldEnumSchema,
  traitFieldBooleanSchema,
  traitFieldDateSchema,
]);

// ─── Collection trait schema ──────────────────────────────────────────────

export const traitSchemaSchema = z
  .object({
    version: z.literal(1),
    fields: z
      .array(traitFieldSchema)
      .min(1, "Schema must have at least one field")
      .max(32, "Max 32 trait fields"),
  })
  .superRefine((data, ctx) => {
    const keys = data.fields.map((f) => f.key.toLowerCase());
    const seen = new Set<string>();
    for (let i = 0; i < keys.length; i++) {
      if (seen.has(keys[i])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", i, "key"],
          message: `Duplicate trait key: "${data.fields[i].key}"`,
        });
      }
      seen.add(keys[i]);
    }
  });

export function normalizeTraitKey(value: string): string {
  return value.trim().toLowerCase();
}

// ─── Per-NFT attributes validator ────────────────────────────────────────

const nftAttributeItemSchema = z.object({
  trait_type: z.string().min(1).max(128),
  value: z.union([z.string(), z.number(), z.boolean()]),
  display_type: z.string().max(64).optional(),
  max_value: z.number().optional(),
});

export const nftAttributesSchema = z.array(nftAttributeItemSchema).max(64);

/**
 * Returns a validator that checks an `attributes[]` array against the
 * provided collection trait schema.  Validates type, required presence,
 * numeric bounds, enum membership, and ISO-8601 dates.
 */
export function attributesForSchema(schema: TraitSchema): z.ZodType<NftAttribute[]> {
  const fieldMap = new Map(schema.fields.map((f) => [normalizeTraitKey(f.key), f]));

  return nftAttributesSchema.superRefine((attrs, ctx) => {
    const present = new Set<string>();

    for (const field of schema.fields) {
      if (field.required && !attrs.some((a) => normalizeTraitKey(a.trait_type) === normalizeTraitKey(field.key))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Required trait "${field.label}" is missing`,
          path: [],
        });
      }
    }

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const traitKey = normalizeTraitKey(attr.trait_type);
      if (present.has(traitKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate trait "${attr.trait_type}"`,
          path: [i, "trait_type"],
        });
      }
      present.add(traitKey);

      const field = fieldMap.get(traitKey);
      if (!field) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown trait "${attr.trait_type}"`,
          path: [i, "trait_type"],
        });
        continue;
      }

      const v = attr.value;
      const path = [i, "value"] as (string | number)[];

      if (field.type === "string") {
        if (typeof v !== "string") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be a string`, path });
        } else if (field.maxLength && v.length > field.maxLength) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" exceeds max length of ${field.maxLength}`, path });
        }
      } else if (field.type === "number") {
        if (typeof v !== "number") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be a number`, path });
        } else {
          if (field.integer && !Number.isInteger(v)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be an integer`, path });
          }
          if (field.min !== undefined && v < field.min) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be ≥ ${field.min}`, path });
          }
          if (field.max !== undefined && v > field.max) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be ≤ ${field.max}`, path });
          }
        }
      } else if (field.type === "enum") {
        if (typeof v !== "string") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be a string`, path });
        } else if (!field.options.includes(v)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${field.label}" must be one of: ${field.options.join(", ")}`,
            path,
          });
        }
      } else if (field.type === "boolean") {
        if (typeof v !== "boolean") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be a boolean`, path });
        }
      } else if (field.type === "date") {
        if (typeof v !== "string" || isNaN(Date.parse(v))) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${field.label}" must be a valid ISO-8601 date string`, path });
        }
      }
    }
  }) as z.ZodType<NftAttribute[]>;
}
