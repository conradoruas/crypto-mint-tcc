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
    metadataResolved: boolean;
    attributes: GqlAttribute[];
    collection: {
      id: string;
      contractAddress: string;
      traitDefinitions: Array<{
        key: string;
        label: string;
        type: string;
        options: GqlTraitOption[];
      }>;
    } | null;
  } | null;
}

type Props = {
  nftContract: string;
  tokenId: string;
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
  const traitMeta: Record<string, { label: string; type: string }> = {};
  for (const def of nftData.collection?.traitDefinitions ?? []) {
    traitMeta[def.key] = { label: def.label, type: def.type };
    freqMap[def.key] = {};
    for (const opt of def.options) {
      freqMap[def.key][opt.value] = Number(opt.frequency);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
        <Layers size={14} className="text-primary" />
        Traits
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {nftData.attributes.map((attr) => {
          const meta = traitMeta[attr.traitType];
          const type = meta?.type ?? "string";
          const displayValue =
            type === "boolean"
              ? attr.valueStr === "true"
                ? "Yes"
                : attr.valueStr === "false"
                  ? "No"
                  : "—"
              : type === "date"
                ? formatDateValue(attr.valueStr)
                : attr.valueStr !== null
                  ? attr.valueStr
                  : attr.valueNum !== null
                    ? attr.valueNum
                    : "—";
          const freq = type !== "number" && type !== "date" && attr.valueStr !== null
            ? (freqMap[attr.traitType]?.[attr.valueStr] ?? null)
            : null;

          return (
            <div
              key={attr.traitType}
              className="bg-primary/5 border border-primary/10 rounded-sm p-3 space-y-0.5"
            >
              <p className="text-[9px] font-headline font-bold uppercase tracking-widest text-primary/70 truncate">
                {meta?.label ?? attr.traitType}
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

function formatDateValue(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}
