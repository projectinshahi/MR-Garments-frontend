import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { MANAGEMENT_STATE } from "./e2e/sessions";

// Browser tests sign in for real (B4) against the API on its own test database. Settings come from the git-ignored
// .env.test.local (decision W6):
//   E2E_PASSWORD   the password the test database is seeded with. Never commit or print it.
//   BACKEND_DIR    the backend checkout or worktree to start (default ../MR-Garments-Backend)
//   BACKEND_NODE   a Node 22 executable for the backend (default "node")
//   E2E_PORT, E2E_API_PORT   frontend and API ports (default 3100 and 4100)
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

const PORT = Number(process.env.E2E_PORT ?? 3100);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const APP_URL = `http://localhost:${PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // One worker, so one browser process. On the development machine two or more Chromium processes loading
  // localhost at the same time stall (any server, Next or a bare node:http one), which made shell.spec.ts fail
  // at random. The cause is not confirmed; the antivirus web filter is only a suspect.
  // See docs/multi-agent-plan.md, "Browser tests".
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Signs in once per run through AUTH-1 and saves the sessions in playwright/.auth/ (git-ignored).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Specs run signed in as Management unless they choose another session (e2e/sessions.ts).
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: MANAGEMENT_STATE }, dependencies: ["setup"] },
  ],
  webServer: [
    {
      // The API, after resetting and seeding its test database with E2E_PASSWORD (backend scripts/start-e2e.ts).
      command: `"${process.env.BACKEND_NODE ?? "node"}" --import tsx scripts/start-e2e.ts`,
      cwd: resolve(process.env.BACKEND_DIR ?? "../MR-Garments-Backend"),
      url: `${API_URL}/api/v1/health`,
      env: { PORT: String(API_PORT), APP_ORIGIN: APP_URL },
      // Never reuse: every run starts from a freshly seeded database.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Production server, so tests see the same output as the build. API_URL is read at build time (rewrites).
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: APP_URL,
      env: { API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
