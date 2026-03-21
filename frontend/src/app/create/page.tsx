"use client";

import { useState } from "react";
import { useConnection } from "wagmi"; // ✅ corrigido: era useConnection
import { Navbar } from "@/components/NavBar";
import { Upload, Plus, Loader2, ChevronDown } from "lucide-react";
import { uploadMetadataToIPFS } from "@/services/Pinata";
import { useMintToCollection, useCollections } from "@/hooks/useCollections"; // ✅ usa nova arquitetura
import { TooltipButton } from "@/components/TooltipButton";
import { formatEther } from "viem";
import Link from "next/link";

export default function CreateNFT() {
  const { address, isConnected } = useConnection(); // ✅ corrigido
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState("");

  // ✅ Busca coleções da factory para o usuário escolher
  const { collections, isLoading: isLoadingCollections } = useCollections();

  // ✅ usa useMintToCollection em vez de useMintNFT
  const { mint, isPending, isConfirming, isSuccess, hash } =
    useMintToCollection();

  const chosenCollection = collections.find(
    (c) => c.contractAddress === selectedCollection,
  );

  const isSoldOut =
    chosenCollection &&
    chosenCollection.totalSupply !== undefined &&
    Number(chosenCollection.totalSupply) >= Number(chosenCollection.maxSupply);

  const handleCreateNFT = async () => {
    if (!file || !name) {
      alert("Por favor, preencha o nome e selecione uma imagem.");
      return;
    }
    if (!address) {
      alert("Conecte sua carteira antes de criar um NFT.");
      return;
    }
    if (!selectedCollection) {
      alert("Selecione uma coleção para mintar o NFT.");
      return;
    }

    if (isSoldOut) {
      alert("Esta coleção já atingiu o limite máximo de NFTs.");
      return;
    }

    try {
      setIsUploading(true);
      const tokenUri = await uploadMetadataToIPFS(file, name, description);
      console.log("✅ Upload confirmado:", tokenUri);

      // ✅ Passa collectionAddress e mintPrice dinâmico da coleção escolhida
      await mint(
        selectedCollection as `0x${string}`,
        tokenUri,
        formatEther(chosenCollection!.mintPrice),
        address,
      );

      console.log("✅ Mint realizado com sucesso");
    } catch (error) {
      console.error("Erro na criação:", error);
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
          {/* Seletor de coleção */}
          <div>
            <label className="block text-sm font-medium mb-2">Coleção *</label>
            {isLoadingCollections ? (
              <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
            ) : collections.length === 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl p-4 text-sm">
                Nenhuma coleção disponível.{" "}
                <Link
                  href="/collections/create"
                  className="underline font-bold"
                >
                  Criar uma coleção primeiro →
                </Link>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">Selecione uma coleção...</option>
                  {collections.map((c) => (
                    <option key={c.contractAddress} value={c.contractAddress}>
                      {c.name} ({c.symbol}) — {formatEther(c.mintPrice)} ETH
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            )}
            {chosenCollection && (
              <p className="text-xs text-slate-500 mt-1.5">
                Supply: {chosenCollection.totalSupply?.toString() ?? "?"} /{" "}
                {chosenCollection.maxSupply.toString()} mintados
              </p>
            )}
          </div>

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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-32 outline-none text-white resize-none"
                placeholder="Conte a história por trás deste ativo..."
              />
            </div>
          </div>

          <TooltipButton
            onClick={handleCreateNFT}
            disabled={
              isLoading ||
              !isConnected ||
              collections.length === 0 ||
              !!isSoldOut
            }
            tooltip={
              isSoldOut
                ? `Supply esgotado — todos os ${chosenCollection?.maxSupply.toString()} NFTs já foram mintados`
                : !isConnected
                  ? "Conecte sua carteira para mintar"
                  : collections.length === 0
                    ? "Nenhuma coleção disponível"
                    : undefined
            }
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
                  : isSoldOut
                    ? "Supply Esgotado"
                    : chosenCollection
                      ? `Criar NFT — ${formatEther(chosenCollection.mintPrice)} ETH`
                      : "Criar NFT (Mint)"}
          </TooltipButton>

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
