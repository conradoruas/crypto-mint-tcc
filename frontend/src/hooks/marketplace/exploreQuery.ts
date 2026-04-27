import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";
import type { ExploreVariant, NFTItemWithMarket } from "./exploreTypes";
import type { TraitFilters } from "@/types/traits";

/** Client-side trait filter — used when subgraph Attribute entities aren't indexed yet. */
export function matchesClientTraitFilters(
  nft: NFTItemWithMarket,
  filters: TraitFilters,
): boolean {
  const attrs = nft.attributes ?? [];
  for (const [key, val] of Object.entries(filters)) {
    const attr = attrs.find((a) => a.trait_type === key);
    if (!attr) return false;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      if (!val.map((v) => v.toLowerCase()).includes(String(attr.value).toLowerCase())) return false;
    } else if (typeof val === "boolean") {
      if (String(attr.value) !== (val ? "true" : "false")) return false;
    } else if (typeof val === "object" && val !== null) {
      const numVal = Number(attr.value);
      const range = val as { min?: number; max?: number };
      if (range.min !== undefined && numVal < range.min) return false;
      if (range.max !== undefined && numVal > range.max) return false;
    }
  }
  return true;
}

type BuildExploreQueryArgs = {
  variant: ExploreVariant;
  collectionAddress?: string;
  page: number;
  pageSize: number;
  onlyListed?: boolean;
  search?: string;
  sort?: string;
  traitFilters?: TraitFilters;
  nowBucketed: number;
};

// Trait filter dimensions → The Graph `and` clauses on `attributes_`
// Each dimension produces one `attributes_some { traitType, valueStr_in | valueNum_gte/lte }` clause.
// Multiple dimensions are AND-ed via the top-level `and` array (graph-node ≥ 0.31 / specVersion 0.0.8+).
function buildTraitAndClauses(traitFilters: TraitFilters): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  const keys = Object.keys(traitFilters);
  if (keys.length === 0) return clauses;

  // Cap at 10 dimensions to bound query size
  for (const key of keys.slice(0, 10)) {
    const val = traitFilters[key];
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      clauses.push({
        attributes_: {
          traitType: key,
          valueStr_in: val.slice(0, 20),
        },
      });
    } else if (typeof val === "boolean") {
      clauses.push({
        attributes_: {
          traitType: key,
          valueStr: val ? "true" : "false",
        },
      });
    } else if (typeof val === "object" && val !== null) {
      const range = val as { min?: number; max?: number };
      const rangeFilter: Record<string, string> = { traitType: key };
      if (range.min !== undefined) rangeFilter.valueNum_gte = String(range.min);
      if (range.max !== undefined) rangeFilter.valueNum_lte = String(range.max);
      clauses.push({ attributes_: rangeFilter });
    }
  }
  return clauses;
}

export function buildExploreQueryConfig({
  variant,
  collectionAddress,
  page,
  pageSize,
  onlyListed = false,
  search = "",
  sort = "default",
  traitFilters = {},
  nowBucketed,
}: BuildExploreQueryArgs) {
  const skip = (page - 1) * pageSize;
  const traitClauses = buildTraitAndClauses(traitFilters);

  if (variant === "collection") {
    const where: Record<string, unknown> = {
      collection: collectionAddress?.toLowerCase(),
    };
    if (traitClauses.length > 0) {
      where.and = traitClauses;
    }
    return {
      query: GET_NFTS_FOR_CONTRACT,
      skip: !collectionAddress,
      variables: {
        first: pageSize,
        skip,
        where,
        orderBy: "tokenId",
        orderDirection: "asc",
        now: nowBucketed,
      },
      trimExtraRecord: false,
      pageSize,
    };
  }

  const where: Record<string, unknown> = {};
  if (collectionAddress) {
    where.collection = collectionAddress.toLowerCase();
  }
  if (onlyListed) {
    where.listing_ = { active: true };
  }
  if (search.trim() !== "" && /^\d+$/.test(search.trim())) {
    where.tokenId = search.trim();
  }

  let orderBy = "tokenId";
  let orderDirection = "asc";

  switch (sort) {
    case "price_asc":
      where.listing_ = { active: true };
      orderBy = "listing__price";
      break;
    case "price_desc":
      where.listing_ = { active: true };
      orderBy = "listing__price";
      orderDirection = "desc";
      break;
    case "id_desc":
      orderDirection = "desc";
      break;
    case "listed_first":
      orderBy = "listing__active";
      orderDirection = "desc";
      break;
    case "offer_desc":
      where.offers_ = { active: true, expiresAt_gt: nowBucketed };
      break;
    case "rarity_rank_asc":
      orderBy = "rarityRank";
      orderDirection = "asc";
      where.rarityRank_not = null;
      break;
    case "rarity_rank_desc":
      orderBy = "rarityRank";
      orderDirection = "desc";
      where.rarityRank_not = null;
      break;
  }

  // Merge trait AND clauses with the base where
  const finalWhere =
    traitClauses.length > 0
      ? { ...where, and: [...(where.and ? (where.and as unknown[]) : []), ...traitClauses] }
      : where;

  return {
    query: collectionAddress ? GET_NFTS_FOR_CONTRACT : GET_ALL_NFTS,
    skip: false,
    variables: {
      first: pageSize + 1,
      skip,
      where: finalWhere,
      orderBy,
      orderDirection,
      now: nowBucketed,
    },
    trimExtraRecord: true,
    pageSize,
    sort,
  };
}
