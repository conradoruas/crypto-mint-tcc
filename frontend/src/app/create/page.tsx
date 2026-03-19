"use client";

import { useState } from "react";
import { Navbar } from "@/components/NavBar";
import { Upload, Plus, Loader2 } from "lucide-react";
import { uploadMetadataToIPFS } from "@/services/Pinata"; // O arquivo que criamos
import { useMintNFT } from "@/hooks/useMintNft"; // Seu hook atualizado

export default function CreateNFT() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { mint, isPending, isConfirming, isSuccess, hash } = useMintNFT();

  const handleCreateNFT = async () => {
    if (!file || !name) {
      alert("Por favor, preencha o nome e selecione uma imagem.");
      return;
    }

    try {
      setIsUploading(true);

      // 1. Upload — se falhar, lança exceção e para aqui
      const tokenUri = await uploadMetadataToIPFS(file, name, description);
      console.log("✅ Upload confirmado:", tokenUri);

      // 2. Só chega aqui se o upload foi bem sucedido
      await mint(tokenUri);
      console.log("✅ Mint realizado com sucesso");
    } catch (error) {
      console.error("Erro na criação:", error);
      // Mostra mensagem específica ao usuário
      if (error instanceof Error) {
        alert(`Erro: ${error.message}`);
      } else {
        alert("Erro desconhecido. Verifique o console.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const isLoading = isUploading || isPending || isConfirming;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">Criar Novo NFT</h1>
        <p className="text-slate-400 mb-10">
          Faça o upload do seu arquivo e defina os metadados na blockchain.
        </p>

        <div className="space-y-8 bg-slate-900 p-8 rounded-3xl border border-slate-800">
          {/* Upload de Imagem */}
          <div>
            <label className="block text-sm font-medium mb-4">Imagem</label>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="file-upload"
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer block
                ${file ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-blue-500"}`}
            >
              <Upload
                className={`mx-auto mb-4 ${file ? "text-green-500" : "text-slate-500"}`}
              />
              <p className="text-sm text-slate-400">
                {file
                  ? `Selecionado: ${file.name}`
                  : "Clique para selecionar seu arquivo"}
              </p>
            </label>
          </div>

          {/* Campos de Texto */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome do Item
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                placeholder="Ex: Cyber Punk #001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-32 outline-none text-white"
                placeholder="Conte a história por trás deste ativo..."
              />
            </div>
          </div>

          <button
            onClick={handleCreateNFT}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Plus size={20} />
            )}
            {isUploading
              ? "Subindo para IPFS..."
              : isPending
                ? "Aguardando MetaMask..."
                : isConfirming
                  ? "Confirmando na Rede..."
                  : "Criar NFT (Mint)"}
          </button>

          {isSuccess && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500 rounded-xl text-green-500 text-sm text-center">
              NFT Criado com sucesso! <br />
              <a
                href={`https://sepolia.etherscan.io/tx/${hash}`}
                target="_blank"
                className="underline font-bold"
              >
                Ver no Etherscan
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
