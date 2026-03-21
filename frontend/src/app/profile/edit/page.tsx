"use client";

import { useConnection } from "wagmi";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/NavBar";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Camera, Loader2, ArrowLeft, Check } from "lucide-react";
import {
  fetchProfile,
  uploadProfileToIPFS,
  saveProfileHash,
  UserProfile,
} from "@/services/profile";

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Falha no upload da imagem: ${res.status}`);
  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida retornada pelo servidor");
  return data.uri;
}

export default function EditProfilePage() {
  const { address, isConnected } = useConnection();
  const router = useRouter();

  // Dados atuais do perfil
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(
    null,
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Campos editáveis
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>(""); // preview local
  const [imageFile, setImageFile] = useState<File | null>(null); // arquivo selecionado mas NÃO enviado
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega perfil atual
  useEffect(() => {
    if (!address) {
      setIsLoadingProfile(false);
      return;
    }
    fetchProfile(address).then((p) => {
      setCurrentProfile(p);
      setName(p?.name ?? "");
      setPreviewUrl(p?.imageUri ? resolveIpfsUrl(p.imageUri) : "");
      setIsLoadingProfile(false);
    });
  }, [address]);

  // Seleciona imagem — só faz preview local, NÃO envia ainda
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    // Gera preview local usando URL.createObjectURL
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
  };

  // Salva tudo de uma vez ao clicar em Salvar
  const handleSave = async () => {
    if (!address) return;
    setError(null);
    setIsSaving(true);

    try {
      let imageUri = currentProfile?.imageUri ?? "";

      // Só faz upload da imagem se o usuário selecionou uma nova
      if (imageFile) {
        imageUri = await uploadImageToIPFS(imageFile);
      }

      const updated: UserProfile = {
        address,
        name: name.trim(),
        imageUri,
        updatedAt: Date.now(),
      };

      // Upload do JSON de perfil para o IPFS
      const uri = await uploadProfileToIPFS(updated);
      saveProfileHash(address, uri);

      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    name !== (currentProfile?.name ?? "") || imageFile !== null;

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <p className="text-center py-20 text-slate-400">
          Conecte sua carteira.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black">Editar Perfil</h1>
            <p className="text-slate-400 text-sm">
              As alterações só são salvas ao clicar em Salvar
            </p>
          </div>
        </div>

        {isLoadingProfile ? (
          <div className="space-y-4">
            <div className="h-32 bg-slate-900 rounded-3xl animate-pulse" />
            <div className="h-14 bg-slate-900 rounded-2xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-6 bg-slate-900 p-8 rounded-3xl border border-slate-800">
            {/* Foto */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                {previewUrl ? (
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-700 relative">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold">
                    {name ? name[0].toUpperCase() : "?"}
                  </div>
                )}

                {/* Overlay */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={22} className="text-white" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {imageFile ? `✓ ${imageFile.name}` : "Trocar foto"}
              </button>

              {imageFile && (
                <p className="text-xs text-slate-500">
                  A foto será enviada ao clicar em Salvar
                </p>
              )}
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium mb-2">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                placeholder="Seu nome..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1.5 text-right">
                {name.length}/32
              </p>
            </div>

            {/* Endereço (somente leitura) */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-400">
                Carteira
              </label>
              <p className="font-mono text-sm text-slate-500 bg-slate-800 rounded-xl px-4 py-3 truncate">
                {address}
              </p>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3">
                {error}
              </div>
            )}

            {/* Sucesso */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl p-3 flex items-center gap-2">
                <Check size={14} /> Perfil salvo! Redirecionando...
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.back()}
                disabled={isSaving}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Check size={18} />
                )}
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
