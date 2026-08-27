# End-to-end UI journeys (Playwright)

These walk the **real user flows** through a browser. Run them **headed** to *watch* the
application work — a good way to learn the journeys.

## One-time setup

1. Start the database (Docker): the dev DB must be up with migrations applied.
2. Seed the **isolated E2E tenant** (its own clinic + owner + templates + a service, so the tests
   never touch your real clinic data):

   ```bash
   npm run seed:e2e
   ```

   Login it creates: `e2e.owner@suwa.test` / `Passw0rd!` (override with `E2E_EMAIL` / `E2E_PASSWORD`).

The dev server is started/reused automatically by Playwright (`http://localhost:3000`).

## Running

| Command | What it does |
|---|---|
| `npm run e2e` | Headless — fast, for a green/red check. |
| `npm run e2e:headed` | **Opens a browser and plays each journey** (auto-slowed to ~0.5s/step so you can follow). |
| `npm run e2e:ui` | Playwright's **time-travel UI** — step through actions, see before/after DOM snapshots. |
| `npm run e2e:report` | Open the HTML report (traces, screenshots, video) from the last run. |

Watch a single journey, slowed right down:

```bash
E2E_SLOWMO=900 npx playwright test e2e/03-report-lifecycle.spec.ts --headed
```

Every run records a **trace** (`npm run e2e:report` → click a test → "Trace") so you can scrub through
the whole flow even after a headless run.

## The journeys

1. **01-auth** — wrong password is rejected, then sign in and out.
2. **02-patient-registration** — search the finder, register a new patient via the "register new"
   shortcut (the typed phone carries over), open the record.
3. **03-report-lifecycle** — find patient → pick a template → enter a result → create a draft →
   edit the draft → verify (sign-off) → download the branded PDF.
4. **04-billing-lifecycle** — find patient → add a catalog line → create the bill → record a
   payment → it settles to **Paid** → download the receipt PDF.
5. **05-owner-admin** — add a service, update clinic settings, list/open templates, invite a team
   member, open the revenue report (owner-only areas).
6. **06-dashboard-nav** — the KPI cards are clickable shortcuts; the topbar nav reaches every area.

Tests create uniquely-keyed data (timestamped phones/emails) so they're safe to re-run; the seed is
idempotent. Reports/traces are gitignored.
