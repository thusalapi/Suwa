import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end UI tests that walk the real user journeys against the running dev server.
 * Run headed to WATCH the flows:  npm run e2e:headed   (or  npm run e2e:ui  for the time-travel UI).
 *
 * Prereqs: the Docker DB up + `npm run seed:e2e` once (creates an isolated E2E clinic + owner so
 * these tests never touch your real clinic data). Traces/screenshots are captured for every run —
 * open the last report with `npm run e2e:report`.
 */
const PORT = Number(process.env.PORT ?? 3000);
const headed = process.argv.includes("--headed") || process.argv.includes("--ui");
const slowMo = process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : headed ? 500 : 0;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // serial: shared DB + so a watcher sees one journey at a time
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on",
    screenshot: "on",
    video: "retain-on-failure",
    launchOptions: { slowMo },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
