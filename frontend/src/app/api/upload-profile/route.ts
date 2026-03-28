import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { PINATA_JWT as jwt } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";
import {
  MAX_JSON_UPLOAD_BYTES,
  runUploadGate,
} from "@/lib/uploadSecurity";

const profileBodySchema = z
  .object({
    address: z.string().min(1).max(200),
    name: z.string().max(500).optional(),
    description: z.string().max(10000).optional(),
    image: z.string().max(500).optional(),
    imageUri: z.string().max(500).optional(),
    updatedAt: z.number().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const gate = await runUploadGate(
    req,
    UPLOAD_API_PATHS.profile,
    MAX_JSON_UPLOAD_BYTES,
  );
  if (gate instanceof NextResponse) return gate;

  try {
    const raw = await req.text();
    if (raw.length > MAX_JSON_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Request body too large." },
        { status: 413 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const parsedBody = profileBodySchema.safeParse(parsed);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
    }

    const profile = parsedBody.data;

    if (isAddress(profile.address)) {
      if (profile.address.toLowerCase() !== gate.address.toLowerCase()) {
        return NextResponse.json(
          { error: "Profile address must match the signing wallet." },
          { status: 403 },
        );
      }
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: profile,
        pinataMetadata: {
          name: `profile_${profile.address.slice(0, 8)}.json`,
        },
      }),
    });

    if (!res.ok) {
      logger.error("Pinata pinJSON failed", undefined, {
        path: req.nextUrl.pathname,
        status: res.status,
      });
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    const data = await res.json();
    if (!data.IpfsHash) {
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    return NextResponse.json({ uri: `ipfs://${data.IpfsHash}` });
  } catch (error) {
    logger.error("upload-profile route", error, { path: req.nextUrl.pathname });
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
