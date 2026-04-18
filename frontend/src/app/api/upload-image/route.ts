import { type NextRequest, NextResponse } from "next/server";
import { PINATA_JWT as jwt } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";
import {
  MAX_UPLOAD_COMBINED_BYTES,
  runUploadGate,
  validateImageFile,
} from "@/lib/uploadSecurity";
import { peekErrorBody } from "@/lib/apiUpstream";

export async function POST(req: NextRequest) {
  const gate = await runUploadGate(
    req,
    UPLOAD_API_PATHS.image,
    MAX_UPLOAD_COMBINED_BYTES,
  );
  if (gate instanceof NextResponse) return gate;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File required." }, { status: 400 });
    }

    const invalid = validateImageFile(file);
    if (invalid) return invalid;

    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
    });

    if (!res.ok) {
      const preview = await peekErrorBody(res);
      logger.error("Pinata pinFile failed", undefined, {
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
    logger.error("upload-image route", error, { path: req.nextUrl.pathname });
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
