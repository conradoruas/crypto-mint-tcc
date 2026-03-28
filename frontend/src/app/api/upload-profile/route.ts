import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PINATA_JWT as jwt } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";
import {
  MAX_JSON_UPLOAD_BYTES,
  runUploadGate,
} from "@/lib/uploadSecurity";
import { parseUploadProfileBody } from "@/lib/uploadPayloadSchemas";
import { peekErrorBody } from "@/lib/apiUpstream";

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

    const result = parseUploadProfileBody(parsed, gate.address);
    if (!result.ok) {
      if (result.error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
      }
      const msg = result.error.message;
      const status =
        msg === "Profile address must match the signing wallet." ? 403 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    const { content, pinataFileName } = result.data;

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: { name: pinataFileName },
      }),
    });

    if (!res.ok) {
      const preview = await peekErrorBody(res);
      logger.error("Pinata pinJSON failed", undefined, {
        path: req.nextUrl.pathname,
        status: res.status,
        bodyPreview: preview,
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
