import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";
import type { ExploreVariant } from "./exploreTypes";

type BuildExploreQueryArgs = {
  variant: ExploreVariant;
  collectionAddress?: string;
  page: number;
  pageSize: number;
  onlyListed?: boolean;
  search?: string;
  sort?: string;
  nowBucketed: number;
};

export function buildExploreQueryConfig({
  variant,
  collectionAddress,
  page,
  pageSize,
  onlyListed = false,
  search = "",
  sort = "default",
  nowBucketed,
}: BuildExploreQueryArgs) {
  const skip = (page - 1) * pageSize;

  if (variant === "collection") {
    return {
      query: GET_NFTS_FOR_CONTRACT,
      skip: !collectionAddress,
      variables: {
        first: pageSize,
        skip,
        where: { collection: collectionAddress?.toLowerCase() },
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
