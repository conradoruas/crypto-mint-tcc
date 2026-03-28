/**
 * Server-only upload payload validation.
 * Parsed values are mapped into new objects — never pass client JSON through to Pinata as-is.
 */

import { z } from "zod";
import { isAddress, type Address } from "viem";

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}

function trimMax(s: string, max: number): string {
  return stripControlChars(s.trim()).slice(0, max);
}

/** Empty string allowed; otherwise ipfs://… or http(s)://… */
export function isSafeAssetUri(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return true;
  if (t.length > 500) return false;
  if (t.startsWith("ipfs://")) {
    return !CONTROL_CHARS.test(t);
  }
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Batch NFT metadata id: `nft-<alphanumeric, dash, underscore>` */
const nftBatchAddressSchema = z
  .string()
  .regex(/^nft-[a-zA-Z0-9_-]{1,120}$/, "Invalid metadata batch id");

const userProfileInSchema = z
  .object({
    address: z.string().refine((a): a is Address => isAddress(a), {
      message: "Invalid wallet address",
    }),
    name: z.string().max(50),
    imageUri: z.string().max(500).optional(),
    updatedAt: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const nftMetadataInSchema = z
  .object({
    address: nftBatchAddressSchema,
    name: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    image: z.string().min(1).max(500),
  })
  .strict();

export type PinataUserProfileContent = {
  address: string;
  name: string;
  imageUri: string;
  updatedAt: number;
};

export type PinataNftMetadataContent = {
  address: string;
  name: string;
  description: string;
  image: string;
};

export type ParsedUploadProfile =
  | { kind: "user"; content: PinataUserProfileContent; pinataFileName: string }
  | { kind: "nft"; content: PinataNftMetadataContent; pinataFileName: string };

/**
 * Validates JSON body and returns only server-built Pinata payloads.
 * Rejects unknown keys via separate .strict() schemas per variant.
 */
export function parseUploadProfileBody(
  raw: unknown,
  signerAddress: Address,
):
  | { ok: true; data: ParsedUploadProfile }
  | { ok: false; error: z.ZodError | { message: string } } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: { message: "Body must be a JSON object." } };
  }

  const o = raw as Record<string, unknown>;
  const addrRaw = o.address;

  if (typeof addrRaw !== "string" || !addrRaw.length) {
    return { ok: false, error: { message: "Missing address." } };
  }

  if (isAddress(addrRaw)) {
    const user = userProfileInSchema.safeParse(raw);
    if (!user.success) return { ok: false, error: user.error };

    if (user.data.address.toLowerCase() !== signerAddress.toLowerCase()) {
      return {
        ok: false,
        error: { message: "Profile address must match the signing wallet." },
      };
    }

    const name = trimMax(user.data.name, 50);
    const imageUri = trimMax(user.data.imageUri ?? "", 500);
    if (!isSafeAssetUri(imageUri)) {
      return { ok: false, error: { message: "Invalid image URI." } };
    }

    const content: PinataUserProfileContent = {
      address: user.data.address,
      name,
      imageUri,
      updatedAt: user.data.updatedAt,
    };

    const short = user.data.address.slice(2, 10).toLowerCase();
    return {
      ok: true,
      data: {
        kind: "user",
        content,
        pinataFileName: `profile_${short}.json`,
      },
    };
  }

  const nft = nftMetadataInSchema.safeParse(raw);
  if (!nft.success) return { ok: false, error: nft.error };

  const name = trimMax(nft.data.name, 500);
  const description = trimMax(nft.data.description ?? "", 10000);
  const image = trimMax(nft.data.image, 500);
  if (!isSafeAssetUri(image)) {
    return { ok: false, error: { message: "Invalid image URI." } };
  }

  const content: PinataNftMetadataContent = {
    address: nft.data.address,
    name,
    description,
    image,
  };

  const safeId = nft.data.address.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return {
    ok: true,
    data: {
      kind: "nft",
      content,
      pinataFileName: `nftmeta_${safeId || "batch"}.json`,
    },
  };
}

// ─── Combined multipart (/api/upload) — fields only, file validated separately ───

export function parseCombinedUploadFields(name: unknown, description: unknown):
  | { ok: true; name: string | undefined; description: string | undefined }
  | { ok: false; error: z.ZodError } {
  const n = name == null ? "" : typeof name === "string" ? name : String(name);
  const d =
    description == null ? "" : typeof description === "string" ? description : String(description);

  const schema = z.object({
    name: z.string().max(500).transform((s) => trimMax(s, 500)),
    description: z.string().max(10000).transform((s) => trimMax(s, 10000)),
  });

  const result = schema.safeParse({ name: n, description: d });
  if (!result.success) return { ok: false, error: result.error };

  const nameOut =
    result.data.name.length === 0 ? undefined : result.data.name;
  const descOut =
    result.data.description.length === 0 ? undefined : result.data.description;

  return { ok: true, name: nameOut, description: descOut };
}
