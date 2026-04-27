"use client";

import { useQuery } from "@apollo/client/react";
import { Layers } from "lucide-react";
import { GET_NFT_ATTRIBUTES } from "@/lib/graphql/queries";

interface GqlAttribute {
  traitType: string;
  valueStr: string | null;
  valueNum: string | null;
  displayType: string | null;
}

interface GqlTraitOption {
  value: string;
  count: string;
  frequency: string;
}

interface GqlNftAttributeData {
  nft: {
    id: string;
    rarityRank: number | null;
    rarityScore: string | null;
    rarityTier: string | null;
    metadataResolved: boolean;
    attributes: GqlAttribute[];
    collection: {
      id: string;
      contractAddress: string;
      traitDefinitions: Array<{
        key: string;
        options: GqlTraitOption[];
      }>;
    } | null;
  } | null;
}

type Props = {
  nftContract: string;
  tokenId: string;
};

const TIER_COLORS: Record<string, string> = {
  Mythic: "bg-yellow-500/10 border-yellow-400/40 text-yellow-400",
  Legendary: "bg-purple-500/10 border-purple-400/40 text-purple-400",
  Epic: "bg-blue-500/10 border-blue-400/40 text-blue-400",
  Rare: "bg-green-500/10 border-green-400/40 text-green-400",
  Common: "bg-surface-container border-outline-variant/20 text-on-surface-variant",
};

export function AttributesGrid({ nftContract, tokenId }: Props) {
  const subgraphId = `${nftContract.toLowerCase()}-${tokenId}`;

  const { data, loading } = useQuery<GqlNftAttributeData>(GET_NFT_ATTRIBUTES, {
    variables: { id: subgraphId },
    fetchPolicy: "cache-first",
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-sm animate-pulse bg-surface-container-high" />
        ))}
      </div>
    );
  }

  const nftData = data?.nft;
  if (!nftData || !nftData.metadataResolved || nftData.attributes.length === 0) {
    return null;
  }

  // Build frequency lookup: key → value → frequency
  const freqMap: Record<string, Record<string, number>> = {};
  for (const def of nftData.collection?.traitDefinitions ?? []) {
    freqMap[def.key] = {};
    for (const opt of def.options) {
      freqMap[def.key][opt.value] = Number(opt.frequency);
    }
  }

  const { rarityRank, rarityTier } = nftData;
  const tierColor = rarityTier ? (TIER_COLORS[rarityTier] ?? TIER_COLORS.Common) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-primary" />
          Traits
        </h3>
        {rarityRank !== null && rarityTier && (
          <span
            className={`text-[10px] font-headline font-black px-2 py-0.5 border uppercase tracking-widest rounded-sm ${tierColor}`}
          >
            {rarityTier} · #{rarityRank}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {nftData.attributes.map((attr) => {
          const displayValue =
            attr.valueStr !== null
              ? attr.valueStr
              : attr.valueNum !== null
                ? attr.valueNum
                : "—";
          const freq = attr.valueStr !== null
            ? (freqMap[attr.traitType]?.[attr.valueStr] ?? null)
            : null;

          return (
            <div
              key={attr.traitType}
              className="bg-primary/5 border border-primary/10 rounded-sm p-3 space-y-0.5"
            >
              <p className="text-[9px] font-headline font-bold uppercase tracking-widest text-primary/70 truncate">
                {attr.traitType}
              </p>
              <p className="text-sm font-semibold text-on-surface truncate">
                {displayValue}
              </p>
              {freq !== null && (
                <p className="text-[10px] text-on-surface-variant/60">
                  {(freq * 100).toFixed(1)}% of NFTs
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
