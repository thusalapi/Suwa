# design-sync notes (Suwa)

Repo-specific knowledge for future syncs. Read this first.

## Setup facts

- **Shape: `package`, synth-entry mode** — this is a Next.js app, not a built component
  library. There is no `dist/`. The converter bundles from source via the barrel entry
  `src/design-system.ts` (`--entry ./src/design-system.ts`, `--node-modules ./node_modules`).
- **Components are pinned via `componentSrcMap`** (no `.d.ts` exports to auto-discover).
  When you add a component to `src/design-system.ts`, also add it to `componentSrcMap` and
  (if it has meaningful props) `dtsPropsFor`.
- **`.d.ts` contracts are hand-written in `cfg.dtsPropsFor`.** Synth-entry can't extract
  real prop types (it emits `[key: string]: unknown`). These bodies are maintained by hand
  — **update them when a component's props change**, or the design agent gets a stale API.
- **CSS is generated, not committed.** `cfg.buildCmd` runs the Tailwind CLI to compile
  `.design-sync/.cache/ds-styles.css` (gitignored) from `src/app/globals.css` + component
  sources. The re-sync driver re-runs `buildCmd`; if running the converter directly, run
  `buildCmd` first.
- **Default theme is in CSS too.** `src/app/globals.css` has a `:root { --ds-* }` block
  mirroring `lib/design/theme.ts` `defaultTheme`, so components self-style without the
  React layout (needed for the Claude Design catalog/agent). **Keep the `:root` block in
  sync with `theme.ts` when the palette changes.**
- **Previews use inline styles for layout glue.** Tailwind utility classes used only in
  `.design-sync/previews/*.tsx` are NOT in the compiled CSS (it scans component sources,
  not previews), so preview layout wrappers use `style={{…}}`; components carry their own
  DS classes.
- **Playwright pin:** `playwright` + `playwright-core` are pinned to **1.52.0** in
  `.ds-sync/` to match the cached chromium build **1169** (`~/AppData/Local/ms-playwright`).
  Latest playwright pins build 1228 (not cached) and fails "Executable doesn't exist".

## Known render warns

- None outstanding. All 8 components graded `good`, render check clean (8/8).

## Re-sync risks (watch-list)

- `ds-styles.css` is generated + gitignored — must be regenerated (`buildCmd`) before a
  re-sync; the driver does this when source changed (use `--force` if in doubt).
- `cfg.dtsPropsFor` and the `:root` defaults in `globals.css` are hand-maintained mirrors
  of the real code — they silently drift if components/theme change without updating them.
- Playwright/chromium version pin (1.52.0 / build 1169) — if the browser cache is cleared,
  reinstall a matching version or let playwright download chromium.
- **As the component set grows (Stage 1+), re-run `/design-sync`** to add new components.
  Authored previews (`.design-sync/previews/`) and grades carry forward; new components
  start on the floor card until authored.
