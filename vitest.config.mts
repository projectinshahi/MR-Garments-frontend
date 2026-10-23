import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 resolves tsconfig "paths" (the @/ alias) and transforms TSX natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
