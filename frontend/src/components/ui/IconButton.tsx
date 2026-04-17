import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  children: ReactNode;
  variant?: "ghost" | "outlined";
  size?: "sm" | "md";
}

const SIZE_CLASS = {
  sm: "p-1.5",
  md: "px-4 py-3",
};

const VARIANT_CLASS = {
  ghost: "text-on-surface-variant hover:text-on-surface",
  outlined:
    "bg-surface-container border border-outline-variant/15 text-on-surface-variant hover:text-on-surface",
};

const BASE_CLASS =
  "rounded-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function IconButton({
  "aria-label": ariaLabel,
  children,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(BASE_CLASS, SIZE_CLASS[size], VARIANT_CLASS[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
