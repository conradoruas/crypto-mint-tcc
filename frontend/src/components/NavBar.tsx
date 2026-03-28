"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  User,
  X,
  Activity,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { ConnectKitButton, useModal } from "connectkit";
import {
  useConnection,
  useBalance,
  useDisconnect,
  useConfig,
  useSwitchChain,
} from "wagmi";
import { useWrongNetwork, APP_CHAIN } from "@/hooks/useWrongNetwork";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useActivityFeed, ActivityEvent } from "@/hooks/useActivityFeed";
import { getEventConfig } from "@/lib/eventConfig";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { fetchAlchemyMeta, NFTMeta } from "@/lib/alchemyMeta";
import { useStableArray } from "@/hooks/useStableArray";

// ── helpers ──────────────────────────────────────────────────────────────────

const EVENT_CONFIG = getEventConfig(12);

function formatTime(ts?: number) {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  cb: () => void,
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

// ── Bell (notifications) ─────────────────────────────────────────────────────

const BELL_STORAGE_KEY = "bell_last_seen_ts";

function BellDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(BELL_STORAGE_KEY) ?? "0", 10);
  });
  const [metaMap, setMetaMap] = useState<Map<string, NFTMeta>>(new Map());
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const { events: allEvents, isLoading } = useActivityFeed(undefined, 200);

  const userEvents = useMemo(() => {
    if (!address) return [];
    const lower = address.toLowerCase();
    return allEvents
      .filter(
        (e) => e.from.toLowerCase() === lower || e.to?.toLowerCase() === lower,
      )
      .slice(0, 8);
  }, [allEvents, address]);

  const stableUserEvents = useStableArray(
    userEvents,
    (e) => `${e.nftContract}-${e.tokenId}`,
  );

  useEffect(() => {
    if (!stableUserEvents.length) return;

    const tokens = stableUserEvents.map((e) => ({
      contractAddress: e.nftContract,
      tokenId: e.tokenId,
    }));

    fetchAlchemyMeta(tokens).then(setMetaMap);
  }, [stableUserEvents]);

  // Count events newer than last time the user opened the dropdown
  const unread = useMemo(
    () => userEvents.filter((e) => (e.timestamp ?? 0) > lastSeenTs).length,
    [userEvents, lastSeenTs],
  );

  const handleOpen = () => {
    const nowTs = Math.floor(Date.now() / 1000);
    setOpen((v) => {
      if (!v) {
        // Mark as seen when opening
        localStorage.setItem(BELL_STORAGE_KEY, String(nowTs));
        setLastSeenTs(nowTs);
      }
      return !v;
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        aria-label="Activity notifications"
        aria-expanded={open}
        className={cn(
          "relative p-2 transition-colors",
          open ? "text-primary" : "hover:text-primary text-on-surface-variant",
        )}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-outline-variant/20 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
            <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Recent Activity
            </span>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="text-[10px] text-primary hover:text-primary-container transition-colors font-headline font-bold uppercase tracking-widest"
            >
              View all
            </Link>
          </div>

          {isLoading && userEvents.length === 0 ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-8 h-8 animate-pulse bg-surface-container-high rounded-sm shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 animate-pulse bg-surface-container-high rounded-sm w-3/4" />
                    <div className="h-2 animate-pulse bg-surface-container-high rounded-sm w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : userEvents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Activity
                size={28}
                className="mx-auto mb-2 text-on-surface-variant/20"
              />
              <p className="text-xs text-on-surface-variant">
                No recent activity
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/5 max-h-72 overflow-y-auto">
              {userEvents.map((event: ActivityEvent) => {
                const cfg = EVENT_CONFIG[event.type];
                const isFrom =
                  event.from.toLowerCase() === address.toLowerCase();
                const metaKey = `${event.nftContract.toLowerCase()}-${event.tokenId}`;
                const nftName =
                  metaMap.get(metaKey)?.name ??
                  `#${event.tokenId.padStart(3, "0")}`;
                return (
                  <Link
                    key={event.id}
                    href={`/asset/${event.tokenId}?contract=${event.nftContract}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
                  >
                    <div className={cn("shrink-0", cfg.colorClass)}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-headline font-bold text-on-surface truncate">
                        {cfg.label}{" "}
                        <span className="text-on-surface-variant font-normal">
                          {nftName}
                        </span>
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate">
                        {isFrom ? "You → " : "→ You"}
                        {event.priceETH
                          ? ` · ${parseFloat(event.priceETH).toFixed(4)} ETH`
                          : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wallet panel ──────────────────────────────────────────────────────────────

function WalletDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { setOpen: openConnectKit } = useModal();
  const { mutate } = useDisconnect();
  useClickOutside(ref, () => setOpen(false));

  const { data: balance } = useBalance({ address: address as `0x${string}` });

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Wallet"
        aria-expanded={open}
        className={cn(
          "p-2 transition-colors",
          open ? "text-primary" : "hover:text-primary text-on-surface-variant",
        )}
      >
        <Wallet className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-outline-variant/20 shadow-2xl z-50 overflow-hidden">
          {/* Address */}
          <div className="px-4 py-4 border-b border-outline-variant/10">
            <p className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">
              Connected Wallet
            </p>
            <div className="flex items-center gap-2 bg-surface-container px-3 py-2 rounded-sm">
              <span className="font-mono text-sm text-primary flex-1 truncate">
                {address.slice(0, 10)}...{address.slice(-8)}
              </span>
              <button
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy address"}
                className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
              >
                {copied ? (
                  <Check size={13} className="text-primary" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Balance */}
          <div className="px-4 py-3 border-b border-outline-variant/10">
            <p className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">
              Balance · Sepolia
            </p>
            <p className="font-headline text-xl font-bold text-on-surface">
              {balance
                ? `${(Number(balance.value) / 1e18).toFixed(4)} ETH`
                : "—"}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors text-sm text-on-surface"
            >
              <User size={14} className="text-on-surface-variant" />
              My Profile
            </Link>
            <button
              onClick={() => {
                openConnectKit(true);
                setOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors text-sm text-on-surface w-full text-left"
            >
              <Wallet size={14} className="text-on-surface-variant" />
              Wallet Settings
            </button>
            <button
              onClick={() => {
                mutate();
                setOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-error/10 transition-colors text-sm text-error w-full text-left"
            >
              <X size={14} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

/** Must be wrapped in `<Suspense>` — `usePathname` opts into client routing state. */
function NavbarContent() {
  const pathname = usePathname();
  const { isConnected, address } = useConnection();
  const { isWrongNetwork, currentChainName } = useWrongNetwork();
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

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
      <div className="flex items-center justify-between px-8 py-4 w-full max-w-[1920px] mx-auto">
        <div className="flex items-center gap-12">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tighter text-primary-container uppercase font-headline"
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

        <div className="flex items-center gap-6">
          <GlobalSearch />

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
