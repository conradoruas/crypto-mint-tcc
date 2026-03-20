"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  ShoppingCart,
  ShieldCheck,
  Tag,
  X,
  Loader2,
  HandCoins,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";
import { NFTItem } from "@/hooks/useExploreNfts";
import {
  useNFTListing,
  useMyOffer,
  useListNFT,
  useBuyNFT,
  useCancelListing,
  useMakeOffer,
  useAcceptOffer,
  useCancelOffer,
} from "@/hooks/useMarketplace";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS;
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

// ─── Componente de feedback de transação ───
function TxMessage({
  type,
  text,
  hash,
}: {
  type: "success" | "error";
  text: string;
  hash?: string;
}) {
  return (
    <div
      className={`p-4 rounded-xl text-sm border flex flex-col gap-2 ${
        type === "success"
          ? "bg-green-500/10 border-green-500 text-green-400"
          : "bg-red-500/10 border-red-500 text-red-400"
      }`}
    >
      <span>{text}</span>
      {hash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 underline font-bold"
        >
          Ver no Etherscan <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

// ─── Skeleton de loading ───
function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 aspect-square animate-pulse" />
        <div className="flex flex-col justify-center space-y-4">
          <div className="h-4 bg-slate-800 rounded w-1/3 animate-pulse" />
          <div className="h-10 bg-slate-800 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-slate-800 rounded w-full animate-pulse" />
          <div className="h-40 bg-slate-800 rounded animate-pulse" />
          <div className="h-14 bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function AssetDetail() {
  const { id } = useParams();
  const tokenId = (Array.isArray(id) ? id[0] : id) ?? "";

  const { address } = useConnection();
  const [nft, setNft] = useState<NFTItem | null>(null);
  const [isLoadingNft, setIsLoadingNft] = useState(true);

  // Estados de UI
  const [listPrice, setListPrice] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showListForm, setShowListForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [txMsg, setTxMsg] = useState<{
    type: "success" | "error";
    text: string;
    hash?: string;
  } | null>(null);

  // Hooks de leitura
  const {
    owner,
    isListed,
    price,
    refetch: refetchListing,
  } = useNFTListing(tokenId);
  const {
    hasActiveOffer,
    offerAmount: myOfferAmount,
    expiresAt,
    refetch: refetchOffer,
  } = useMyOffer(tokenId);

  // Hooks de escrita
  const { listNFT, isPending: isListing } = useListNFT();
  const {
    buyNFT,
    isPending: isBuying,
    isConfirming: isBuyConfirming,
    isSuccess: isBought,
    hash: buyHash,
  } = useBuyNFT();
  const { cancelListing, isPending: isCancelling } = useCancelListing();
  const {
    makeOffer,
    isPending: isMakingOffer,
    isConfirming: isOfferConfirming,
    isSuccess: isOfferMade,
  } = useMakeOffer();
  const { acceptOffer, isPending: isAccepting } = useAcceptOffer();
  const {
    cancelOffer,
    isPending: isCancellingOffer,
    isSuccess: isOfferCancelled,
  } = useCancelOffer();

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  const refetchAll = () => {
    refetchListing();
    refetchOffer();
  };

  // Busca metadados do NFT via Alchemy
  useEffect(() => {
    const fetchNFT = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${CONTRACT_ADDRESS}&tokenId=${tokenId}&refreshCache=false`,
        );
        const data = await res.json();

        let image = data.image?.cachedUrl ?? data.image?.originalUrl ?? "";
        if (!image && data.tokenUri) {
          const metaRes = await fetch(resolveIpfsUrl(data.tokenUri));
          const meta = await metaRes.json();
          image = resolveIpfsUrl(meta.image ?? "");
        }

        setNft({
          tokenId: data.tokenId,
          name: data.name ?? `NFT #${tokenId}`,
          description: data.description ?? "",
          image,
        });
      } catch (error) {
        console.error("Erro ao buscar NFT:", error);
      } finally {
        setIsLoadingNft(false);
      }
    };

    fetchNFT();
  }, [tokenId]);

  // Reações a transações bem-sucedidas
  useEffect(() => {
    if (isBought) {
      setTxMsg({
        type: "success",
        text: "NFT comprado com sucesso!",
        hash: buyHash,
      });
      refetchAll();
    }
  }, [isBought]);

  useEffect(() => {
    if (isOfferMade) {
      setTxMsg({
        type: "success",
        text: "Oferta enviada! O ETH fica custodiado por 7 dias.",
      });
      setShowOfferForm(false);
      setOfferAmount("");
      refetchOffer();
    }
  }, [isOfferMade]);

  useEffect(() => {
    if (isOfferCancelled) {
      setTxMsg({
        type: "success",
        text: "Oferta cancelada. ETH devolvido à sua carteira.",
      });
      refetchOffer();
    }
  }, [isOfferCancelled]);

  // ─── Handlers ───

  const handleList = async () => {
    if (!listPrice || parseFloat(listPrice) < 0.0001) {
      setTxMsg({ type: "error", text: "Preço mínimo é 0.0001 ETH." });
      return;
    }
    try {
      setTxMsg(null);
      await listNFT(tokenId, listPrice);
      setShowListForm(false);
      setListPrice("");
      setTxMsg({ type: "success", text: "NFT listado com sucesso!" });
      refetchListing();
    } catch {
      setTxMsg({
        type: "error",
        text: "Erro ao listar NFT. Verifique o MetaMask e tente novamente.",
      });
    }
  };

  const handleBuy = async () => {
    if (!price) return;
    try {
      setTxMsg(null);
      await buyNFT(tokenId, price);
    } catch {
      setTxMsg({
        type: "error",
        text: "Erro ao comprar NFT. Verifique o MetaMask e tente novamente.",
      });
    }
  };

  const handleCancelListing = async () => {
    try {
      setTxMsg(null);
      await cancelListing(tokenId);
      setTxMsg({ type: "success", text: "Listagem cancelada com sucesso." });
      refetchListing();
    } catch {
      setTxMsg({ type: "error", text: "Erro ao cancelar listagem." });
    }
  };

  const handleMakeOffer = async () => {
    if (!offerAmount || parseFloat(offerAmount) < 0.0001) {
      setTxMsg({ type: "error", text: "Oferta mínima é 0.0001 ETH." });
      return;
    }
    try {
      setTxMsg(null);
      await makeOffer(tokenId, offerAmount);
    } catch {
      setTxMsg({
        type: "error",
        text: "Erro ao enviar oferta. Verifique o MetaMask e tente novamente.",
      });
    }
  };

  const handleAcceptOffer = async (buyerAddress: `0x${string}`) => {
    try {
      setTxMsg(null);
      await acceptOffer(tokenId, buyerAddress);
      setTxMsg({
        type: "success",
        text: "Oferta aceita! NFT transferido com sucesso.",
      });
      refetchAll();
    } catch {
      setTxMsg({ type: "error", text: "Erro ao aceitar oferta." });
    }
  };

  const handleCancelOffer = async () => {
    try {
      setTxMsg(null);
      await cancelOffer(tokenId);
    } catch {
      setTxMsg({ type: "error", text: "Erro ao cancelar oferta." });
    }
  };

  if (isLoadingNft) return <LoadingSkeleton />;

  if (!nft) {
    return (
      <main className="min-h-screen bg-slate-950">
        <Navbar />
        <p className="text-center text-slate-400 py-20">NFT não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* ─── Imagem ─── */}
        <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 aspect-square relative">
          {nft.image ? (
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-slate-600">
              Sem imagem
            </div>
          )}
        </div>

        {/* ─── Informações + Ações ─── */}
        <div className="flex flex-col justify-start gap-6">
          {/* Cabeçalho */}
          <div>
            <p className="text-blue-500 font-bold mb-1 uppercase tracking-widest text-sm">
              Coleção TCC #{nft.tokenId.padStart(3, "0")}
            </p>
            <h1 className="text-4xl font-black mb-3">{nft.name}</h1>
            {nft.description && (
              <p className="text-slate-400 text-sm leading-relaxed">
                {nft.description}
              </p>
            )}
          </div>

          {/* Dono */}
          {owner && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck size={16} className="text-green-500" />
              <span className="text-slate-400">Dono:</span>
              <span className="font-mono text-slate-300">
                {isOwner ? "Você" : `${owner.slice(0, 6)}...${owner.slice(-4)}`}
              </span>
            </div>
          )}

          {/* Feedback */}
          {txMsg && (
            <TxMessage type={txMsg.type} text={txMsg.text} hash={txMsg.hash} />
          )}

          {/* ─── Painel de Compra / Listagem ─── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            {isListed && price ? (
              <>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Preço de venda</p>
                  <p className="text-3xl font-bold">{price} ETH</p>
                </div>

                {isOwner ? (
                  // Dono vê botão de cancelar listagem
                  <button
                    onClick={handleCancelListing}
                    disabled={isCancelling}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {isCancelling ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <X size={20} />
                    )}
                    {isCancelling ? "Cancelando..." : "Cancelar Listagem"}
                  </button>
                ) : (
                  // Outros veem botão de comprar
                  <button
                    onClick={handleBuy}
                    disabled={isBuying || isBuyConfirming}
                    className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {isBuying || isBuyConfirming ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <ShoppingCart size={20} />
                    )}
                    {isBuying
                      ? "Aguardando MetaMask..."
                      : isBuyConfirming
                        ? "Confirmando..."
                        : "Comprar Agora"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-slate-400 text-sm">
                  Este NFT não está à venda.
                </p>

                {isOwner &&
                  // Dono pode listar
                  (showListForm ? (
                    <div className="space-y-3">
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        placeholder="Preço em ETH (ex: 0.05)"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleList}
                          disabled={isListing}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          {isListing ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <Tag size={18} />
                          )}
                          {isListing
                            ? "Aprovando e Listando..."
                            : "Confirmar Listagem"}
                        </button>
                        <button
                          onClick={() => setShowListForm(false)}
                          className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowListForm(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      <Tag size={20} /> Colocar à Venda
                    </button>
                  ))}
              </>
            )}
          </div>

          {/* ─── Painel de Ofertas ─── */}
          {!isOwner && address && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <HandCoins size={18} className="text-yellow-400" />
                Fazer uma Oferta
              </h3>

              {hasActiveOffer ? (
                // Comprador já tem oferta ativa
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                    <CheckCircle size={16} />
                    <span>
                      Sua oferta ativa: <strong>{myOfferAmount} ETH</strong>
                    </span>
                  </div>
                  {expiresAt && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={12} />
                      <span>
                        Expira em:{" "}
                        {expiresAt.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleCancelOffer}
                    disabled={isCancellingOffer}
                    className="w-full bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {isCancellingOffer ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <X size={18} />
                    )}
                    {isCancellingOffer
                      ? "Cancelando..."
                      : "Cancelar Oferta e Resgatar ETH"}
                  </button>
                </div>
              ) : // Comprador pode fazer nova oferta
              showOfferForm ? (
                <div className="space-y-3">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="Valor em ETH (ex: 0.08)"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="text-xs text-slate-500">
                    O ETH ficará custodiado no contrato por 7 dias. Você pode
                    cancelar a qualquer momento.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleMakeOffer}
                      disabled={isMakingOffer || isOfferConfirming}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      {isMakingOffer || isOfferConfirming ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <HandCoins size={18} />
                      )}
                      {isMakingOffer
                        ? "Aguardando MetaMask..."
                        : isOfferConfirming
                          ? "Confirmando..."
                          : "Enviar Oferta"}
                    </button>
                    <button
                      onClick={() => setShowOfferForm(false)}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowOfferForm(true)}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <HandCoins size={20} /> Fazer uma Oferta
                </button>
              )}
            </div>
          )}

          {/* ─── Painel de aceitar ofertas (só para o dono) ─── */}
          {isOwner && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <HandCoins size={18} className="text-yellow-400" />
                Aceitar Oferta
              </h3>
              <p className="text-sm text-slate-400">
                Para aceitar uma oferta, cole abaixo o endereço do comprador.
                Você pode pedir o endereço diretamente a ele.
              </p>
              <OfferAcceptForm
                tokenId={tokenId}
                onAccept={handleAcceptOffer}
                isAccepting={isAccepting}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Subcomponente: formulário de aceitar oferta ───
function OfferAcceptForm({
  tokenId,
  onAccept,
  isAccepting,
}: {
  tokenId: string;
  onAccept: (buyer: `0x${string}`) => void;
  isAccepting: boolean;
}) {
  const [buyerAddress, setBuyerAddress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!buyerAddress.startsWith("0x") || buyerAddress.length !== 42) {
      setError("Endereço inválido. Deve começar com 0x e ter 42 caracteres.");
      return;
    }
    setError("");
    onAccept(buyerAddress as `0x${string}`);
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Endereço do comprador (0x...)"
        value={buyerAddress}
        onChange={(e) => setBuyerAddress(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:ring-2 focus:ring-yellow-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={isAccepting || !buyerAddress}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
      >
        {isAccepting ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <CheckCircle size={18} />
        )}
        {isAccepting ? "Aprovando e Aceitando..." : "Aceitar Oferta"}
      </button>
    </div>
  );
}
