import { NextRequest, NextResponse } from "next/server";
import { PINATA_JWT as jwt } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";
import {
  MAX_UPLOAD_COMBINED_BYTES,
  runUploadGate,
  validateImageFile,
} from "@/lib/uploadSecurity";

export async function POST(req: NextRequest) {
  const gate = await runUploadGate(
    req,
    UPLOAD_API_PATHS.combined,
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

    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;

    if (name !== null && name.length > 500) {
      return NextResponse.json({ error: "Name too long." }, { status: 400 });
    }
    if (description !== null && description.length > 10000) {
      return NextResponse.json({ error: "Description too long." }, { status: 400 });
    }

    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const imageRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: pinataForm,
      },
    );

    if (!imageRes.ok) {
      logger.error("Pinata pinFile failed (combined)", undefined, {
        path: req.nextUrl.pathname,
        status: imageRes.status,
      });
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    const imageData = await imageRes.json();
    const imageHash = imageData.IpfsHash;
    if (!imageHash) {
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    if (!name) {
      return NextResponse.json({ uri: `ipfs://${imageHash}` });
    }

    const metadata = JSON.stringify({
      pinataContent: {
        name,
        description: description || "",
        image: `ipfs://${imageHash}`,
        attributes: [{ trait_type: "Criador", value: "Usuario TCC" }],
      },
      pinataMetadata: { name: `${name}_metadata.json` },
    });

    const jsonRes = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: metadata,
      },
    );

    if (!jsonRes.ok) {
      logger.error("Pinata pinJSON failed (combined)", undefined, {
        path: req.nextUrl.pathname,
        status: jsonRes.status,
      });
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    const jsonData = await jsonRes.json();
    if (!jsonData.IpfsHash) {
      return NextResponse.json({ error: "Upload failed." }, { status: 502 });
    }

    return NextResponse.json({ uri: `ipfs://${jsonData.IpfsHash}` });
  } catch (error) {
    logger.error("upload route", error, { path: req.nextUrl.pathname });
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
