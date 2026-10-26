import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

// The Batch 1 API (MR-Garments-Backend). The browser calls /api/* on this origin and Next forwards it, so the session
// cookie stays first-party. Read at build time: set API_URL before `next build` (each worktree's .env.local).
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The directory that holds the real node_modules. In the main checkout that is this project. In a screen
    // agent's worktree (.claude/worktrees/<name>, node_modules linked to the main checkout) it is the main
    // checkout, which contains the worktree, so Turbopack can follow the link.
    root: dirname(realpathSync(join(import.meta.dirname, "node_modules"))),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites: async () => [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }],
};

export default nextConfig;
