import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  try {
    const profile = await req.json();

    if (!profile.address) {
      return NextResponse.json(
        { error: "Endereço obrigatório" },
        { status: 400 },
      );
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

    return NextResponse.json({ uri: `ipfs://${data.IpfsHash}` });
  } catch (error) {
    console.error("Erro na route de perfil:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
