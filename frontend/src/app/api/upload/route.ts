import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  try {
    const formData = await req.formData();

    // Cria um novo FormData só com o arquivo para o Pinata
    const pinataForm = new FormData();
    const file = formData.get("file") as File;
    pinataForm.append("file", file);

    // Passo 1: Upload da imagem
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
      console.error("Erro Pinata imagem:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const imageData = await imageRes.json();
    const imageHash = imageData.IpfsHash;

    // Valida se a imagem foi salva corretamente
    if (!imageHash) {
      console.error("Pinata não retornou IpfsHash da imagem:", imageData);
      return NextResponse.json(
        { error: "Upload da imagem ao IPFS falhou" },
        { status: 500 },
      );
    }

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const data = JSON.stringify({
      pinataContent: {
        name,
        description,
        image: `ipfs://${imageHash}`,
        attributes: [{ trait_type: "Criador", value: "Usuario TCC" }],
      },
      pinataMetadata: { name: `${name}_metadata.json` },
    });

    // Passo 2: Upload do JSON de metadados
    const jsonRes = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: data,
      },
    );

    if (!jsonRes.ok) {
      const err = await jsonRes.text();
      console.error("Erro Pinata JSON:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const jsonData = await jsonRes.json();

    // Valida se o JSON foi salvo corretamente
    if (!jsonData.IpfsHash) {
      console.error("Pinata não retornou IpfsHash do JSON:", jsonData);
      return NextResponse.json(
        { error: "Upload dos metadados ao IPFS falhou" },
        { status: 500 },
      );
    }

    return NextResponse.json({ uri: `ipfs://${jsonData.IpfsHash}` });
  } catch (error) {
    console.error("Erro na route de upload:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
