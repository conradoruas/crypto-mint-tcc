import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import {
  LayoutGrid,
  PlusCircle,
  UserCircle,
  Layers,
  ArrowRight,
  Tag,
  TrendingUp,
  Box,
} from "lucide-react";
import { StatsSection } from "@/components/StatsSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      <Navbar />

      {/* ─── Grid de fundo ─── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* ─── Glow de fundo ─── */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ─── Hero ─── */}
      <section className="relative pt-24 pb-20 px-4 text-center max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-semibold text-blue-400 border border-blue-500/20 rounded-full bg-blue-500/5 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Sepolia Testnet · TCC 2026
        </div>

        {/* Título */}
        <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-none">
          Crie. Negocie. <br />
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-600 bg-clip-text text-transparent">
              Colecione.
            </span>
            {/* Underline decorativo */}
            <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          </span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl mb-14 max-w-xl mx-auto leading-relaxed">
          Marketplace descentralizado para criação e negociação de NFTs.
          Coleções, ofertas e royalties — tudo on-chain.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/explore"
            className="group flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 shadow-lg shadow-blue-900/30 text-sm"
          >
            <LayoutGrid size={18} />
            Explorar NFTs
            <ArrowRight
              size={14}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Link>
          <Link
            href="/collections"
            className="group flex items-center gap-2.5 bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl font-bold transition-all border border-slate-700 text-sm"
          >
            <Layers size={18} />
            Ver Coleções
          </Link>
          <Link
            href="/create"
            className="group flex items-center gap-2.5 bg-transparent hover:bg-slate-900 px-8 py-4 rounded-2xl font-bold transition-all border border-slate-800 text-slate-400 hover:text-white text-sm"
          >
            <PlusCircle size={18} />
            Criar NFT
          </Link>
        </div>
      </section>

      {/* ─── Stats — componente client com dados reais ─── */}
      <StatsSection />

      {/* ─── Como funciona ─── */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-semibold mb-3">
            Como funciona
          </p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            Simples do início ao fim
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: <Layers size={22} className="text-blue-400" />,
              color: "blue",
              title: "Crie uma Coleção",
              desc: "Defina nome, símbolo, supply máximo e preço de mint. Um contrato ERC-721 é deployado automaticamente.",
              href: "/collections/create",
              cta: "Criar coleção",
            },
            {
              step: "02",
              icon: <Box size={22} className="text-purple-400" />,
              color: "purple",
              title: "Minte seus NFTs",
              desc: "Faça upload da imagem e metadados para o IPFS e minte diretamente na coleção escolhida.",
              href: "/create",
              cta: "Mintar NFT",
            },
            {
              step: "03",
              icon: <Tag size={22} className="text-green-400" />,
              color: "green",
              title: "Liste e Negocie",
              desc: "Liste seu NFT por um preço fixo ou receba e aceite ofertas. Royalties pagos automaticamente.",
              href: "/explore",
              cta: "Ver marketplace",
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`relative p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-${item.color}-500/40 transition-all group`}
            >
              {/* Número do step */}
              <span className="absolute top-6 right-6 text-5xl font-black text-slate-800 group-hover:text-slate-700 transition-colors select-none">
                {item.step}
              </span>

              <div
                className={`w-11 h-11 bg-${item.color}-500/10 rounded-xl flex items-center justify-center mb-6`}
              >
                {item.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm mb-6">
                {item.desc}
              </p>
              <Link
                href={item.href}
                className={`inline-flex items-center gap-1.5 text-${item.color}-400 text-sm font-medium hover:gap-2.5 transition-all`}
              >
                {item.cta} <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Destaques técnicos ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card grande — Royalties */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-950/50 to-slate-900 border border-blue-900/40 flex flex-col justify-between min-h-[200px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                <TrendingUp size={18} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold">Royalties Automáticos</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Suporte nativo ao padrão ERC-2981. Criadores recebem royalties
              automaticamente a cada revenda sem nenhuma ação manual.
            </p>
            <span className="text-xs text-blue-400 font-semibold uppercase tracking-widest">
              ERC-2981 · On-chain
            </span>
          </div>

          {/* Card — Ofertas */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-yellow-950/30 to-slate-900 border border-yellow-900/30 flex flex-col justify-between min-h-[200px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                <Tag size={18} className="text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold">Sistema de Ofertas</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Faça ofertas em qualquer NFT com ETH custodiado no contrato por 7
              dias. Vendedor aceita, comprador cancela ou ETH é resgatado ao
              expirar.
            </p>
            <span className="text-xs text-yellow-500 font-semibold uppercase tracking-widest">
              Custódia · 7 dias
            </span>
          </div>

          {/* Card — Multi-coleção */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-950/30 to-slate-900 border border-purple-900/30 flex flex-col justify-between min-h-[200px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Layers size={18} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold">Factory de Coleções</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Qualquer usuário pode criar sua própria coleção ERC-721. Cada
              coleção é um contrato independente deployado via factory.
            </p>
            <span className="text-xs text-purple-400 font-semibold uppercase tracking-widest">
              ERC-721 · Factory Pattern
            </span>
          </div>

          {/* Card — Perfil */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-green-950/30 to-slate-900 border border-green-900/30 flex flex-col justify-between min-h-[200px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <UserCircle size={18} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold">Perfil Descentralizado</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Nome e foto armazenados no IPFS via Pinata. Dados imutáveis e
              independentes de servidor centralizado.
            </p>
            <span className="text-xs text-green-400 font-semibold uppercase tracking-widest">
              IPFS · Pinata
            </span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-900 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <span className="font-bold text-slate-500">NFT-PRO</span>
          <span>© 2026 · Projeto de Conclusão de Curso</span>
          <div className="flex gap-6">
            <Link
              href="/explore"
              className="hover:text-slate-400 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/collections"
              className="hover:text-slate-400 transition-colors"
            >
              Coleções
            </Link>
            <Link
              href="/create"
              className="hover:text-slate-400 transition-colors"
            >
              Criar NFT
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
