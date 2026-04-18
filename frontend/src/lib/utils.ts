import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncates an Ethereum address to the form `0x1234…abcd`. */
export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/**
 * Formats a Unix timestamp as a human-readable relative time string.
 *
 * @param suffix - When true (default), appends " ago". Set to false for
 *                 compact contexts like notification dropdowns.
 *
 * @example
 * formatTimeAgo(ts)               // "5m ago"
 * formatTimeAgo(ts, { suffix: false }) // "5m"
 */
export function formatTimeAgo(ts?: number, { suffix = true }: { suffix?: boolean } = {}): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  let label: string;
  if (diff < MINUTE) label = `${diff}s`;
  else if (diff < HOUR) label = `${Math.floor(diff / MINUTE)}m`;
  else if (diff < DAY) label = `${Math.floor(diff / HOUR)}h`;
  else label = `${Math.floor(diff / DAY)}d`;
  return suffix ? `${label} ago` : label;
}

/**
 * Compact variant of {@link formatTimeAgo} — no "ago" suffix, no seconds unit.
 * Used in space-constrained contexts like the bell dropdown.
 *
 * @deprecated Pass `{ suffix: false }` to `formatTimeAgo` instead.
 */
export function formatTimeShort(ts?: number): string {
  return formatTimeAgo(ts, { suffix: false });
}
