// ─────────────────────────────────────────────
// Serviço de perfil usando IPFS via Pinata
// Os dados ficam no IPFS e o hash no localStorage
// ─────────────────────────────────────────────

import { resolveIpfsUrl } from "@/lib/ipfs";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";

export interface UserProfile {
  address: string;
  name: string;
  imageUri: string; // ipfs://Qm...
  updatedAt: number;
}

const STORAGE_KEY = (address: string) => `nft_profile_${address.toLowerCase()}`;

/** Returns headers from `buildUploadAuthHeaders` for the given API pathname. */
export type UploadAuthHeadersFn = (
  pathname: string,
) => Promise<Record<string, string>>;

// ─── Upload de imagem para o IPFS ───
export async function uploadProfileImage(
  file: File,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = await authHeaders(UPLOAD_API_PATHS.image);
  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
    headers,
  });

  if (!res.ok) throw new Error(`Falha no upload da imagem: ${res.status}`);

  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida retornada pelo servidor");

  return data.uri; // ipfs://Qm... direto da imagem
}

// ─── Upload do JSON de perfil para o IPFS ───
export async function uploadProfileToIPFS(
  profile: UserProfile,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders(UPLOAD_API_PATHS.profile)),
  };
  const res = await fetch("/api/upload-profile", {
    method: "POST",
    headers,
    body: JSON.stringify(profile),
  });

  if (!res.ok) throw new Error(`Falha no upload do perfil: ${res.status}`);

  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida retornada pelo servidor");

  return data.uri; // ipfs://Qm...
}

// ─── Salva o hash do perfil no localStorage ───
export function saveProfileHash(address: string, ipfsUri: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY(address), ipfsUri);
}

// ─── Carrega o hash do perfil do localStorage ───
export function loadProfileHash(address: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY(address));
}

// ─── Busca o perfil completo do IPFS ───
export async function fetchProfile(
  address: string,
): Promise<UserProfile | null> {
  const hash = loadProfileHash(address);
  if (!hash) return null;

  try {
    const res = await fetch(resolveIpfsUrl(hash));
    if (!res.ok) return null;
    const profile = (await res.json()) as UserProfile;
    return profile;
  } catch {
    return null;
  }
}

// ─── Remove o perfil do localStorage ───
export function clearProfile(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY(address));
}
