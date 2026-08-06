# Model-first catalog, exact year schedules, defensible sources

Covers the five requests around the motorcycle catalog picker, manual-source
provenance, initial service history, exact year/generation/variant schedules,
and the "what is due now" surface.

Sections 1–5 are **shipped**. Section 6 is the remaining work, which is
content transcription rather than code.

---

## 1. The picker showed one motorcycle three times

The Model dropdown rendered one `<option>` per `motorcycle_templates` row, and
the label interpolated the year range even though the form asks for a year
separately:

```
Biz 125 Família de vendas BR · 2006–2026
CG 150 / CG 160 Família de vendas BR · 2006–2026
CG 160 Start · 2019
CG 160 Start · 2018
```

Two structurally different row types collided in that list: sales-line rows
(`variant = 'Família de vendas BR'`, spanning 2006–2026) and exact rows
(single model year, `is_exact_schedule = true`). Renaming the label alone would
not have fixed it — the model _identity_ was the template row.

### What shipped

`motorcycle_models` makes the model a first-class row (brand + model + variant
→ `display_name`), and `motorcycle_templates.model_id` turns templates into the
per-year entries hanging off it. The picker asks for a model, then a year; the
pair resolves to exactly one template, which still carries the manual source,
documents and intervals.

Verified against the database after migrating: **22 template rows → 21 models**,
with `CG 160 Start` a single model offering 2019 and 2018 in its year dropdown.

Sales-line templates were deliberately **not** split into per-trim rows. Doing
so would have meant inventing year coverage per trim that no manual in the
catalog supports. They stay selectable as their own model with
`variant = 'Linha'`, and the UI badges the difference (`Agenda exata` vs
`Linha`) instead of hiding it.

**Overlap tie-break:** when a sales line and an exact schedule both cover a
year, the exact one wins — it was transcribed from that year's manual. The wide
row only fills years no exact row covers. `groupCatalogModels` is the single
implementation; `resolveCatalogSelection` runs the same helper server-side
rather than re-deriving the rule in SQL, so the template the rider saw
described is the template that gets applied.

| File                                                                                              | Change                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [20260806090000_model_first_catalog.sql](../db/migrations/20260806090000_model_first_catalog.sql) | `motorcycle_models`, `model_id`, backfill, `motorcycle_templates_visible_needs_model`, rewritten catalog-selection trigger |
| [motorcycle-catalog.ts](../src/lib/server/domain/motorcycle-catalog.ts)                           | `CatalogModel`, `groupCatalogModels`, `loadCatalogModels`, `resolveCatalogSelection`; replaced `getTemplateForYear`        |
| [CatalogPicker.svelte](../src/lib/components/CatalogPicker.svelte)                                | Brand → Model → Year, shared by garage and onboarding                                                                      |

---

## 2. The garage never asked about service history

[garage/+page.server.ts](<../src/routes/(app)/garage/+page.server.ts>) called
`applyMotorcycleTemplate` with five arguments. The sixth, `initialHistory`,
defaults to `{}`, and `initialHistoryStatus(undefined)` returns `"unknown"` —
so every plan item created from the garage silently recorded no stated history.
A second bike added at 50,000 km got exactly the assumption the onboarding step
exists to prevent. Onboarding did it correctly; the garage path did not, and
nothing tested `applyMotorcycleTemplate`, which is why it went unnoticed.

Fixed by extracting [InitialHistoryStep.svelte](../src/lib/components/InitialHistoryStep.svelte)
and rendering it in both flows, with the garage `create` action building the
same `history_${maintenance_type}` record onboarding builds.

---

## 3. History was write-once

`savePlan`'s `on conflict … do update set` deliberately updates only
`interval_km`, `interval_days`, `is_active` and `updated_at`, and the
maintenance page rendered `initial_history_status` read-only. A rider who
answered "não sei" and later found the receipt had to delete and recreate the
plan.

Added an `updateHistory` action on the maintenance page. It writes the status,
`last_done_km` and `last_done_date`, then re-runs `syncPlanReminder` with the
new `reference_km` so the reminder and the dashboard cannot disagree about the
same service. The odometer is only stored when the rider confirms the service
was actually done.

---

## 4. Due-now card

The card already had urgency, estimated cost and the manual link. Three real
gaps remained, now closed in [due-now.ts](../src/lib/server/domain/due-now.ts):

1. **"Overdue" conflated two different things.** `dueStateForPlan` returns
   `overdue` both for a confirmed service past its interval and for one the
   rider reported as never done — the first has a milestone behind it, the
   second has no odometer to measure from. A separate `confidence` field now
   distinguishes them, so a stated fact does not read as a measurement.
2. **The five-item cap was global.** One neglected bike filled every slot and
   hid that a second bike needed attention. Items are now drawn round-robin:
   each motorcycle surfaces its most urgent item before any bike surfaces its
   second, with the most urgent bike served first within each round.
3. **No fallback when a plan has no manual source.** The link silently
   disappeared; it now falls back to a garage link.

Extracting the logic out of `+page.server.ts` also made it testable — it had no
coverage before.

---

## 5. Validation

```bash
npm run check && npm run lint && npm run format:check && npm run test:unit && npm run build
```

All green: 196 unit tests across 46 files, including new suites for
`groupCatalogModels` ([catalog-models.test.ts](../tests/unit/catalog-models.test.ts))
and `buildDueNow` ([due-now.test.ts](../tests/unit/due-now.test.ts)).

The migration was applied with `npm run db:push` and the resulting catalog
verified by running the real query against the database.

**Not verified in a browser:** garage, onboarding and maintenance are all
behind authentication. The changes are covered by type-check, build, unit tests
and a live-database query, but nobody has clicked through the new picker.

---

## 6. Remaining work — schedule coverage

The structure now supports exact year/generation/variant schedules. What it
does not have is data, and that gap cannot be closed by code:

- **Only 2 of 22 templates are exact schedules** — Honda CG 160 Start 2019 and 2018. Everything else is a sales line whose intervals are advisory.
- **Nine templates are selectable with zero maintenance items** — every Dafra,
  Shineray and KTM entry has a manual source and specs but no transcribed
  table, so choosing them produces no schedule at all. Either transcribe their
  tables or make the empty state explicit in the picker.
- **`last_verified_date` is recorded but never acted on.** A staff view listing
  sources by age would give it meaning.

### Transcription bar

The CG 160 Start 2019 entry is the quality bar to match: locate the official
PDF, record `official_url`, `document_version`, `page_reference` (both printed
and PDF page numbers), a fixed `last_verified_date` literal, and
`coverage_notes` stating what the source does **and does not** cover:

> "Cobre somente Honda CG 160 Start, ano-modelo 2019, uso normal. O PDF não
> identifica a geração; confirme pelo ano/modelo no chassi."

New migrations must stay re-runnable (`on conflict … do update`), avoid RLS /
policy / `to anon` / `to authenticated` syntax, guard constraint additions with
`if not exists`, use fixed date literals rather than `now()`, and pin
`search_path` on any new plpgsql function — all enforced by
[migration-syntax.test.ts](../tests/unit/migration-syntax.test.ts).
