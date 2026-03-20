"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";

export function Navbar() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            <Link href="/" className="hover:text-white transition-colors">
              NFT-PRO
            </Link>
          </h1>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <Link
              href="/explore"
              className="hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link href="/create" className="hover:text-white transition-colors">
              Criar NFT
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ConnectKitButton />
        </div>
      </div>
    </nav>
  );
}
