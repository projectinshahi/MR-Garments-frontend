import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;
