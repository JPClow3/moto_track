# Design system rules

Source of truth for colour roles, type, icons and shared UI primitives. Tokens
live in `src/app.css`; Tailwind maps role colours to the same CSS variables.

## Colour roles: red means "your bike needs you"

| Role                                             | Token / class                                                  | Notes                                   |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------- |
| Primary action, including "add" and the page FAB | `.button-primary` (ink)                                        | Hover lifts the ink; it never turns red |
| Secondary action                                 | `.button-secondary`                                            |                                         |
| Marketing CTA                                    | `.button-accent` (brand red fill)                              | Public pages only, one per screen       |
| Destructive trigger                              | `.button-danger` (outlined `--danger`)                         | Every delete/remove                     |
| Destructive confirm                              | `.button-danger-solid`                                         | Only the final confirm inside a dialog  |
| Focus                                            | `--focus` ink outline (`.focus-ring`)                          | Never red                               |
| Invalid field                                    | `--danger` border                                              | Via `:user-invalid`                     |
| Overdue / critical                               | `--accent`, `--accent-soft`                                    | The only red in the signed-in app body  |
| Due soon                                         | `--warning`, `--warning-soft`                                  |                                         |
| OK / done / healthy                              | `--success`, `--success-soft`                                  |                                         |
| Neutral information                              | `--info`, `--info-soft`                                        |                                         |
| Chart categories                                 | `--cat-fuel`, `--cat-maintenance`, `--cat-tires`, `--cat-fees` | Never red, never a status tone          |

`danger`, `success`, `warning` and `info` Tailwind colours resolve to CSS
variables, so opacity modifiers like `bg-danger/10` produce nothing. Use the
`-soft` tokens instead: `bg-[var(--danger-soft)]`.

Active navigation, empty states, decorative icons and table headers are neutral
(ink / muted / `--accent-wash`, which is now a neutral wash).

## Type

- One family: Archivo Variable (`var(--font-sans)`), width axis via
  `font-stretch`.
- `.display` (condensed 76%, weight 750, line-height 1.05) is for page titles,
  section titles and large numerals only.
- `.label-tech` is sentence case, normal width, 12px semibold. Labels are not
  uppercase.
- `.eyebrow` (uppercase, red slashes) is for marketing pages only. App page
  headers have no eyebrow.
- Scale: 12 (caption) / 14 (labels, table cells) / 16 (body, inputs) / 20 (card
  title) / 28 (page title) / 44 (key metric). Nothing below 12px.
- Numbers use `.numeric` (tabular, slashed zero).

## Icons

- Domain icons in `$components/icons` (`Motorcycle`, `Tire`, `OilCan`,
  `Chain`, `SparkPlug`, `Helmet`, `Odometer`, `Workshop`, `VehicleDocument`,
  `VehicleTax`). They share lucide's API (`size`, `class`).
- Generic glyphs come from `lucide-svelte`. Fuel is always lucide `fuel`.
- Never use lucide `bike` (a bicycle) or `circle-gauge` for tires.
- Sizes: 16 inline with text, 20 nav and buttons, 24 empty states and feature
  blocks.

## Primitives (`$components/ui`)

- `StatusBadge` with `tone`: `ok` | `due` | `overdue` | `info` | `neutral`.
- `EmptyState` with `icon`, `title`, `description` and an `action` snippet.
  While a page has no data it replaces the data layout entirely.
- `showToast(message, { tone, action })` from `$components/ui/toast` after a
  successful create, update or delete. `<ToastRegion />` is mounted once in the
  root layout.
- `BrandLogo` (mark + live wordmark, `wordmark={false}` for the mark alone).

## Layout

- Tables collapse to stacked rows below 640px: wrap in `.data-table` and give
  every `<td>` a `data-label`.
- Quick-log deep links: `/fuel?new=1`, `/maintenance?new=1`,
  `/expenses?new=1` open the page's "new record" sheet on load.
- Numeric inputs: decimals use `type="text" inputmode="decimal"` and are parsed
  server-side with `parseLocalizedNumber` / `parseFormNumber` (accepts
  `4,59`). Integers (km, year, days) keep `type="number" inputmode="numeric"`.
