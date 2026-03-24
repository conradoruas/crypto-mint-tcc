"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  Upload,
  Plus,
  Loader2,
  Info,
  X,
  Image as ImageIcon,
  CheckCircle,
} from "lucide-react";
import { useCreateCollection } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";

const FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS as `0x${string}`;

// ─── Tipos ───
interface NFTDraft {
  id: number;
  name: string;
  description: string;
  file: File | null;
  previewUrl: string;
}

// ─── Helpers de upload ───
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Falha no upload: ${res.status}`);
  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida");
  return data.uri;
}

async function uploadMetadata(
  name: string,
  description: string,
  imageUri: string,
): Promise<string> {
  const res = await fetch("/api/upload-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      image: imageUri,
      address: `nft-${Date.now()}`,
    }),
  });
  if (!res.ok) throw new Error(`Falha no upload de metadados: ${res.status}`);
  const data = await res.json();
  if (!data.uri) throw new Error("URI inválida");
  return data.uri;
}

export default function CreateCollectionPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // ─── Dados da coleção ───
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [mintPrice, setMintPrice] = useState("0.0001");

  // ─── NFTs da coleção ───
  const [nfts, setNfts] = useState<NFTDraft[]>([]);

  // ─── Estados de loading ───
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingNFTs, setIsUploadingNFTs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ─── Hook de criação de coleção ───
  const {
    createCollection,
    isPending: isCreating,
    isConfirming: isConfirmingCreate,
    isSuccess: collectionCreated,
    hash: createHash,
  } = useCreateCollection();

  // ─── Hook de loadTokenURIs ───
  const { writeContractAsync, isPending: isLoadingURIs } = useWriteContract();
  const [loadURIsHash, setLoadURIsHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirmingLoad, isSuccess: urisLoaded } =
    useWaitForTransactionReceipt({ hash: loadURIsHash });

  // ─── Busca automática do endereço da coleção recém-deployada ───
  // Busca os índices de coleções do criador
  const { data: creatorCollectionIds } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address as `0x${string}`],
    query: { enabled: !!collectionCreated && !!address, refetchInterval: 2000 },
  });

  // Pega o último índice criado pelo usuário
  const lastIndex = creatorCollectionIds
    ? (creatorCollectionIds as bigint[])[
        (creatorCollectionIds as bigint[]).length - 1
      ]
    : undefined;

  // Busca os detalhes da última coleção para obter o endereço
  const { data: lastCollectionData } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getCollection",
    args: [lastIndex ?? BigInt(0)],
    query: { enabled: lastIndex !== undefined },
  });

  const deployedAddress =
    (lastCollectionData as { contractAddress: `0x${string}` } | undefined)
      ?.contractAddress ?? null;

  const isLoading =
    isUploadingCover ||
    isCreating ||
    isConfirmingCreate ||
    isUploadingNFTs ||
    isLoadingURIs ||
    isConfirmingLoad;

  // ─── Gerenciar NFTs ───
  const addNFT = () =>
    setNfts((prev) => [
      ...prev,
      { id: Date.now(), name: "", description: "", file: null, previewUrl: "" },
    ]);

  const removeNFT = (id: number) =>
    setNfts((prev) => prev.filter((n) => n.id !== id));

  const updateNFT = (
    id: number,
    field: keyof NFTDraft,
    value: string | File | null,
  ) =>
    setNfts((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (field === "file" && value instanceof File)
          return { ...n, file: value, previewUrl: URL.createObjectURL(value) };
        return { ...n, [field]: value };
      }),
    );

  // ─── Etapa 1: Deploy da coleção ───
  const handleCreateCollection = async () => {
    setError(null);
    if (!name || !symbol) {
      setError("Nome e símbolo são obrigatórios.");
      return;
    }
    if (!coverFile) {
      setError("Selecione uma imagem de capa.");
      return;
    }
    if (!isConnected) {
      setError("Conecte sua carteira.");
      return;
    }
    if (nfts.length === 0) {
      setError("Adicione ao menos 1 NFT à coleção.");
      return;
    }
    if (nfts.some((n) => !n.name || !n.file)) {
      setError("Todos os NFTs precisam de nome e imagem.");
      return;
    }
    if (parseFloat(mintPrice) < 0.0001) {
      setError("Preço mínimo é 0.0001 ETH.");
      return;
    }

    try {
      setIsUploadingCover(true);
      const coverUri = await uploadImage(coverFile);
      setIsUploadingCover(false);

      await createCollection({
        name,
        symbol: symbol.toUpperCase(),
        description,
        image: coverUri,
        maxSupply: nfts.length,
        mintPrice,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setIsUploadingCover(false);
    }
  };

  // ─── Etapa 2: Upload + loadTokenURIs ───
  const handleLoadURIs = async (addr: `0x${string}`) => {
    setError(null);
    try {
      setIsUploadingNFTs(true);
      const uris: string[] = [];

      for (let i = 0; i < nfts.length; i++) {
        setUploadProgress(Math.round((i / nfts.length) * 90));
        const nft = nfts[i];
        const imageUri = await uploadImage(nft.file!);
        const metaUri = await uploadMetadata(
          nft.name,
          nft.description,
          imageUri,
        );
        uris.push(metaUri);
      }

      setUploadProgress(95);
      setIsUploadingNFTs(false);

      const tx = await writeContractAsync({
        address: addr,
        abi: NFT_COLLECTION_ABI,
        functionName: "loadTokenURIs",
        args: [uris],
        gas: BigInt(500000 + uris.length * 30000),
      });

      setLoadURIsHash(tx);
      setUploadProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar URIs.");
      setIsUploadingNFTs(false);
    }
  };

  // ─────────────────────────────────────────────
  // Tela de sucesso final
  // ─────────────────────────────────────────────
  if (urisLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Coleção Pronta!</h1>
          <p className="text-slate-400 mb-2">
            {nfts.length} NFTs carregados e prontos para mint.
          </p>
          {loadURIsHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${loadURIsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-sm block mb-8"
            >
              Ver transação no Etherscan
            </a>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push("/collections")}
              className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Ver Coleções
            </button>
            <button
              onClick={() => router.push("/collections/create")}
              className="bg-slate-800 hover:bg-slate-700 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Criar Outra
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // Tela intermediária: coleção deployada, aguarda loadTokenURIs
  // ─────────────────────────────────────────────
  if (collectionCreated && !urisLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-blue-500/20 border border-blue-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Coleção Deployada!</h1>
          <p className="text-slate-400 mb-6">
            Agora carregue os {nfts.length} NFTs na blockchain para liberar o
            mint.
          </p>

          {/* Endereço detectado automaticamente */}
          {deployedAddress ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-slate-500 mb-1">Contrato deployado</p>
              <p className="font-mono text-xs text-green-400 break-all">
                {deployedAddress}
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Loader2
                size={16}
                className="text-slate-500 animate-spin shrink-0"
              />
              <p className="text-xs text-slate-400">
                Detectando endereço do contrato...
              </p>
            </div>
          )}

          {createHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${createHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-sm block mb-6"
            >
              Ver deploy no Etherscan
            </a>
          )}

          {/* Barra de progresso do upload */}
          {(isUploadingNFTs || isLoadingURIs || isConfirmingLoad) && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>
                  {isUploadingNFTs
                    ? `Enviando NFTs para IPFS... (${uploadProgress}%)`
                    : isLoadingURIs
                      ? "Aguardando MetaMask..."
                      : "Confirmando na blockchain..."}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-3 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={() => deployedAddress && handleLoadURIs(deployedAddress)}
            disabled={isLoading || !deployedAddress}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isLoading || !deployedAddress ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {!deployedAddress
                  ? "Aguardando endereço..."
                  : isUploadingNFTs
                    ? `Enviando NFTs... ${uploadProgress}%`
                    : isLoadingURIs
                      ? "Aguardando MetaMask..."
                      : "Confirmando..."}
              </>
            ) : (
              <>
                <Upload size={20} /> Carregar {nfts.length} NFTs na Blockchain
              </>
            )}
          </button>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // Formulário principal
  // ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-black mb-2">Nova Coleção</h1>
        <p className="text-slate-400 mb-10">
          Defina os dados da coleção e adicione todos os NFTs disponíveis para
          mint.
        </p>

        <div className="space-y-8">
          {/* ─── Seção 1: Dados da coleção ─── */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold">1. Dados da Coleção</h2>

            {/* Imagem de capa */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Imagem de Capa *
              </label>
              <input
                type="file"
                id="cover-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setCoverFile(f);
                  setCoverPreview(f ? URL.createObjectURL(f) : "");
                }}
              />
              <label
                htmlFor="cover-upload"
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer block
                  ${coverFile ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-blue-500"}`}
              >
                {coverPreview ? (
                  <div className="relative h-32">
                    <img
                      src={coverPreview}
                      alt="preview"
                      className="h-full mx-auto object-cover rounded-xl"
                    />
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-3 text-slate-500" />
                    <p className="text-sm text-slate-400">
                      Clique para selecionar a imagem de capa
                    </p>
                  </>
                )}
                {coverFile && (
                  <p className="text-xs text-green-400 mt-2">
                    ✓ {coverFile.name}
                  </p>
                )}
              </label>
            </div>

            {/* Nome e Símbolo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Cyber Monkeys"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Símbolo *
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none text-white uppercase focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: CYBM"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-24 outline-none text-white resize-none"
                placeholder="Descreva sua coleção..."
              />
            </div>

            {/* Preço */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Preço de Mint (ETH) *
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={mintPrice}
                onChange={(e) => setMintPrice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none text-white focus:ring-2 focus:ring-blue-500"
                placeholder="0.0001"
              />
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">
                O supply máximo é definido pela quantidade de NFTs adicionados
                abaixo. Cada usuário recebe um NFT{" "}
                <strong className="text-white">aleatório</strong> ao mintar.
              </p>
            </div>
          </div>

          {/* ─── Seção 2: NFTs da coleção ─── */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">2. NFTs da Coleção</h2>
                <p className="text-slate-400 text-sm mt-1">
                  {nfts.length === 0
                    ? "Adicione os NFTs disponíveis para mint."
                    : `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""} adicionado${nfts.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={addNFT}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                <Plus size={14} /> Adicionar NFT
              </button>
            </div>

            {nfts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                <ImageIcon size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm mb-4">
                  Nenhum NFT adicionado ainda
                </p>
                <button
                  onClick={addNFT}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  <Plus size={14} /> Adicionar primeiro NFT
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {nfts.map((nft, index) => (
                  <div
                    key={nft.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Preview da imagem */}
                      <div className="shrink-0">
                        <input
                          type="file"
                          id={`nft-file-${nft.id}`}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            updateNFT(
                              nft.id,
                              "file",
                              e.target.files?.[0] || null,
                            )
                          }
                        />
                        <label
                          htmlFor={`nft-file-${nft.id}`}
                          className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors
                            ${nft.file ? "border-green-500" : "border-slate-600 hover:border-blue-500"}`}
                        >
                          {nft.previewUrl ? (
                            <img
                              src={nft.previewUrl}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Upload size={16} className="text-slate-500" />
                          )}
                        </label>
                      </div>

                      {/* Campos */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-mono shrink-0">
                            #{String(index + 1).padStart(3, "0")}
                          </span>
                          <input
                            type="text"
                            value={nft.name}
                            onChange={(e) =>
                              updateNFT(nft.id, "name", e.target.value)
                            }
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nome do NFT *"
                          />
                        </div>
                        <textarea
                          value={nft.description}
                          onChange={(e) =>
                            updateNFT(nft.id, "description", e.target.value)
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none resize-none h-16"
                          placeholder="Descrição (opcional)"
                        />
                      </div>

                      {/* Remover */}
                      <button
                        onClick={() => removeNFT(nft.id)}
                        className="shrink-0 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addNFT}
                  className="w-full py-3 border border-dashed border-slate-700 hover:border-blue-500 rounded-xl text-slate-500 hover:text-blue-400 text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Plus size={14} /> Adicionar mais um NFT
                </button>
              </div>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {/* Botão principal */}
          <button
            onClick={handleCreateCollection}
            disabled={isLoading || nfts.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-white"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Plus size={20} />
            )}
            {isUploadingCover
              ? "Enviando capa para IPFS..."
              : isCreating
                ? "Aguardando MetaMask..."
                : isConfirmingCreate
                  ? "Deployando contrato..."
                  : `Criar Coleção com ${nfts.length} NFT${nfts.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </main>
  );
}
