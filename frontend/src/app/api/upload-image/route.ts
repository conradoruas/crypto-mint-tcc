import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 },
      );
    }

    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await res.json();

    if (!data.IpfsHash) {
      return NextResponse.json(
        { error: "IpfsHash não retornado" },
        { status: 500 },
      );
    }

    // ✅ Retorna direto o URI da imagem — sem metadados
    return NextResponse.json({ uri: `ipfs://${data.IpfsHash}` });
  } catch (error) {
    console.error("Erro no upload de imagem:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
