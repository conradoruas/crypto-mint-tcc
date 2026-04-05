"use client";

import { useConnection } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Wallet, Sparkles } from "lucide-react";

interface WalletGuardProps {
  children?: React.ReactNode;
  message?: string;
}

/**
 * Standardized guard component for pages requiring a wallet connection.
 * Renders a consistent "Connect Wallet" view if disconnected.
 */
export function WalletGuard({ children, message }: WalletGuardProps) {
  const { isConnected } = useConnection();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center min-h-[60vh] animate-in fade-in duration-700">
        <div className="relative mb-8">
          <div className="w-20 h-20 flex items-center justify-center bg-surface-container-low border border-outline-variant/15 rounded-sm shadow-2xl relative z-10">
            <Wallet size={32} className="text-primary/40" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-primary/10 border border-primary/20 rounded-sm flex items-center justify-center animate-pulse z-20">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -z-10" />
        </div>

        <span className="text-[10px] font-headline font-bold tracking-[0.3em] text-primary uppercase block mb-3">
          Auth Required
        </span>

        <h2 className="font-headline text-3xl font-bold tracking-tighter text-on-surface mb-3 uppercase">
          Connect your <span className="text-primary italic">Wallet</span>
        </h2>
        
        <p className="text-on-surface-variant text-sm max-w-sm font-light leading-relaxed mb-8">
          {message || "You need to connect your wallet to access this page and interact with the Synthetic Foundry."}
        </p>

        <ConnectKitButton.Custom>
          {({ show }) => (
            <button
              onClick={show}
              className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed font-headline font-bold px-8 py-3 rounded-sm text-xs tracking-widest active:scale-95 transition-all uppercase hover:brightness-110 shadow-lg shadow-primary/10"
            >
              <span className="relative z-10">Connect Wallet</span>
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    );
  }

  return <>{children}</>;
}
