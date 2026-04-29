/**
 * Vanilla store for the current subgraph health state.
 *
 * Apollo's response link writes here after every GraphQL request, based on
 * the `x-subgraph-state` header set by /api/subgraph. UI code reads through
 * the `useSubgraphState()` hook below.
 *
 * Kept framework-free where possible so the store itself can be exercised
 * in unit tests without a React tree.
 */

import { useSyncExternalStore } from "react";
import type { SubgraphState } from "./subgraphErrors";

let state: SubgraphState = "ok";
const listeners = new Set<() => void>();

export function getSubgraphState(): SubgraphState {
  return state;
}

export function setSubgraphState(next: SubgraphState): void {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeSubgraphState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset. Not exported via the package barrel. */
export function __resetSubgraphState(): void {
  state = "ok";
  listeners.clear();
}

/**
 * React hook for components that need to render based on subgraph health
 * (e.g. show a "data delayed" pill or pick a fallback data source).
 *
 * Server snapshot returns "ok" so SSR markup matches the optimistic case;
 * the client will hydrate to the real state on first transition.
 */
export function useSubgraphState(): SubgraphState {
  return useSyncExternalStore(
    subscribeSubgraphState,
    getSubgraphState,
    () => "ok",
  );
}
