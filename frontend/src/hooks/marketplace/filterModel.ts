export type SortOption =
  | "default"
  | "price_asc"
  | "price_desc"
  | "offer_desc"
  | "listed_first"
  | "id_asc"
  | "id_desc"
  | "rarity_rank_asc"
  | "rarity_rank_desc";

export const SORT_LABELS: Record<SortOption, string> = {
  default: "Default",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  offer_desc: "Top Offer",
  listed_first: "Listed First",
  id_asc: "ID Ascending",
  id_desc: "ID Descending",
  rarity_rank_asc: "Rarest First",
  rarity_rank_desc: "Most Common First",
};
