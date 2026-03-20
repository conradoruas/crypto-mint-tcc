"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";
import { Upload, Plus, Loader2, Info } from "lucide-react";
import { uploadFileToIPFS } from "@/services/Pinata";
import { useCreateCollection } from "@/hooks/useCollections";

export default function CreateCollectionPage() {
  const router = useRouter();
  const { isConnected } = useConnection();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [maxSupply, setMaxSupply] = useState("1000");
  const [mintPrice, setMintPrice] = useState("0.0001");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createCollection, isPending, isConfirming, isSuccess, hash } =
    useCreateCollection();

  const isLoading = isUploading || isPending || isConfirming;

  const handleSubmit = async () => {
    setError(null);

    if (!name || !symbol) {
      setError("Nome e símbolo são obrigatórios.");
      return;
    }
    if (!coverFile) {
      setError("Selecione uma imagem para a coleção.");
      return;
    }
    if (!isConnected) {
      setError("Conecte sua carteira.");
      return;
    }
    if (parseInt(maxSupply) < 1) {
      setError("Supply deve ser maior que 0.");
      return;
    }
    if (parseFloat(mintPrice) < 0.0001) {
      setError("Preço mínimo é 0.0001 ETH.");
      return;
    }

    try {
      setIsUploading(true);

      const imageUri = await uploadFileToIPFS(coverFile);

      setIsUploading(false);

      await createCollection({
        name,
        symbol: symbol.toUpperCase(),
        description,
        image: imageUri,
        maxSupply: parseInt(maxSupply),
        mintPrice,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setIsUploading(false);
    }
  };

  // Redireciona para /collections após sucesso
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus size={28} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Coleção Criada!</h1>
          <p className="text-slate-400 mb-2">
            Sua coleção foi deployada na blockchain com sucesso.
          </p>
          {hash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-sm"
            >
              Ver transação no Etherscan
            </a>
          )}
          <div className="flex gap-4 justify-center mt-8">
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

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-black mb-2">Nova Coleção</h1>
        <p className="text-slate-400 mb-10">
          Crie uma coleção de NFTs com seus próprios parâmetros e deixe outros
          usuários mintarem.
        </p>

        <div className="space-y-6 bg-slate-900 p-8 rounded-3xl border border-slate-800">
          {/* Imagem de capa */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Imagem da Coleção
            </label>
            <input
              type="file"
              id="cover-upload"
              className="hidden"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="cover-upload"
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer block
                ${coverFile ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-blue-500"}`}
            >
              <Upload
                className={`mx-auto mb-3 ${coverFile ? "text-green-500" : "text-slate-500"}`}
              />
              <p className="text-sm text-slate-400">
                {coverFile
                  ? `✓ ${coverFile.name}`
                  : "Clique para selecionar a imagem de capa"}
              </p>
            </label>
          </div>

          {/* Nome e Símbolo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome da Coleção *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white uppercase"
                placeholder="Ex: CYBM"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium mb-2">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-28 outline-none text-white resize-none"
              placeholder="Descreva sua coleção..."
            />
          </div>

          {/* Supply e Preço */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Supply Máximo *
                <span className="ml-1 text-slate-500 font-normal">
                  (total de NFTs)
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={maxSupply}
                onChange={(e) => setMaxSupply(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                placeholder="Ex: 1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Preço de Mint *
                <span className="ml-1 text-slate-500 font-normal">
                  (em ETH)
                </span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={mintPrice}
                onChange={(e) => setMintPrice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                placeholder="Ex: 0.0001"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Ao criar a coleção, um contrato ERC721 será deployado na Sepolia.
              Você receberá os valores de mint e poderá sacar via{" "}
              <strong className="text-white">withdraw()</strong>. O preço de
              mint não pode ser alterado após a criação.
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-white"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Plus size={20} />
            )}
            {isUploading
              ? "Fazendo upload da imagem..."
              : isPending
                ? "Aguardando MetaMask..."
                : isConfirming
                  ? "Deployando contrato..."
                  : "Criar Coleção"}
          </button>
        </div>
      </div>
    </main>
  );
}
