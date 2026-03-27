import { z } from "zod";

// ─── Shared ────────────────────────────────────────────────────────────────

const ethPrice = z
  .string()
  .min(1, "Price is required")
  .refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0.0001,
    "Minimum is 0.0001 ETH",
  );

// ─── Create Collection ─────────────────────────────────────────────────────

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(8, "Max 8 characters")
    .regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  description: z.string().max(500, "Max 500 characters").optional(),
  mintPrice: ethPrice,
});

export type CreateCollectionFields = z.infer<typeof createCollectionSchema>;
export type CreateCollectionErrors = Partial<
  Record<keyof CreateCollectionFields, string>
>;

// ─── List NFT ──────────────────────────────────────────────────────────────

export const listPriceSchema = z.object({ price: ethPrice });
export type ListPriceErrors = { price?: string };

// ─── Make Offer ────────────────────────────────────────────────────────────

export const offerAmountSchema = z.object({ amount: ethPrice });
export type OfferAmountErrors = { amount?: string };

// ─── Edit Profile ──────────────────────────────────────────────────────────

export const editProfileSchema = z.object({
  name: z
    .string()
    .max(50, "Max 50 characters")
    .regex(/^[^<>]*$/, "Invalid characters")
    .optional(),
});

export type EditProfileErrors = { name?: string };

// ─── Helper ────────────────────────────────────────────────────────────────

/** Parses a schema and returns a flat error map (field → first message). */
export function getZodErrors<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): Partial<Record<string, string>> {
  const result = schema.safeParse(data);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.errors.map((e) => [e.path[0] as string, e.message]),
  );
}
