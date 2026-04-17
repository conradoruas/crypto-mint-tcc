"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Wallet,
  AlertTriangle,
  Loader2,
  Menu,
  X as XIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectKitButton } from "connectkit";
import { useConnection, useSwitchChain } from "wagmi";
import { useWrongNetwork, APP_CHAIN } from "@/hooks/useWrongNetwork";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BellDropdown } from "./BellDropdown";
import { WalletDropdown } from "./WalletDropdown";
import { Suspense, useState, useEffect } from "react";

// ── Navbar ────────────────────────────────────────────────────────────────────

/** Must be wrapped in `<Suspense>` — `usePathname` opts into client routing state. */
function NavbarContent() {
  const pathname = usePathname();
  const { isConnected, address } = useConnection();
  const { isWrongNetwork, currentChainName } = useWrongNetwork();
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const { mutateAsync } = useSwitchChain();

  const handleSwitchToSepolia = async () => {
    setSwitchError(null);
    setIsSwitchingChain(true);
    try {
      await mutateAsync({ chainId: APP_CHAIN.id });
    } catch (e) {
      setSwitchError(
        e instanceof Error ? e.message : "Could not switch network.",
      );
    } finally {
      setIsSwitchingChain(false);
    }
  };

  const navLinks = [
    { name: "Explore", path: "/explore" },
    { name: "Collections", path: "/collections" },
    { name: "Mint", path: "/create" },
    { name: "Activity", path: "/activity" },
    ...(isConnected ? [{ name: "Profile", path: "/profile" }] : []),
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-outline-variant/15 bg-background/80 backdrop-blur-xl shadow-[0_0_20px_rgba(0,240,255,0.04)]">
      {isWrongNetwork && (
        <div
          role="alert"
          className="border-b border-secondary/30 bg-secondary/10 px-4 py-2.5 text-on-surface"
        >
          <div className="max-w-[1920px] mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-4 text-center sm:text-left text-sm">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-on-surface font-medium">
              <AlertTriangle
                className="shrink-0 text-secondary"
                size={18}
                aria-hidden
              />
              <span>
                Wallet is on <strong>{currentChainName}</strong>. This app uses{" "}
                <strong>{APP_CHAIN.name}</strong> (chain {APP_CHAIN.id}).
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={handleSwitchToSepolia}
                disabled={isSwitchingChain}
                className="inline-flex items-center justify-center gap-2 font-headline font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-sm bg-primary text-on-primary-fixed hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-[opacity,filter]"
              >
                {isSwitchingChain ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Switching…
                  </>
                ) : (
                  `Switch to ${APP_CHAIN.name}`
                )}
              </button>
              {switchError && (
                <span className="text-xs text-error max-w-md sm:text-left">
                  {switchError}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 w-full max-w-[1920px] mx-auto">
        <div className="flex items-center gap-4 md:gap-12">
          {/* Mobile Hamburger */}
          <button
            className="md:hidden text-on-surface hover:text-primary transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <XIcon size={24} /> : <Menu size={24} />}
          </button>

          <Link
            href="/"
            className="text-xl sm:text-2xl font-bold tracking-tighter text-primary-container uppercase font-headline"
          >
            <div>
              <span className="text-on-surface lowercase">crypto.</span>
              <span className="lowercase">mint</span>
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

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden lg:block w-72">
            <GlobalSearch />
          </div>
          <ThemeToggle />

          {isConnected && address ? (
            <div className="flex items-center gap-1 text-on-surface-variant">
              <BellDropdown address={address} />
              <WalletDropdown address={address} />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-on-surface-variant">
              <button
                aria-label="Activity notifications"
                className="p-2 text-on-surface-variant/30 cursor-not-allowed"
                disabled
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                aria-label="Wallet"
                className="p-2 text-on-surface-variant/30 cursor-not-allowed"
                disabled
              >
                <Wallet className="w-5 h-5" />
              </button>
            </div>
          )}

          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress, ensName }) => (
              <button
                onClick={show}
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed font-headline font-bold px-4 sm:px-6 py-2 rounded-sm text-xs sm:text-sm tracking-wider active:scale-95 transition-all uppercase hover:brightness-110 shrink-0"
              >
                {isConnected ? (ensName ?? truncatedAddress) : "Connect"}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-outline-variant/15 bg-background shadow-lg px-4 py-4 space-y-1 font-headline uppercase tracking-wider text-sm flex flex-col">
          <div className="mb-3">
            <GlobalSearch className="w-full" />
          </div>
          {navLinks.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "transition-colors py-3 px-2 rounded-sm",
                  isActive
                    ? "text-primary-container font-bold bg-primary/5"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
                )}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function NavbarSuspenseFallback() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-outline-variant/15 bg-background/80 backdrop-blur-xl shadow-[0_0_20px_rgba(0,240,255,0.04)]">
      <div className="flex items-center justify-between px-8 py-4 w-full max-w-[1920px] mx-auto min-h-[4.5rem]">
        <div className="h-8 w-36 rounded-sm bg-surface-container-high/80 animate-pulse" />
        <div className="flex items-center gap-6">
          <div className="h-9 w-48 rounded-sm bg-surface-container-high/80 animate-pulse hidden sm:block" />
          <div className="h-9 w-32 rounded-sm bg-surface-container-high/80 animate-pulse" />
        </div>
      </div>
    </nav>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={<NavbarSuspenseFallback />}>
      <NavbarContent />
    </Suspense>
  );
}
