import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output:
    "playwright-report/**",
    "test-results/**",
    // Subagent git worktrees (each is linted from inside its own tree):
    ".claude/worktrees/**",
    // Vendored Impeccable skill scripts (third-party, updated by `impeccable update`):
    ".claude/skills/**",
    // Git-ignored screenshot comparison output (scripts/visual-diff.mjs) and throwaway measuring scripts:
    ".visual/**",
  ]),
]);

export default eslintConfig;
