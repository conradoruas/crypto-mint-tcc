"use client";

import Link from "next/link";
import {
  Bell,
  Activity,
} from "lucide-react";
import { cn, formatTimeShort } from "@/lib/utils";
import { useActivityFeed, ActivityEvent } from "@/hooks/activity";
import { getEventConfig } from "@/lib/eventConfig";
import { useState, useRef, useMemo } from "react";
import { fetchBatchNFTMetadata } from "@/lib/nftMetadata";
import { useStableArray } from "@/hooks/useStableArray";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useQuery } from "@tanstack/react-query";

const EVENT_CONFIG = getEventConfig(12);

const BELL_STORAGE_KEY = "bell_last_seen_ts";

export function BellDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(BELL_STORAGE_KEY) ?? "0", 10);
  });
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

  const eventKeys = stableUserEvents.map((e) => `${e.nftContract}-${e.tokenId}`);
  const { data: metaMap = new Map() } = useQuery({
    queryKey: ["bell-meta", address, eventKeys],
    queryFn: () =>
      fetchBatchNFTMetadata(
        stableUserEvents.map((e) => ({
          contractAddress: e.nftContract,
          tokenId: e.tokenId,
        })),
      ),
    enabled: stableUserEvents.length > 0,
    staleTime: 5 * 60_000,
  });

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
        <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto sm:right-0 top-[64px] sm:top-full sm:mt-2 sm:w-80 bg-background border border-outline-variant/20 shadow-2xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto sm:max-h-none sm:overflow-visible">
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
                if (!cfg) return null;
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
                      {formatTimeShort(event.timestamp)}
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
