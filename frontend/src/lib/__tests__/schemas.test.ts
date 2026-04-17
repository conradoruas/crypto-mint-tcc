import { describe, it, expect } from "vitest";
import {
  createCollectionSchema,
  listPriceSchema,
  offerAmountSchema,
  editProfileSchema,
  getZodErrors,
  ensureAddressOrZero,
  parseAddress,
} from "@/lib/schemas";

// ─── createCollectionSchema ─────────────────────────────────────────────────

describe("createCollectionSchema", () => {
  const valid = { name: "Test", symbol: "TST", mintPrice: "0.01" };

  it("accepts valid data", () => {
    expect(createCollectionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional description", () => {
    expect(
      createCollectionSchema.safeParse({ ...valid, description: "Hello" })
        .success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    const r = createCollectionSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects name exceeding 50 chars", () => {
    const r = createCollectionSchema.safeParse({
      ...valid,
      name: "A".repeat(51),
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty symbol", () => {
    const r = createCollectionSchema.safeParse({ ...valid, symbol: "" });
    expect(r.success).toBe(false);
  });

  it("rejects lowercase symbol", () => {
    const r = createCollectionSchema.safeParse({ ...valid, symbol: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects symbol exceeding 8 chars", () => {
    const r = createCollectionSchema.safeParse({
      ...valid,
      symbol: "ABCDEFGHI",
    });
    expect(r.success).toBe(false);
  });

  it("rejects price below 0.0001 ETH", () => {
    const r = createCollectionSchema.safeParse({
      ...valid,
      mintPrice: "0.00001",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric price", () => {
    const r = createCollectionSchema.safeParse({
      ...valid,
      mintPrice: "abc",
    });
    expect(r.success).toBe(false);
  });

  it("rejects description exceeding 500 chars", () => {
    const r = createCollectionSchema.safeParse({
      ...valid,
      description: "X".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

// ─── listPriceSchema ────────────────────────────────────────────────────────

describe("listPriceSchema", () => {
  it("accepts valid price", () => {
    expect(listPriceSchema.safeParse({ price: "1.5" }).success).toBe(true);
  });

  it("accepts minimum price (0.0001)", () => {
    expect(listPriceSchema.safeParse({ price: "0.0001" }).success).toBe(true);
  });

  it("rejects empty price", () => {
    expect(listPriceSchema.safeParse({ price: "" }).success).toBe(false);
  });

  it("rejects price below minimum", () => {
    expect(listPriceSchema.safeParse({ price: "0.00001" }).success).toBe(
      false,
    );
  });
});

// ─── offerAmountSchema ──────────────────────────────────────────────────────

describe("offerAmountSchema", () => {
  it("accepts valid amount", () => {
    expect(offerAmountSchema.safeParse({ amount: "0.5" }).success).toBe(true);
  });

  it("rejects empty amount", () => {
    expect(offerAmountSchema.safeParse({ amount: "" }).success).toBe(false);
  });

  it("rejects amount below minimum", () => {
    expect(offerAmountSchema.safeParse({ amount: "0.00001" }).success).toBe(
      false,
    );
  });
});

// ─── editProfileSchema ─────────────────────────────────────────────────────

describe("editProfileSchema", () => {
  it("accepts valid name", () => {
    expect(editProfileSchema.safeParse({ name: "Alice" }).success).toBe(true);
  });

  it("accepts empty object (optional name)", () => {
    expect(editProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects name with angle brackets", () => {
    expect(
      editProfileSchema.safeParse({ name: "<script>" }).success,
    ).toBe(false);
  });

  it("rejects name exceeding 50 chars", () => {
    expect(
      editProfileSchema.safeParse({ name: "X".repeat(51) }).success,
    ).toBe(false);
  });
});

// ─── getZodErrors ───────────────────────────────────────────────────────────

describe("getZodErrors", () => {
  it("returns empty object for valid data", () => {
    const errors = getZodErrors(listPriceSchema, { price: "1.0" });
    expect(errors).toEqual({});
  });

  it("returns field → message map for invalid data", () => {
    const errors = getZodErrors(listPriceSchema, { price: "" });
    expect(errors).toHaveProperty("price");
    expect(typeof errors.price).toBe("string");
  });

  it("returns multiple errors for multiple invalid fields", () => {
    const errors = getZodErrors(createCollectionSchema, {
      name: "",
      symbol: "",
      mintPrice: "",
    });
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(3);
  });
});

// ─── ensureAddressOrZero ──────────────────────────────────────────────────────────

describe("ensureAddressOrZero", () => {
  it("returns valid address unchanged", () => {
    const addr = "0x0000000000000000000000000000000000000001";
    expect(ensureAddressOrZero(addr)).toBe(addr);
  });

  it("returns zero address for undefined", () => {
    expect(ensureAddressOrZero(undefined)).toBe(
      "0x0000000000000000000000000000000000000000",
    );
  });

  it("returns zero address for null", () => {
    expect(ensureAddressOrZero(null)).toBe(
      "0x0000000000000000000000000000000000000000",
    );
  });

  it("returns zero address for invalid string", () => {
    expect(ensureAddressOrZero("not-an-address")).toBe(
      "0x0000000000000000000000000000000000000000",
    );
  });
});

// ─── parseAddress ───────────────────────────────────────────────────────────

describe("parseAddress", () => {
  it("returns valid address", () => {
    const addr = "0x0000000000000000000000000000000000000001";
    expect(parseAddress(addr)).toBe(addr);
  });

  it("returns undefined for invalid string", () => {
    expect(parseAddress("not-an-address")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(parseAddress(undefined)).toBeUndefined();
  });

  it("returns undefined for null input", () => {
    expect(parseAddress(null)).toBeUndefined();
  });
});
