import Link from "next/link";
import { ArrowRight, Zap, Shield, Globe } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { StatsSection } from "@/components/marketplace/StatsSection";
import { TrendingSection } from "@/components/marketplace/TrendingSection";
import Footer from "@/components/Footer";

export default function LandingPage() {
  return (
    <main className="bg-background text-on-surface selection:bg-primary/30">
      <Navbar />

      <div className="pb-20">
        {/* ─── Hero Section ─── */}
        <section className="relative px-8 w-full max-w-[1920px] mx-auto h-[716px] flex items-center overflow-hidden pt-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>

          <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-secondary-container/20 text-secondary text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase border border-secondary/30">
                  FEATURED DROP
                </span>
                <span className="text-on-surface-variant text-xs tracking-widest uppercase animate-pulse">
                  Live On-Chain · Sepolia
                </span>
              </div>

              <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-none uppercase">
                Create. Trade. <br />
                <span className="text-gradient-primary">COLLECT.</span>
              </h1>

              <p className="text-on-surface-variant text-lg max-w-lg mb-10 leading-relaxed">
                Decentralized marketplace for creating and trading NFTs.
                Collections, offers, and royalties — processed via Smart Contracts.
              </p>

              <div className="flex items-center gap-4">
                <Link href="/explore">
                  <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-bold px-10 py-4 rounded-sm hover:brightness-110 active:scale-95 transition-all text-sm tracking-widest uppercase">
                    Explorar NFTs
                  </button>
                </Link>
                <Link href="/create">
                  <button className="glass-panel border border-outline-variant/15 text-on-surface font-headline font-bold px-10 py-4 rounded-sm hover:bg-surface-variant/40 transition-all text-sm tracking-widest uppercase">
                    Mint NFT
                  </button>
                </Link>
              </div>
            </div>

            {/* Featured NFT card */}
            <div className="hidden lg:block relative group">
              <div className="absolute -inset-4 bg-primary/10 blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
              <div className="relative aspect-square glass-panel p-4 border border-outline-variant/15 neon-glow-primary overflow-hidden">
                <video
                  src="/animation.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-15 scale-105 blur-[2px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Trending Collections ─── */}
        <section className="px-8 mb-24 w-full max-w-[1920px] mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-headline text-4xl font-bold tracking-tight mb-2 uppercase">
                Trending Collections
              </h2>
              <p className="text-on-surface-variant text-sm uppercase tracking-widest">
                Real-time analytics · Sepolia Testnet
              </p>
            </div>
            <Link
              href="/collections"
              className="text-primary hover:text-primary-container flex items-center gap-2 text-sm font-headline font-bold uppercase tracking-widest transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <TrendingSection />
        </section>

        {/* ─── Stats ─── */}
        <section className="bg-surface-container-low/50 py-24 border-y border-outline-variant/10 mb-24">
          <div className="max-w-[1920px] mx-auto px-8">
            <div className="text-center mb-12">
              <h2 className="font-headline text-4xl font-bold tracking-tight mb-2 uppercase">
                Platform Stats
              </h2>
              <p className="text-on-surface-variant text-sm uppercase tracking-widest">
                Live data from Sepolia Testnet
              </p>
            </div>
            <StatsSection />
          </div>
        </section>

        {/* ─── Features ─── */}
        <section className="max-w-[1920px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-16 mb-24">
          <div className="space-y-4">
            <div className="w-10 h-10 flex items-center justify-center bg-primary/10 border border-primary/20 rounded-sm">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-headline text-2xl font-bold uppercase">
              Instant Liquidity
            </h3>
            <p className="text-on-surface-variant leading-relaxed">
              Trade digital assets with zero latency. Our on-chain offer system
              guarantees secure execution in every transaction.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary/10 border border-secondary/20 rounded-sm">
              <Shield className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-headline text-2xl font-bold uppercase">
              On-Chain Security
            </h3>
            <p className="text-on-surface-variant leading-relaxed">
              Every asset is cryptographically verified. Provenance is
              immutable, stored directly on the Ethereum blockchain.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-10 h-10 flex items-center justify-center bg-tertiary/10 border border-tertiary/20 rounded-sm">
              <Globe className="w-5 h-5 text-tertiary" />
            </div>
            <h3 className="font-headline text-2xl font-bold uppercase">
              IPFS & Pinata
            </h3>
            <p className="text-on-surface-variant leading-relaxed">
              Decentralized metadata and media. Your NFTs don&apos;t rely on
              central servers, ensuring the perpetual existence of your art.
            </p>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <Footer />
      </div>
    </main>
  );
}
