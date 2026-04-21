import { vi } from "vitest";

// Matches Next 16 AppRouterInstance (next/navigation from App Router)

export interface MockRouter {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
}

interface NavigationState {
  pathname: string;
  searchParams: URLSearchParams;
  params: Record<string, string | string[]>;
  router: MockRouter;
}

const state: NavigationState = {
  pathname: "/",
  searchParams: new URLSearchParams(),
  params: {},
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
};

function makeFactory() {
  return {
    usePathname: () => state.pathname,
    useSearchParams: () => state.searchParams,
    useParams: () => state.params,
    useRouter: () => state.router,
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    redirect: vi.fn((url: string) => {
      state.pathname = url;
    }),
    notFound: vi.fn(() => {
      throw new Error("NOT_FOUND");
    }),
    // Next 16 navigation primitives
    permanentRedirect: vi.fn(),
  };
}

export const nextNavigationMock = {
  factory: makeFactory,

  setPathname(pathname: string) {
    state.pathname = pathname;
  },

  setSearchParams(init: URLSearchParams | Record<string, string>) {
    state.searchParams =
      init instanceof URLSearchParams
        ? init
        : new URLSearchParams(init);
  },

  setParams(params: Record<string, string | string[]>) {
    state.params = params;
  },

  get router(): MockRouter {
    return state.router;
  },

  reset() {
    state.pathname = "/";
    state.searchParams = new URLSearchParams();
    state.params = {};
    Object.values(state.router).forEach((fn) => {
      if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
    });
  },
};
