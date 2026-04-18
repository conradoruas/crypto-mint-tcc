import type { OfferData, OfferWithBuyer } from "@/types/marketplace";
import { makeAddress } from "./wallet";

export function makeOffer(overrides?: Partial<OfferData>): OfferData {
  return {
    buyer: makeAddress("buyer"),
    active: true,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 86400),
    amount: 500000000000000000n,
    ...overrides,
  };
}

export function makeOfferWithBuyer(
  overrides?: Partial<OfferWithBuyer>,
): OfferWithBuyer {
  return {
    ...makeOffer(),
    buyerAddress: makeAddress("buyer"),
    ...overrides,
  };
}
