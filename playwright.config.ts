import { defineConfig, devices } from "@playwright/test";

// Load .env so E2E_EMAIL / E2E_PASSWORD (and PORT) stay in sync between `npm run seed:e2e` and the
// test process — Playwright doesn't read .env on its own. No-op if the file is absent (e.g. CI).
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env — rely on real env / defaults */
}

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
// Headed runs are for *watching* — pace each action ~1s so flows are easy to follow.
// Override with E2E_SLOWMO (e.g. 1500 to go slower, 0 for full speed).
const slowMo = process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : headed ? 1000 : 0;

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
