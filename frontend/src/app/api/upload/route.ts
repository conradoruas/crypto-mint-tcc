import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 },
      );
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
      const err = await imageRes.text();
      return NextResponse.json(
        { error: `Pinata Image Error: ${err}` },
        { status: 500 },
      );
    }

    const imageData = await imageRes.json();
    const imageHash = imageData.IpfsHash;

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
      const err = await jsonRes.text();
      return NextResponse.json(
        { error: `Pinata JSON Error: ${err}` },
        { status: 500 },
      );
    }

    const jsonData = await jsonRes.json();
    return NextResponse.json({ uri: `ipfs://${jsonData.IpfsHash}` });
  } catch (error) {
    console.error("Erro na route de upload:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 },
    );
  }
}
