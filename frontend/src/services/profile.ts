// ─────────────────────────────────────────────
// Serviço de perfil usando IPFS via Pinata
// Os dados ficam no IPFS e o hash no localStorage
// ─────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { resolveIpfsUrl } from "@/lib/ipfs";
import {
  type UploadAuthHeadersFn,
  uploadImageFile,
  uploadJsonMetadata,
} from "@/lib/uploadClient";

export interface UserProfile {
  address: string;
  name: string;
  imageUri: string; // ipfs://Qm...
  updatedAt: number;
}

const STORAGE_KEY = (address: string) => `nft_profile_${address.toLowerCase()}`;

// ─── Upload de imagem para o IPFS ───
export async function uploadProfileImage(
  file: File,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  return uploadImageFile(file, authHeaders);
}

// ─── Upload do JSON de perfil para o IPFS ───
export async function uploadProfileToIPFS(
  profile: UserProfile,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  return uploadJsonMetadata("/api/upload-profile", profile, authHeaders);
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

// ─── React Query wrapper ───
export function useProfileQuery(address: string | undefined) {
  return useQuery({
    queryKey: ["profile", address],
    queryFn: () => fetchProfile(address ?? ""),
    enabled: !!address,
    staleTime: 5 * 60_000,
  });
}
