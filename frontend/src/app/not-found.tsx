import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Search, ArrowLeft, Compass } from "lucide-react";

export const metadata = {
  title: "404 — Página não encontrada | CryptoMint",
};

export default function NotFound() {
  return (
    <main className="bg-background text-on-surface min-h-screen flex flex-col">
      <Navbar />

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-32 text-center">
        {/* Error code */}
        <p className="text-[10px] font-bold tracking-[0.4em] text-on-surface-variant uppercase mb-6">
          Erro · 404
        </p>

        <h1 className="font-headline font-bold text-[clamp(6rem,20vw,14rem)] leading-none tracking-tighter uppercase text-outline-variant/20 select-none mb-2">
          404
        </h1>

        <h2 className="font-headline text-2xl md:text-4xl font-bold tracking-tighter uppercase mb-4 -mt-4">
          Página <span className="text-gradient-primary">não encontrada</span>
        </h2>

        <p className="text-on-surface-variant text-sm max-w-md mb-12 leading-relaxed">
          O NFT, coleção ou rota que você está procurando não existe ou foi
          removido. Verifique o endereço ou volte ao início.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary text-xs font-bold tracking-widest uppercase rounded-sm hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft size={14} />
            Início
          </Link>

          <Link
            href="/explore"
            className="flex items-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant/20 text-on-surface text-xs font-bold tracking-widest uppercase rounded-sm hover:border-outline-variant/50 transition-colors"
          >
            <Search size={14} />
            Explorar NFTs
          </Link>

          <Link
            href="/collections"
            className="flex items-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant/20 text-on-surface text-xs font-bold tracking-widest uppercase rounded-sm hover:border-outline-variant/50 transition-colors"
          >
            <Compass size={14} />
            Coleções
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
