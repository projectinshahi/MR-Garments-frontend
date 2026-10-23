---
paths:
  - "src/features/**"
  - "src/app/(dashboard)/**"
  - "src/app/(app)/**"
  - "src/app/(staff)/**"
  - "src/app/(auth)/**"
  - "e2e/**"
---

# Screen implementation rules

Visual fidelity to the assigned reference screenshots is the primary goal.

- Inspect every screenshot listed in your assignment before writing code. Note the layout grid, spacing, type sizes and weights, colors, borders, radii, shadows, icons, alignment, content density, and every visible state (hover, selected, empty, error, disabled, open menus or dialogs).
- Match the reference. Do not redesign, simplify, reorder, or "improve" it. If something is ambiguous or impossible with the shared components, implement the closest faithful version and list the gap in your report.
- Build from the shell (`PageContainer`, `PageHeader`) and shared components. When a reference needs a token value that differs from `globals.css` (a color, radius, spacing), do not hardcode it. Report the exact value so the orchestrator updates the token for every screen.
- **Data (D1, D2):** transcribe every record visible in your screenshots into `src/features/<feature>/data/fixtures.ts`, exactly as shown, including dates, statuses and labels. Expose them through async functions in `data/queries.ts`. Do not "fix" values to agree with other screens; list the differences in your report instead.
- **Ignore annotation labels (D3)** such as "1.1" or "3.1.a" in the header and bottom-right corner. Exclude them from comparison as well.
- **Undesigned actions (D5)** call `notInPrototype("<label>")`. A button that exists in the screenshot still renders exactly as shown.
- Verify visually: run the app on your assigned dev port (`npm run dev -- --port <dev port>`), then run `node scripts/visual-diff.mjs --url http://localhost:<dev port>/<route> --ref "<absolute reference path>" --out .visual/<name>` (1440 × 900 at 2×, the reference size). Review `compare.png` and repeat until the differences are ones you can name and justify. Run e2e with your assigned `E2E_PORT` set.
- Never claim pixel-perfect. Report what was compared, at what viewport, and what still differs.

Layout of a screen:

```
src/app/(app)/<route>/page.tsx                 async Server Component: await data/queries, render <FeatureScreen data={...} />
src/features/<feature>/data/fixtures.ts        screenshot-faithful typed fixtures (D1, D2)
src/features/<feature>/data/queries.ts         async accessors; the only importer of fixtures.ts
src/features/<feature>/<feature>-screen.tsx    composition; "use client" only if it holds state
src/features/<feature>/<feature>-columns.tsx   TanStack column defs, when the screen has a table
src/features/<feature>/<logic>.ts + .test.ts   pure filtering/derivation logic with its test
e2e/<agent-name>.spec.ts                       one smoke test per screen's main flow
```
