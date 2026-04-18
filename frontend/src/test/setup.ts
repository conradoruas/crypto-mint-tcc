import "@testing-library/jest-dom";

// Required env vars — must be set before any module imports @/lib/env
process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS =
  "0x0000000000000000000000000000000000000001";
process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000002";
process.env.ALCHEMY_API_KEY = "test-alchemy-key";
process.env.PINATA_JWT = "test-pinata-jwt";
// Force GraphQL path in useCollections (avoids needing a WagmiProvider)
process.env.NEXT_PUBLIC_SUBGRAPH_URL = "http://localhost:8000/subgraph";

// ── jsdom polyfills ────────────────────────────────────────────────────────────

Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    },
  });
}

globalThis.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
