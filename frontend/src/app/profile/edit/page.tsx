"use client";

import { useConnection, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { WalletGuard } from "@/components/WalletGuard";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, Check } from "lucide-react";
import {
  fetchProfile,
  uploadProfileImage,
  uploadProfileToIPFS,
  saveProfileHash,
  UserProfile,
} from "@/services/profile";
import { buildUploadAuthHeaders } from "@/lib/uploadAuthClient";
import {
  editProfileSchema,
  getZodErrors,
  EditProfileErrors,
} from "@/lib/schemas";
import { resolveIpfsUrl } from "@/lib/ipfs";

export default function EditProfilePage() {
  const { address, isConnected } = useConnection();
  const { signMessageAsync } = useSignMessage();

  const getAuthHeaders = useCallback(
    (pathname: string) => {
      if (!address) throw new Error("Wallet required");
      return buildUploadAuthHeaders(signMessageAsync, address, pathname);
    },
    [signMessageAsync, address],
  );
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(
    null,
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EditProfileErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!address) return;
    const errors = getZodErrors(editProfileSchema, {
      name: name.trim(),
    }) as EditProfileErrors;
    setFieldErrors(errors);
    if (errors.name) return;
    setError(null);
    setIsSaving(true);
    try {
      let imageUri = currentProfile?.imageUri ?? "";
      if (imageFile) imageUri = await uploadProfileImage(imageFile, getAuthHeaders);
      const updated: UserProfile = {
        address,
        name: name.trim(),
        imageUri,
        updatedAt: Date.now(),
      };
      const uri = await uploadProfileToIPFS(updated, getAuthHeaders);
      saveProfileHash(address, uri);
      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    name !== (currentProfile?.name ?? "") || imageFile !== null;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <WalletGuard message="Connect your wallet to edit your profile.">
        <div className="pt-32 pb-20 max-w-lg mx-auto px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-sm bg-surface-container-low border border-outline-variant/15 text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-xs font-headline font-bold tracking-[0.3em] text-primary uppercase block mb-0.5">
              Settings
            </span>
            <h1 className="font-headline text-2xl font-bold tracking-tighter uppercase">
              Edit Profile
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Changes are only saved when you click Save
            </p>
          </div>
        </div>

        {isLoadingProfile ? (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-sm bg-surface-container-high" />
            <div className="h-14 animate-pulse rounded-sm bg-surface-container-high" />
          </div>
        ) : (
          <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-6 rounded-sm">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                {previewUrl ? (
                  <div className="w-28 h-28 overflow-hidden relative border-2 border-outline-variant/20 rounded-sm">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="112px"
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center font-headline font-bold text-3xl bg-surface-container-high border-2 border-outline-variant/20 rounded-sm text-primary">
                    {name ? name[0].toUpperCase() : "?"}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-sm"
                >
                  <Camera size={22} className="text-primary" />
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
                className="text-sm font-headline font-bold text-primary hover:text-primary-container transition-colors uppercase tracking-widest"
              >
                {imageFile ? `✓ ${imageFile.name}` : "Change Photo"}
              </button>

              {imageFile && (
                <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest">
                  Photo will be uploaded when you save
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant"
              >
                Display Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((p) => ({ ...p, name: undefined }));
                }}
                maxLength={32}
                placeholder="Your name..."
                className="w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40"
              />
              {fieldErrors.name ? (
                <p className="text-xs text-error mt-1.5">{fieldErrors.name}</p>
              ) : (
                <p className="text-xs mt-1.5 text-right text-on-surface-variant/30 font-mono">
                  {name.length}/32
                </p>
              )}
            </div>

            {/* Wallet (read-only) */}
            <div>
              <label className="block text-[10px] font-headline font-bold mb-2 uppercase tracking-widest text-on-surface-variant">
                Wallet
              </label>
              <p className="text-sm px-4 py-3 truncate font-mono text-on-surface-variant/50 bg-surface-container border border-outline-variant/10 rounded-sm">
                {address}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm p-3 bg-error/5 border border-error/20 text-error rounded-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="text-sm p-3 flex items-center gap-2 bg-primary/5 border border-primary/20 text-primary rounded-sm">
                <Check size={13} /> Profile saved! Redirecting...
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.back()}
                disabled={isSaving}
                className="flex-1 font-headline font-bold py-3 rounded-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-all text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <div className="flex-1 relative group overflow-hidden">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className={`w-full relative overflow-hidden font-headline font-bold py-3 flex items-center justify-center gap-2 rounded-sm transition-all text-sm uppercase tracking-widest ${
                    isSaving || !hasChanges
                      ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.99]"
                  }`}
                >
                  {!(isSaving || !hasChanges) && (
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  )}
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </WalletGuard>
    </main>
  );
}
