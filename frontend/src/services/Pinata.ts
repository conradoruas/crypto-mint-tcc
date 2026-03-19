export const uploadMetadataToIPFS = async (
  file: File,
  name: string,
  description: string,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("description", description);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Falha no upload: ${res.status}`);
  }

  const data = await res.json();

  if (!data.uri || !data.uri.startsWith("ipfs://")) {
    throw new Error("URI inválida retornada pelo servidor");
  }

  return data.uri; // se chegou aqui, o Pinata confirmou o upload — suficiente
};
