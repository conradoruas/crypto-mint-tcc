import { describe, it, expect } from "vitest";
import { parseUploadProfileBody } from "@/lib/uploadPayloadSchemas";
import type { Address } from "viem";

const SIGNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const COLL_ADDR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;

// ─── NFT metadata branch ─────────────────────────────────────────────────────

describe("parseUploadProfileBody — nft branch", () => {
  const validNft = {
    address: "nft-abc123",
    name: "Sky Mage #1",
    description: "A powerful sky mage",
    image: "ipfs://QmImage",
  };

  it("accepts valid NFT metadata without attributes", () => {
    const r = parseUploadProfileBody(validNft, SIGNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.kind).toBe("nft");
    expect(r.data.content).not.toHaveProperty("attributes");
  });

  it("accepts valid NFT metadata with attributes array", () => {
    const r = parseUploadProfileBody(
      {
        ...validNft,
        attributes: [
          { trait_type: "class", value: "Mage" },
          { trait_type: "level", value: 7, display_type: "number" },
        ],
      },
      SIGNER,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.data.content as { attributes?: unknown[] };
    expect(c.attributes).toHaveLength(2);
  });

  it("accepts boolean attribute value", () => {
    const r = parseUploadProfileBody(
      { ...validNft, attributes: [{ trait_type: "legendary", value: true }] },
      SIGNER,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects attribute array exceeding 64 items", () => {
    const attrs = Array.from({ length: 65 }, (_, i) => ({
      trait_type: `t${i}`,
      value: "v",
    }));
    const r = parseUploadProfileBody({ ...validNft, attributes: attrs }, SIGNER);
    expect(r.ok).toBe(false);
  });

  it("rejects attribute with trait_type longer than 128 chars", () => {
    const r = parseUploadProfileBody(
      {
        ...validNft,
        attributes: [{ trait_type: "x".repeat(129), value: "v" }],
      },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects empty attributes array (no items) — still accepted (optional)", () => {
    const r = parseUploadProfileBody(
      { ...validNft, attributes: [] },
      SIGNER,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.data.content as { attributes?: unknown[] };
    // Empty attributes should be omitted from the content
    expect(c.attributes).toBeUndefined();
  });

  it("strips attributes from pinned content when undefined", () => {
    const r = parseUploadProfileBody(validNft, SIGNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.content).not.toHaveProperty("attributes");
  });

  it("rejects extra unknown top-level fields", () => {
    const r = parseUploadProfileBody(
      { ...validNft, unknownField: "oops" },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });
});

// ─── Collection metadata branch ───────────────────────────────────────────────

describe("parseUploadProfileBody — collection branch", () => {
  const validColl = {
    address: `collection-${COLL_ADDR}`,
    name: "Sky Mages",
    image: "ipfs://QmCover",
    description: "A mage collection",
    trait_schema: {
      version: 1,
      fields: [{ key: "class", label: "Class", type: "enum", required: true, options: ["Mage"] }],
    },
  };

  it("accepts valid collection metadata with trait_schema", () => {
    const r = parseUploadProfileBody(validColl, SIGNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.kind).toBe("collection");
    const c = r.data.content as { trait_schema?: unknown; name: string };
    expect(c.name).toBe("Sky Mages");
    expect(c.trait_schema).toBeDefined();
  });

  it("accepts collection without trait_schema", () => {
    const { trait_schema: _ts, ...withoutSchema } = validColl;
    const r = parseUploadProfileBody(withoutSchema, SIGNER);
    expect(r.ok).toBe(true);
  });

  it("accepts collection with external_link and banner_image", () => {
    const r = parseUploadProfileBody(
      {
        ...validColl,
        external_link: "https://example.com",
        banner_image: "ipfs://QmBanner",
      },
      SIGNER,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects collection with invalid image URI", () => {
    const r = parseUploadProfileBody(
      { ...validColl, image: "javascript://evil" },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects collection with invalid external_link", () => {
    const r = parseUploadProfileBody(
      { ...validColl, external_link: "ftp://bad" },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects collection with name exceeding 200 chars", () => {
    const r = parseUploadProfileBody(
      { ...validColl, name: "x".repeat(201) },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects extra unknown fields on collection branch", () => {
    const r = parseUploadProfileBody(
      { ...validColl, bogusField: true },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects collection metadata with duplicate trait keys", () => {
    const r = parseUploadProfileBody(
      {
        ...validColl,
        trait_schema: {
          version: 1,
          fields: [
            { key: "class", label: "Class", type: "enum", required: true, options: ["Mage"] },
            { key: "Class", label: "Class Again", type: "enum", required: false, options: ["Warrior"] },
          ],
        },
      },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects collection metadata with malformed trait schema", () => {
    const r = parseUploadProfileBody(
      {
        ...validColl,
        trait_schema: {
          version: 1,
          fields: [{ key: "power", label: "Power", type: "number", required: false, min: "bad" }],
        },
      },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });

  it("produces a pinataFileName based on the collection address", () => {
    const r = parseUploadProfileBody(validColl, SIGNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.pinataFileName).toMatch(/^collection_/);
  });
});

// ─── User profile branch (regression: must still work) ───────────────────────

describe("parseUploadProfileBody — user branch (regression)", () => {
  const validUser = {
    address: SIGNER,
    name: "Alice",
    imageUri: "ipfs://QmAvatar",
    updatedAt: Math.floor(Date.now() / 1000),
  };

  it("accepts valid user profile", () => {
    const r = parseUploadProfileBody(validUser, SIGNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.kind).toBe("user");
  });

  it("rejects address mismatch", () => {
    const r = parseUploadProfileBody(
      { ...validUser, address: "0xcccccccccccccccccccccccccccccccccccccccc" as Address },
      SIGNER,
    );
    expect(r.ok).toBe(false);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("parseUploadProfileBody — edge cases", () => {
  it("rejects null body", () => {
    expect(parseUploadProfileBody(null, SIGNER).ok).toBe(false);
  });

  it("rejects array body", () => {
    expect(parseUploadProfileBody([], SIGNER).ok).toBe(false);
  });

  it("rejects missing address field", () => {
    expect(parseUploadProfileBody({ name: "x" }, SIGNER).ok).toBe(false);
  });
});
