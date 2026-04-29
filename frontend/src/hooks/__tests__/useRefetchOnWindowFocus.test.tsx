import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRefetchOnWindowFocus } from "@/hooks/useRefetchOnWindowFocus";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
}

function fireVisibility() {
  document.dispatchEvent(new Event("visibilitychange"));
}

function fireFocus() {
  window.dispatchEvent(new Event("focus"));
}

describe("useRefetchOnWindowFocus", () => {
  it("calls refetch when the tab becomes visible", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnWindowFocus(refetch));

    setVisibility("visible");
    act(() => fireVisibility());

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not call refetch when visibilitychange fires while hidden", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnWindowFocus(refetch));

    setVisibility("hidden");
    act(() => fireVisibility());

    expect(refetch).not.toHaveBeenCalled();
  });

  it("calls refetch when the window regains focus", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnWindowFocus(refetch));

    act(() => fireFocus());

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("throttles repeated focus events within the throttle window", () => {
    const refetch = vi.fn();
    renderHook(() =>
      useRefetchOnWindowFocus(refetch, { throttleMs: 1000 }),
    );

    act(() => fireFocus());
    act(() => fireFocus());
    act(() => {
      vi.advanceTimersByTime(500);
      fireFocus();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("fires again after the throttle window elapses", () => {
    const refetch = vi.fn();
    renderHook(() =>
      useRefetchOnWindowFocus(refetch, { throttleMs: 1000 }),
    );

    act(() => fireFocus());
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1100);
      fireFocus();
    });

    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("does not attach listeners when disabled", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnWindowFocus(refetch, { enabled: false }));

    act(() => fireFocus());
    setVisibility("visible");
    act(() => fireVisibility());

    expect(refetch).not.toHaveBeenCalled();
  });

  it("uses the latest refetch reference without reattaching listeners", () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ fn }: { fn: () => void }) => useRefetchOnWindowFocus(fn),
      { initialProps: { fn: first } },
    );

    rerender({ fn: second });

    act(() => fireFocus());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes listeners on unmount", () => {
    const refetch = vi.fn();
    const { unmount } = renderHook(() => useRefetchOnWindowFocus(refetch));

    unmount();
    act(() => fireFocus());

    expect(refetch).not.toHaveBeenCalled();
  });
});
