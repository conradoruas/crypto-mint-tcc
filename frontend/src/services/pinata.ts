import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";
import type { UploadAuthHeadersFn } from "@/lib/uploadClient";

export const uploadFileToIPFS = async (
  file: File,
  authHeaders: UploadAuthHeadersFn,
) => {
  const formData = new FormData();
  formData.append("file", file);

  const headers = await authHeaders(UPLOAD_API_PATHS.combined);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    headers,
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
  authHeaders: UploadAuthHeadersFn,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("description", description);

  const headers = await authHeaders(UPLOAD_API_PATHS.combined);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    headers,
  });

  if (!res.ok) {
    throw new Error(`Falha no upload do metadado: ${res.status}`);
  }

  const data = await res.json();
  return data.uri;
};
