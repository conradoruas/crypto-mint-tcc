export const uploadFileToIPFS = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Falha no upload do arquivo: ${res.status}`);
  }

  const data = await res.json();
  return data.uri;
};

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
    throw new Error(`Falha no upload do metadado: ${res.status}`);
  }

  const data = await res.json();
  return data.uri;
};
