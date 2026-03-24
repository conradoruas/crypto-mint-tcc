"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Wallet } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { useConnection } from "wagmi";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useConnection();

  const navLinks = [
    { name: "Explore", path: "/explore" },
    { name: "Collections", path: "/collections" },
    { name: "Mint", path: "/create" },
    { name: "Activity", path: "/activity" },
    ...(isConnected ? [{ name: "Profile", path: "/profile" }] : []),
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-outline-variant/15 bg-background/80 backdrop-blur-xl shadow-[0_0_20px_rgba(0,240,255,0.04)]">
      <div className="flex items-center justify-between px-8 py-4 w-full max-w-[1920px] mx-auto">
        <div className="flex items-center gap-12">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tighter text-primary-container uppercase font-headline"
          >
            <div>
              <span>Crypto</span>
              <span className="text-on-surface lowercase">mint</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 font-headline text-sm uppercase tracking-wider">
            {navLinks.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={cn(
                    "transition-colors",
                    isActive
                      ? "text-primary-container border-b-2 border-primary-container pb-1"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input
              type="text"
              placeholder="Search assets..."
              className="bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-2 pl-10 pr-4 text-sm w-64 focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/50 text-on-surface"
            />
          </div>

          <div className="flex items-center gap-4 text-on-surface-variant">
            <button className="hover:text-primary p-2 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="hover:text-primary p-2 transition-colors">
              <Wallet className="w-5 h-5" />
            </button>
          </div>

          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress, ensName }) => (
              <button
                onClick={show}
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed font-headline font-bold px-6 py-2 rounded-sm text-sm tracking-wider active:scale-95 transition-all uppercase hover:brightness-110"
              >
                {isConnected ? (ensName ?? truncatedAddress) : "Connect Wallet"}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </nav>
  );
}
