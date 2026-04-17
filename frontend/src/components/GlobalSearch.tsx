"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Layers, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCollections } from "@/hooks/collections";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import { useQuery } from "@tanstack/react-query";
import { GET_SEARCH_SUGGESTIONS } from "@/lib/graphql/queries";
import { fetchAlchemyMeta, NFTMeta } from "@/lib/alchemyMeta";
import { resolveIpfsUrl } from "@/lib/ipfs";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;
const DEBOUNCE_MS = 200;

type GqlSuggestionsData = {
  collections: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    totalSupply: string;
  }[];
  nfts: {
    id: string;
    tokenId: string;
    collection: { contractAddress: string; name: string; symbol: string };
  }[];
};

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { collections } = useCollections();

  // 200ms debounce
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim().toLowerCase()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const trimmed = query.trim().toLowerCase();

  // Subgraph search — fires only after debounce settles + ≥2 chars
  const { data: suggestionsData } = useApolloQuery<GqlSuggestionsData>(
    GET_SEARCH_SUGGESTIONS,
    {
      variables: { q: debounced, limit: 5 },
      skip: !SUBGRAPH_ENABLED || debounced.length < 2,
      fetchPolicy: "cache-first",
    },
  );

  // Alchemy metadata only for the ≤5 NFTs actually returned
  const nftTokens = useMemo(
    () =>
      (suggestionsData?.nfts ?? []).map((n) => ({
        contractAddress: n.collection.contractAddress,
        tokenId: n.tokenId,
      })),
    [suggestionsData],
  );

  const { data: metaMap = new Map<string, NFTMeta>() } = useQuery({
    queryKey: ["search-meta", nftTokens.map((t) => `${t.contractAddress}-${t.tokenId}`)],
    queryFn: () => fetchAlchemyMeta(nftTokens),
    enabled: nftTokens.length > 0,
    staleTime: 5 * 60_000,
  });

  // Collection results — from subgraph when available, RPC fallback otherwise
  const collectionResults = useMemo(() => {
    if (trimmed.length < 1) return [];
    if (SUBGRAPH_ENABLED && suggestionsData) {
      return suggestionsData.collections.slice(0, 5);
    }
    return collections
      .filter(
        (c) =>
          c.name.toLowerCase().includes(trimmed) ||
          c.symbol.toLowerCase().includes(trimmed) ||
          c.contractAddress.toLowerCase().includes(trimmed),
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.contractAddress,
        contractAddress: c.contractAddress,
        name: c.name,
        symbol: c.symbol,
        image: c.image ?? "",
        totalSupply: c.totalSupply?.toString() ?? undefined,
      }));
  }, [trimmed, collections, suggestionsData]);

  const nftResults = useMemo(
    () => (SUBGRAPH_ENABLED && trimmed.length >= 1 ? suggestionsData?.nfts ?? [] : []),
    [trimmed, suggestionsData],
  );

  const hasResults = collectionResults.length > 0 || nftResults.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
    if (e.key === "Enter" && trimmed) {
      router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
      setOpen(false);
      setQuery("");
    }
  };

  const clear = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none z-10" />
      <input
        type="text"
        role="combobox"
        aria-controls="search-results-listbox"
        aria-haspopup="listbox"
        aria-expanded={open && trimmed.length >= 1}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (trimmed) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Search collections, NFTs..."
        aria-label="Search collections and NFTs"
        aria-autocomplete="list"
        className="bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-2 pl-10 pr-8 text-sm w-full focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/50 text-on-surface"
      />
      {query && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X size={12} />
        </button>
      )}

      {open && trimmed.length >= 1 && (
        <div className="absolute top-full mt-2 w-full min-w-[280px] bg-background border border-outline-variant/20 shadow-2xl z-50 overflow-hidden">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Collections */}
              {collectionResults.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    Collections
                  </p>
                  {collectionResults.map((c) => (
                    <Link
                      key={c.contractAddress}
                      href={`/collections/${c.contractAddress}`}
                      onClick={clear}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
                    >
                      <div className="w-9 h-9 shrink-0 bg-surface-container-high overflow-hidden relative">
                        {c.image ? (
                          <Image
                            src={resolveIpfsUrl(c.image)}
                            alt={c.name || "Collection Image"}
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Layers size={14} className="text-on-surface-variant/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-headline font-bold truncate text-on-surface">
                          {c.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {c.symbol}
                        </p>
                      </div>
                      {c.totalSupply !== undefined && (
                        <span className="text-[10px] text-on-surface-variant shrink-0">
                          {c.totalSupply} NFTs
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* NFTs */}
              {nftResults.length > 0 && (
                <div
                  className={
                    collectionResults.length > 0
                      ? "border-t border-outline-variant/10"
                      : ""
                  }
                >
                  <p className="px-4 pt-3 pb-1 text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    NFTs
                  </p>
                  {nftResults.map((n) => {
                    const metaKey = `${n.collection.contractAddress.toLowerCase()}-${n.tokenId}`;
                    const meta = metaMap.get(metaKey);
                    return (
                      <Link
                        key={n.id}
                        href={`/asset/${n.tokenId}?contract=${n.collection.contractAddress}`}
                        onClick={clear}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
                      >
                        <div className="w-9 h-9 shrink-0 bg-surface-container-high overflow-hidden flex items-center justify-center relative">
                          {meta?.image ? (
                            <Image
                              src={meta.image}
                              alt={meta.name || "NFT Thumbnail"}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          ) : (
                            <ImageIcon size={14} className="text-on-surface-variant/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-headline font-bold text-on-surface truncate">
                            {meta?.name ?? `#${n.tokenId.padStart(3, "0")}`}
                          </p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {n.collection.name}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="border-t border-outline-variant/10">
            <Link
              href={`/explore?q=${encodeURIComponent(trimmed)}`}
              onClick={clear}
              className="flex items-center gap-2 px-4 py-3 text-xs text-primary hover:bg-surface-container transition-colors font-headline font-bold uppercase tracking-widest w-full"
            >
              <Search size={11} />
              See all results in Explore
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
