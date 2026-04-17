import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GlobalSearch } from "../GlobalSearch";
import type { CollectionInfo } from "@/types/collection";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

// Collections data controlled per-test via the mock return value
const mockUseCollections = vi.fn();
vi.mock("@/hooks/collections", () => ({
  useCollections: () => mockUseCollections(),
}));

// Apollo: skip subgraph queries (NEXT_PUBLIC_SUBGRAPH_URL not set for these tests)
vi.mock("@apollo/client/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client/react")>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, loading: false }),
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: new Map(), isLoading: false }),
  };
});

vi.mock("@/lib/alchemyMeta", () => ({
  fetchAlchemyMeta: vi.fn().mockResolvedValue(new Map()),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeCollection(
  overrides: Partial<CollectionInfo> = {},
): CollectionInfo {
  return {
    contractAddress: "0xcollection0000000000000000000000000000001",
    creator: "0xcreator",
    name: "Pixel Punks",
    symbol: "PPK",
    description: "A test collection",
    image: "",
    maxSupply: BigInt(100),
    mintPrice: BigInt("10000000000000000"),
    createdAt: BigInt(1700000000),
    totalSupply: BigInt(5),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GlobalSearch", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseCollections.mockReturnValue({ collections: [], isLoading: false });
    // Ensure SUBGRAPH_URL is not set so nftResults branch is skipped
    delete process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  });

  // ── initial render ─────────────────────────────────────────────────────────

  it("renders search input with correct aria-label", () => {
    render(<GlobalSearch />);
    expect(
      screen.getByRole("combobox", { name: /search collections and nfts/i }),
    ).toBeInTheDocument();
  });

  it("starts with an empty input and no dropdown", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("");
    expect(screen.queryByText(/no results/i)).toBeNull();
  });

  // ── search interaction ─────────────────────────────────────────────────────

  it("shows clear button when query is non-empty", () => {
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "px" } });
    expect(
      screen.getByRole("button", { name: /clear search/i }),
    ).toBeInTheDocument();
  });

  it("does not show clear button when input is empty", () => {
    render(<GlobalSearch />);
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });

  it("clear button resets the input", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "pixel" } });
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(input).toHaveValue("");
  });

  // ── no results ─────────────────────────────────────────────────────────────

  it("shows 'No results' message when query matches nothing", () => {
    mockUseCollections.mockReturnValue({ collections: [], isLoading: false });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/no results for/i)).toBeInTheDocument();
  });

  // ── collection results ─────────────────────────────────────────────────────

  it("shows matching collections in dropdown", () => {
    mockUseCollections.mockReturnValue({
      collections: [makeCollection({ name: "Pixel Punks", symbol: "PPK" })],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "pixel" },
    });
    expect(screen.getByText("Pixel Punks")).toBeInTheDocument();
  });

  it("matches collections by symbol", () => {
    mockUseCollections.mockReturnValue({
      collections: [makeCollection({ name: "Pixel Punks", symbol: "PPK" })],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "ppk" },
    });
    expect(screen.getByText("Pixel Punks")).toBeInTheDocument();
  });

  it("matches collections by contract address", () => {
    const addr = "0xdeadbeef0000000000000000000000000000cafe";
    mockUseCollections.mockReturnValue({
      collections: [
        makeCollection({ contractAddress: addr, name: "DeadBeef" }),
      ],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "deadbeef" },
    });
    expect(screen.getByText("DeadBeef")).toBeInTheDocument();
  });

  it("does not show collections that do not match the query", () => {
    mockUseCollections.mockReturnValue({
      collections: [makeCollection({ name: "Pixel Punks" })],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzz" },
    });
    expect(screen.queryByText("Pixel Punks")).toBeNull();
  });

  it("requires at least 1 character to show collection results", () => {
    mockUseCollections.mockReturnValue({
      collections: [makeCollection({ name: "Pixel Punks" })],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    // Dropdown opens but no results section since length < 1
    expect(screen.queryByText("Pixel Punks")).toBeNull();
  });

  // ── keyboard navigation ────────────────────────────────────────────────────

  it("pressing Escape clears the query", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "pixel" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("pressing Enter navigates to explore with the query", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "pixel" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/explore?q=pixel");
  });

  it("pressing Enter on an empty query does not navigate", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── 'See all results' link ─────────────────────────────────────────────────

  it("shows 'See all results in Explore' link when dropdown is open", async () => {
    mockUseCollections.mockReturnValue({
      collections: [makeCollection()],
      isLoading: false,
    });
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "pixel" },
    });
    await waitFor(() =>
      expect(
        screen.getByText(/see all results in explore/i),
      ).toBeInTheDocument(),
    );
  });
});
