import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Navbar } from "../NavBar";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

vi.mock("wagmi", () => ({
  useConnection: vi.fn().mockReturnValue({ isConnected: false, address: undefined }),
  useBalance: vi.fn().mockReturnValue({ data: undefined }),
  useDisconnect: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

vi.mock("connectkit", () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: object) => React.ReactNode }) =>
      children({ isConnected: false, show: vi.fn(), truncatedAddress: undefined, ensName: undefined }),
  },
  useModal: vi.fn().mockReturnValue({ setOpen: vi.fn() }),
}));

// Avoid rendering the full GlobalSearch (has its own Apollo/hooks deps)
vi.mock("@/components/GlobalSearch", () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));

// Avoid rendering BellDropdown activity feed
vi.mock("@/hooks/useActivityFeed", () => ({
  useActivityFeed: vi.fn().mockReturnValue({ events: [], isLoading: false }),
}));

vi.mock("@/lib/alchemyMeta", () => ({
  fetchAlchemyMeta: vi.fn().mockResolvedValue(new Map()),
}));

import { useConnection } from "wagmi";
import { usePathname } from "next/navigation";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    vi.mocked(useConnection).mockReturnValue(
      { isConnected: false, address: undefined } as unknown as ReturnType<typeof useConnection>,
    );
    vi.mocked(usePathname).mockReturnValue("/");
  });

  // ── branding ───────────────────────────────────────────────────────────────

  it("renders the brand name", () => {
    const { getByText } = render(<Navbar />);
    expect(getByText("crypto.")).toBeInTheDocument();
    expect(getByText("mint")).toBeInTheDocument();
  });

  it("brand links to home", () => {
    const { getAllByRole } = render(<Navbar />);
    const links = getAllByRole("link");
    const brandLink = links.find((l: HTMLElement) => l.getAttribute("href") === "/");
    expect(brandLink).toBeDefined();
  });

  // ── nav links ──────────────────────────────────────────────────────────────

  it("renders Explore, Collections, Activity nav links", () => {
    const { getAllByRole } = render(<Navbar />);
    const hrefs = getAllByRole("link").map((l: HTMLElement) => l.getAttribute("href"));
    expect(hrefs).toContain("/explore");
    expect(hrefs).toContain("/collections");
    expect(hrefs).toContain("/activity");
  });

  it("renders the Mint nav link", () => {
    const { getAllByRole } = render(<Navbar />);
    const mintLinks = getAllByRole("link").filter((l: HTMLElement) => l.getAttribute("href") === "/create");
    expect(mintLinks.length).toBeGreaterThan(0);
  });

  it("does not show Profile link when disconnected", () => {
    const { getAllByRole } = render(<Navbar />);
    const hrefs = getAllByRole("link").map((l: HTMLElement) => l.getAttribute("href"));
    expect(hrefs).not.toContain("/profile");
  });

  it("shows Profile link when wallet is connected", () => {
    vi.mocked(useConnection).mockReturnValue(
      { isConnected: true, address: "0xabc0000000000000000000000000000000000001" } as unknown as ReturnType<typeof useConnection>,
    );
    const { getAllByRole } = render(<Navbar />);
    const hrefs = getAllByRole("link").map((l: HTMLElement) => l.getAttribute("href"));
    expect(hrefs).toContain("/profile");
  });

  // ── active link styling ────────────────────────────────────────────────────

  it("applies active class to the current route link", () => {
    vi.mocked(usePathname).mockReturnValue("/explore");
    const { getAllByRole } = render(<Navbar />);
    const exploreLink = getAllByRole("link").find((l: HTMLElement) => l.getAttribute("href") === "/explore");
    expect(exploreLink?.className).toMatch(/primary-container/);
  });

  it("does not apply active class to non-current route links", () => {
    vi.mocked(usePathname).mockReturnValue("/explore");
    const { getAllByRole } = render(<Navbar />);
    const collectionsLink = getAllByRole("link").find((l: HTMLElement) => l.getAttribute("href") === "/collections");
    expect(collectionsLink?.className).not.toMatch(/primary-container/);
  });

  // ── wallet button ──────────────────────────────────────────────────────────

  it("shows 'Connect Wallet' button when disconnected", () => {
    const { getByText } = render(<Navbar />);
    expect(getByText(/connect wallet/i)).toBeInTheDocument();
  });

  it("shows disabled bell and wallet icon buttons when disconnected", () => {
    const { getByRole } = render(<Navbar />);
    expect(getByRole("button", { name: /activity notifications/i })).toBeDisabled();
    expect(getByRole("button", { name: /^wallet$/i })).toBeDisabled();
  });

  it("renders GlobalSearch component", () => {
    const { getByTestId } = render(<Navbar />);
    expect(getByTestId("global-search")).toBeInTheDocument();
  });
});
