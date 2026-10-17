import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import js from "@eslint/js";

const eslintConfig = defineConfig([
  ...nextVitals,
  { files: ["**/*.{ts,tsx,mts,cts}"], extends: nextTs },
  {
    files: ["scripts/scrape-*.js"],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: "commonjs" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
