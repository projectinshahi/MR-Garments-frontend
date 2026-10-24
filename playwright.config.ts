import { defineConfig, devices } from "@playwright/test";

// Parallel screen agents each get their own E2E_PORT (see their assignment) so servers never collide.
const PORT = Number(process.env.E2E_PORT ?? 3100);

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
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Production server, so tests see the same output as the build.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
