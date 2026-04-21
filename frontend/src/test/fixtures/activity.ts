import type { ActivityEvent, ActivityType } from "@/types/marketplace";
import { makeAddress, makeTxHash } from "./wallet";

let _seq = 0;

export function makeActivityEvent(
  overrides?: Partial<ActivityEvent> & { type?: ActivityType },
): ActivityEvent {
  const id = String(++_seq);
  return {
    id,
    type: "sale",
    nftContract: makeAddress("a1"),
    tokenId: "1",
    from: makeAddress("seller"),
    to: makeAddress("buyer"),
    priceETH: "1.0",
    txHash: makeTxHash(id.padStart(2, "0")),
    blockNumber: BigInt(1000 + _seq),
    timestamp: 1700000000 + _seq,
    ...overrides,
  };
}

export function resetActivitySeq() {
  _seq = 0;
}
