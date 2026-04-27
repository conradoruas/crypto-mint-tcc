import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExploreFilters } from "./useExploreFilters";

const mockReplace = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
  useSearchParams: vi.fn(() => currentParams),
}));

describe("useExploreFilters", () => {
  beforeEach(() => {
    currentParams = new URLSearchParams();
    mockReplace.mockReset();
  });

  it("preserves sort and favorites while clearing trait filters on collection switch", () => {
    currentParams = new URLSearchParams(
      "col=0xabc&sort=price_desc&fav=1&t.class=Mage&t.level=1:10",
    );

    const { result } = renderHook(() => useExploreFilters());

    act(() => {
      result.current.setSelectedCollection("0xdef");
    });

    expect(mockReplace).toHaveBeenCalledWith("?col=0xdef&sort=price_desc&fav=1", { scroll: false });
  });

  it("clearFilters removes the selected collection as well", () => {
    currentParams = new URLSearchParams("col=0xabc&listed=1&t.class=Mage");

    const { result } = renderHook(() => useExploreFilters());

    act(() => {
      result.current.clearFilters();
    });

    expect(mockReplace).toHaveBeenCalledWith("?", { scroll: false });
  });
});
