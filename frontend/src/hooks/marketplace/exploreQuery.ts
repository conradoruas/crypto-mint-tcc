import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";
import type { ExploreVariant } from "./exploreTypes";
import type { TraitFilters } from "@/types/traits";

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

type TraitWhere = {
  attributes_?: Record<string, unknown>;
};

// The live Studio endpoint accepts a single nested `attributes_` object filter for
// the collection Explore flow. For now we apply the first active dimension only;
// this keeps results correct instead of emitting an invalid `and` filter payload.
function buildTraitWhere(traitFilters: TraitFilters): TraitWhere {
  const keys = Object.keys(traitFilters);
  if (keys.length === 0) return {};

  const key = keys[0];
  const val = traitFilters[key];

  if (Array.isArray(val)) {
    if (val.length === 0) return {};
    return {
      attributes_: {
        traitType: key,
        valueStr_in: val.slice(0, 20),
      },
    };
  }

  if (typeof val === "boolean") {
    return {
      attributes_: {
        traitType: key,
        valueStr: val ? "true" : "false",
      },
    };
  }

  if (typeof val === "object" && val !== null) {
    const range = val as { min?: number; max?: number };
    const rangeFilter: Record<string, string> = { traitType: key };
    if (range.min !== undefined) rangeFilter.valueNum_gte = String(range.min);
    if (range.max !== undefined) rangeFilter.valueNum_lte = String(range.max);
    return {
      attributes_: rangeFilter,
    };
  }

  return {};
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
  const traitWhere = buildTraitWhere(traitFilters);

  if (variant === "collection") {
    const where: Record<string, unknown> = {
      collection: collectionAddress?.toLowerCase(),
      ...traitWhere,
    };
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
  Object.assign(where, traitWhere);
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
  }

  return {
    query: collectionAddress ? GET_NFTS_FOR_CONTRACT : GET_ALL_NFTS,
    skip: false,
    variables: {
      first: pageSize + 1,
      skip,
      where,
      orderBy,
      orderDirection,
      now: nowBucketed,
    },
    trimExtraRecord: true,
    pageSize,
    sort,
  };
}
