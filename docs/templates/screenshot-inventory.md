# Screenshot Inventory

> The orchestrator copies this file to `docs/screenshot-inventory.md` once the screenshot directory is provided.
> Fill it from the actual files. Never guess filenames, and record dimensions from the image itself.

- **Source directory:** `<absolute path as provided>`
- **Inventoried on:** `<YYYY-MM-DD>`
- **Total files:** `<n>` (`<n>` images, `<n>` other)

## 1. File inventory
One row per file, in directory order.

| # | Filename | Dimensions (px) | Likely screen | Variant | State shown | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | desktop / tablet / mobile | default / empty / error / dialog / menu-open / hover | |

## 2. Screens (grouped)
| Screen | Files (#) | Desktop | Mobile | Other states | Open questions |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 3. Shared layout patterns
- **Shell:** `<sidebar width/collapse behavior, header contents, page background>`
- **Navigation:** `<items in order, labels, icons, grouping, active style>`
- **Page header:** `<title size, breadcrumbs, action placement>`
- **Tables:** `<density, row height, header style, borders, zebra, pagination style>`
- **Forms:** `<label position, field height, spacing, button placement>`
- **Cards/panels:** `<radius, border, shadow, padding>`
- **Badges/status:** `<shape, colors per status>`

## 4. Design tokens observed
| Token | Observed value | Where seen | Current value in globals.css | Action |
| --- | --- | --- | --- | --- |
| `--primary` | | | `oklch(0.205 0 0)` | |
| `--background` | | | | |
| `--border` | | | | |
| `--radius` | | | `0.625rem` | |
| `--status-*` | | | | |
| Font family / sizes | | | Geist | |
| `--page-padding` / `--page-gap` / `--header-height` | | | `1.5rem` / `1.5rem` / `3.5rem` | |

## 5. Reference-to-route mapping
Every screenshot maps to exactly one route and one owner. This table is the source of truth for assignments.

| Screenshot(s) | Route | Page file | Feature folder | Owner agent | Status |
| --- | --- | --- | --- | --- | --- |
| | `/` | `src/app/(dashboard)/page.tsx` | `src/features/dashboard/` | | not started / in progress / review / merged |

## 6. Data needed per screen
| Screen | Entities and fields visible | Existing type/fixture | To add (orchestrator) |
| --- | --- | --- | --- |
| | | | |
