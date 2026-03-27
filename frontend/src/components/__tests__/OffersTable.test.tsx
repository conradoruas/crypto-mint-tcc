import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OffersTable } from "../OffersTable";
import type { OfferWithBuyer } from "@/types/marketplace";

// lucide-react icons render SVGs — no mock needed; jsdom handles them fine.

const FUTURE = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600); // 7 days from now
const PAST = BigInt(Math.floor(Date.now() / 1000) - 1); // already expired

function makeOffer(overrides: Partial<OfferWithBuyer> = {}): OfferWithBuyer {
  return {
    buyer: "0xbuyer000000000000000000000000000000000001",
    buyerAddress: "0xbuyer000000000000000000000000000000000001",
    amount: BigInt("80000000000000000"), // 0.08 ETH
    expiresAt: FUTURE,
    active: true,
    ...overrides,
  };
}

describe("OffersTable", () => {
  const noop = vi.fn();

  beforeEach(() => {
    noop.mockClear();
  });

  // ── loading state ───────────────────────────────────────────────────────────

  it("renders loading skeletons when isLoading=true", () => {
    const { container } = render(
      <OffersTable
        offers={[]}
        isLoading={true}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("does not show offer rows while loading", () => {
    render(
      <OffersTable
        offers={[makeOffer()]}
        isLoading={true}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.queryByText(/ETH/)).toBeNull();
  });

  // ── empty state ─────────────────────────────────────────────────────────────

  it("shows empty message when there are no offers", () => {
    render(
      <OffersTable
        offers={[]}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getByText(/no active offers/i)).toBeInTheDocument();
  });

  // ── offer rows ──────────────────────────────────────────────────────────────

  it("renders one row per live offer", () => {
    const offers = [
      makeOffer({ buyerAddress: "0xAAAA000000000000000000000000000000000001" }),
      makeOffer({ buyerAddress: "0xBBBB000000000000000000000000000000000002" }),
    ];
    render(
      <OffersTable
        offers={offers}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getAllByText(/ETH/)).toHaveLength(2);
  });

  it("shows 'Top offer' badge on the first offer only", () => {
    const offers = [
      makeOffer({ buyerAddress: "0xAAAA000000000000000000000000000000000001" }),
      makeOffer({ buyerAddress: "0xBBBB000000000000000000000000000000000002" }),
    ];
    render(
      <OffersTable
        offers={offers}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getAllByText(/top offer/i)).toHaveLength(1);
  });

  it("displays formatted ETH amount", () => {
    render(
      <OffersTable
        offers={[makeOffer({ amount: BigInt("50000000000000000") })]}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getByText(/0\.05 ETH/)).toBeInTheDocument();
  });

  it("shows truncated buyer address", () => {
    const addr = "0xAbCd000000000000000000000000000000001234" as `0x${string}`;
    render(
      <OffersTable
        offers={[makeOffer({ buyerAddress: addr })]}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getByText(/0xAbCd\.\.\.1234/)).toBeInTheDocument();
  });

  // ── expired offer filtering ─────────────────────────────────────────────────

  it("filters out expired offers", () => {
    const offers = [
      makeOffer({
        buyerAddress: "0xAAAA000000000000000000000000000000000001",
        expiresAt: PAST,
      }),
      makeOffer({
        buyerAddress: "0xBBBB000000000000000000000000000000000002",
        expiresAt: FUTURE,
      }),
    ];
    render(
      <OffersTable
        offers={offers}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    // Only the live offer is rendered; only one ETH amount shown
    expect(screen.getAllByText(/ETH/)).toHaveLength(1);
  });

  it("shows empty state when all offers are expired", () => {
    render(
      <OffersTable
        offers={[makeOffer({ expiresAt: PAST })]}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getByText(/no active offers/i)).toBeInTheDocument();
  });

  // ── owner controls ──────────────────────────────────────────────────────────

  it("does not render Accept button when isOwner=false", () => {
    render(
      <OffersTable
        offers={[makeOffer()]}
        isLoading={false}
        isOwner={false}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("renders Accept button for each live offer when isOwner=true", () => {
    const offers = [
      makeOffer({ buyerAddress: "0xAAAA000000000000000000000000000000000001" }),
      makeOffer({ buyerAddress: "0xBBBB000000000000000000000000000000000002" }),
    ];
    render(
      <OffersTable
        offers={offers}
        isLoading={false}
        isOwner={true}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(2);
  });

  it("calls onAccept with the correct buyer address when clicked", () => {
    const buyer = "0xAbCd000000000000000000000000000000001234" as `0x${string}`;
    render(
      <OffersTable
        offers={[makeOffer({ buyerAddress: buyer })]}
        isLoading={false}
        isOwner={true}
        onAccept={noop}
        isAccepting={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(noop).toHaveBeenCalledOnce();
    expect(noop).toHaveBeenCalledWith(buyer);
  });

  it("disables Accept button while isAccepting=true", () => {
    render(
      <OffersTable
        offers={[makeOffer()]}
        isLoading={false}
        isOwner={true}
        onAccept={noop}
        isAccepting={true}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeDisabled();
  });

  it("does not call onAccept when button is disabled", () => {
    render(
      <OffersTable
        offers={[makeOffer()]}
        isLoading={false}
        isOwner={true}
        onAccept={noop}
        isAccepting={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(noop).not.toHaveBeenCalled();
  });
});
