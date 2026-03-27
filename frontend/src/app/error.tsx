"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 flex items-center justify-center mx-auto bg-error/5 border border-error/20 rounded-sm">
          <AlertTriangle size={28} className="text-error" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tighter uppercase mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-on-surface-variant">
            An unexpected error occurred. You can try reloading the page or go
            back to the previous screen.
          </p>
          {error.message && (
            <p className="mt-3 text-xs font-mono text-error/70 bg-error/5 border border-error/10 px-3 py-2 rounded-sm text-left break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 font-headline font-bold px-5 py-2.5 text-sm rounded-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed uppercase tracking-wider hover:brightness-110 transition-all"
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <button
            onClick={() => window.history.back()}
            className="font-headline font-bold px-5 py-2.5 text-sm rounded-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-all uppercase tracking-wider"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
