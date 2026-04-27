import { describe, expect, it } from "vitest";
import { buildExploreQueryConfig } from "./exploreQuery";

describe("buildExploreQueryConfig", () => {
  it("builds a direct attributes_ filter for enum traits", () => {
    const config = buildExploreQueryConfig({
      variant: "market",
      collectionAddress: "0x3c5b65723092b0c83d2e4d11b8248666317a2d37",
      page: 1,
      pageSize: 8,
      sort: "default",
      traitFilters: {
        class: ["Mage"],
      },
      nowBucketed: 0,
    });

    expect(config.variables.where).toMatchObject({
      collection: "0x3c5b65723092b0c83d2e4d11b8248666317a2d37",
      attributes_: {
        traitType: "class",
        valueStr_in: ["Mage"],
      },
    });
    expect(config.variables.where).not.toHaveProperty("and");
  });

  it("builds a direct attributes_ filter for numeric traits", () => {
    const config = buildExploreQueryConfig({
      variant: "market",
      collectionAddress: "0xabc",
      page: 1,
      pageSize: 8,
      sort: "default",
      traitFilters: {
        level: { min: 2, max: 5 },
      },
      nowBucketed: 0,
    });

    expect(config.variables.where).toMatchObject({
      collection: "0xabc",
      attributes_: {
        traitType: "level",
        valueNum_gte: "2",
        valueNum_lte: "5",
      },
    });
  });
});
