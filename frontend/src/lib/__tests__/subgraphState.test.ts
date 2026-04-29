import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetSubgraphState,
  getSubgraphState,
  setSubgraphState,
  subscribeSubgraphState,
} from "@/lib/subgraphState";

afterEach(() => {
  __resetSubgraphState();
});

describe("subgraphState store", () => {
  it("starts in 'ok' state", () => {
    expect(getSubgraphState()).toBe("ok");
  });

  it("updates state and notifies subscribers", () => {
    const listener = vi.fn();
    subscribeSubgraphState(listener);
    setSubgraphState("degraded");
    expect(getSubgraphState()).toBe("degraded");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when state is unchanged", () => {
    const listener = vi.fn();
    subscribeSubgraphState(listener);
    setSubgraphState("ok"); // same as initial
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers and unsubscription", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeSubgraphState(a);
    subscribeSubgraphState(b);

    setSubgraphState("down");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    setSubgraphState("ok");
    expect(a).toHaveBeenCalledTimes(1); // stayed
    expect(b).toHaveBeenCalledTimes(2);
  });
});
