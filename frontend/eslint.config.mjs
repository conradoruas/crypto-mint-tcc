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
    // Enforce logger usage — disallow raw console calls across the codebase.
    rules: {
      "no-console": "error",
    },
  },
  {
    // The logger module itself calls console directly — exempt it.
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
