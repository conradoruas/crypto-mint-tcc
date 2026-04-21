import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Enforce logger usage — disallow raw console calls across the codebase.
      "no-console": "error",
      // Explicit any defeats TypeScript's safety guarantees.
      "@typescript-eslint/no-explicit-any": "error",
      // Enforce import type for type-only imports (helps bundler tree-shaking).
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Non-null assertions silence type errors rather than fixing them.
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Accessibility: promote next/config warnings to errors for the most impactful rules.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
    },
  },
  {
    // The logger module itself calls console directly — exempt it.
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Vitest uses importOriginal<typeof import("...")>() which requires inline
    // dynamic import types — not a module-level type import, so the rule
    // doesn't apply here. Non-null assertions are also common in test
    // setup closures where TypeScript cannot infer definite assignment.
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
]);

export default eslintConfig;
