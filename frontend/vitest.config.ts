import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/services/**",
        "src/components/**",
        "src/app/**/page.tsx",
        "src/app/**/*Client.tsx",
        "src/app/api/**/route.ts",
        "middleware.ts",
      ],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.*",
        "src/test/**",
        // Skip list — provider wiring, static shells, type-only files
        "src/app/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/error.tsx",
        "src/app/not-found.tsx",
        "src/components/Web3Provider.tsx",
        "src/components/ApolloProvider.tsx",
        "src/components/ThemeProvider.tsx",
        "src/components/ClientToaster.tsx",
        "src/lib/index.ts",
        "src/hooks/index.ts",
        "src/lib/graphql/queries.ts",
        "src/types/**",
        "src/constants/**",
        "src/abi/**",
      ],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
