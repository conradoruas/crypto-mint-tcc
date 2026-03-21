// ─────────────────────────────────────────────
// Serviço de perfil usando IPFS via Pinata
// Os dados ficam no IPFS e o hash no localStorage
// ─────────────────────────────────────────────

export interface UserProfile {
  address: string;
  name: string;
  imageUri: string; // ipfs://Qm...
  updatedAt: number;
}

const STORAGE_KEY = (address: string) => `nft_profile_${address.toLowerCase()}`;

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

// ─── Upload de imagem para o IPFS ───
export async function uploadProfileImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  // ✅ Usa rota dedicada que retorna só o URI da imagem
  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Falha no upload da imagem: ${res.status}`);

  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida retornada pelo servidor");

  return data.uri; // ipfs://Qm... direto da imagem
}

// ─── Upload do JSON de perfil para o IPFS ───
export async function uploadProfileToIPFS(
  profile: UserProfile,
): Promise<string> {
  const res = await fetch("/api/upload-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
