"use client";

import Link from "next/link";
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  User,
  X,
} from "lucide-react";
import { ConnectKitButton, useModal } from "connectkit";
import { useBalance, useDisconnect } from "wagmi";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export function WalletDropdown({ address }: { address: string }) {
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

export { ConnectKitButton };
