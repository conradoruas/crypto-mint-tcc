import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import {
  Rocket,
  ShieldCheck,
  Zap,
  PlusCircle,
  LayoutGrid,
  UserCircle,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="py-24 px-4 text-center max-w-5xl mx-auto">
        <div className="inline-block px-4 py-1.5 mb-6 text-sm font-medium text-blue-400 border border-blue-500/30 rounded-full bg-blue-500/10 animate-fade-in">
          Web3 Marketplace v2.0 • TCC Edition
        </div>
        <h2 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter">
          O Futuro dos Ativos{" "}
          <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Digitais
          </span>
        </h2>
        <p className="text-slate-400 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
          Infraestrutura profissional para mintagem, negociação e curadoria de
          NFTs em Layer 2. Desenvolvido com React Compiler e foco em Gas
          Efficiency.
        </p>

        {/* Integração de Rotas (Navigation Buttons) */}
        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href="/explore"
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 shadow-lg shadow-blue-900/20"
          >
            <LayoutGrid size={20} className="group-hover:rotate-3" />
            Explorar Marketplace
          </Link>
          <Link
            href="/create"
            className="group flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl font-bold transition-all border border-slate-700"
          >
            <PlusCircle size={20} />
            Criar NFT
          </Link>
          <Link
            href="/profile"
            className="group flex items-center gap-2 bg-transparent hover:bg-slate-900 px-8 py-4 rounded-2xl font-bold transition-all border border-slate-800"
          >
            <UserCircle size={20} />
            Meu Perfil
          </Link>
        </div>
      </section>

      {/* Seção de Destaques Técnicos (Bento Grid) */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Performance */}
          <div className="group p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition-all">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-6">
              <Zap className="text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Transações em L2</h3>
            <p className="text-slate-400 leading-relaxed">
              Otimizado para redes de segunda camada como Base e Arbitrum,
              reduzindo taxas em até 99%.
            </p>
          </div>

          {/* Card 2: Segurança */}
          <div className="group p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-green-500/50 transition-all">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
              <ShieldCheck className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Segurança Máxima</h3>
            <p className="text-slate-400 leading-relaxed">
              Lógica de negociação baseada no Seaport Protocol, garantindo
              trocas atômicas e seguras.
            </p>
          </div>

          {/* Card 3: Escalabilidade */}
          <div className="group p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6">
              <Rocket className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">ERC-721A Otimizado</h3>
            <p className="text-slate-400 leading-relaxed">
              Padrão de contrato que permite mintagem em massa com consumo
              mínimo de recursos computacionais.
            </p>
          </div>
        </div>
      </section>

      {/* Footer Simples */}
      <footer className="border-t border-slate-900 py-12 text-center text-slate-500 text-sm">
        © 2026 NFT-PRO Marketplace • Projeto de Conclusão de Curso
      </footer>
    </main>
  );
}
