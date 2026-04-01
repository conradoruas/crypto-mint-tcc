"use client";

import { Toaster } from "sonner";

export function ClientToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: "bg-surface-container border border-outline-variant/20 text-on-surface font-sans shadow-lg",
        duration: 4000,
      }}
    />
  );
}
