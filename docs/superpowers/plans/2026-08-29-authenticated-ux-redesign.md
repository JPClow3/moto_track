# Authenticated UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every in-scope authenticated Moto Track page around the selected motorcycle-centered timeline, one primary action, and progressively disclosed create/edit flows.

**Architecture:** Add a small set of content-agnostic Svelte UI primitives, then migrate route-owned forms into a shared native-dialog sheet without changing server action names or field contracts. Fuel is the complete vertical slice; generic CRUD pages then reuse the same shell while domain-heavy routes keep their forms local and adopt the shared hierarchy.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript 5.8, TailwindCSS 3, native `<dialog>`, Lucide Svelte, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-authenticated-ux-redesign-design.md`

## Global Constraints

- Preserve every existing page load function, SvelteKit action name, submitted field name, validation schema, offline fuel flow, OCR endpoint, and database table contract.
- Add no runtime dependency; use the existing `lucide-svelte` package and native `<dialog>`.
- Keep Barlow/Barlow Condensed, theme variables, 44px minimum targets, visible focus rings, and reduced-motion behavior from `src/app.css`.
- Keep route slugs as explicit lowercase nonlocalized values; translated labels must never build URLs.
- Desktop verification viewport is exactly 1440 by 1024; mobile verification viewport is exactly 390 by 844.
- No in-scope record page may show a permanent creation form in its default state.
- Each migrated route must remain functional when its task is committed.

---

### Task 1: Shared authenticated-page primitives

**Files:**
- Create: `src/lib/components/app/PageHeader.svelte`
- Create: `src/lib/components/app/PageAction.svelte`
- Create: `src/lib/components/app/BikeContextBar.svelte`
- Create: `src/lib/components/app/SignalStrip.svelte`
- Create: `src/lib/components/app/ActivityTimeline.svelte`
- Create: `src/lib/components/app/RecordSheet.svelte`
- Create: `src/lib/components/app/ActionMenu.svelte`
- Create: `src/lib/components/app/PageOverflowMenu.svelte`
- Modify: `src/app.css`
- Create: `tests/unit/authenticated-ux-contract.test.ts`

**Interfaces:**
- Produces: `RecordSheet.open(): void` and `RecordSheet.close(reason?: string): void`.
- Produces: `ActionMenu.open(): void` and `ActionMenu.close(): void`.
- Produces: `ActionChoice = { id: string; label: string; description: string; recommended?: boolean; disabled?: boolean }`.
- Produces: named slots `actions`, `overflow`, `context`, and default content used by route pages.

- [ ] **Step 1: Write the failing shared-component contract test**

Create `tests/unit/authenticated-ux-contract.test.ts` with source-level assertions that guard native dialog semantics, the stable mobile action class, focus restoration, and reduced-motion rules:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("authenticated UX primitives", () => {
  it("uses native dialogs and restores focus", () => {
    const sheet = source("src/lib/components/app/RecordSheet.svelte");
    expect(sheet).toContain("<dialog");
    expect(sheet).toContain("showModal()");
    expect(sheet).toContain("returnFocus?.focus()");
  });

  it("keeps the mobile action above bottom navigation", () => {
    const action = source("src/lib/components/app/PageAction.svelte");
    expect(action).toContain("page-action-mobile");
    expect(action).toContain("aria-label");
  });

  it("removes sheet motion when reduced motion is requested", () => {
    const sheet = source("src/lib/components/app/RecordSheet.svelte");
    expect(sheet).toContain("prefers-reduced-motion: reduce");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL because `src/lib/components/app/RecordSheet.svelte` and the other primitives do not exist.

- [ ] **Step 3: Implement the shared page and metric primitives**

Use legacy-compatible Svelte exports and slots so current route components can adopt the primitives incrementally. `PageHeader.svelte` owns semantic heading structure, while `SignalStrip.svelte` accepts an array with this exact type:

```ts
export type Signal = {
  label: string;
  value: string;
  hint?: string;
};

export let eyebrow = "";
export let title: string;
export let description = "";
export let signals: Signal[] = [];
```

Render no more than `signals.slice(0, 3)` and separate metrics with dividers rather than nested panels.

- [ ] **Step 4: Implement `RecordSheet` with native-dialog behavior**

The component stores the initiating element, opens modally, restores focus after close, and exposes methods:

```svelte
<script lang="ts">
  import { X } from "lucide-svelte";

  export let title: string;
  export let description = "";
  export let closeLabel = "Close";
  export let dismissible = true;

  let dialog: HTMLDialogElement;
  let returnFocus: HTMLElement | null = null;

  export function open() {
    returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
  }

  export function close(reason = "cancel") {
    dialog.close(reason);
  }

  function restoreFocus() {
    returnFocus?.focus();
    returnFocus = null;
  }
</script>

<dialog bind:this={dialog} class="record-sheet" on:close={restoreFocus}>
  <section class="record-sheet-panel" aria-labelledby="record-sheet-title">
    <header>
      <h2 id="record-sheet-title">{title}</h2>
      <button type="button" class="focus-ring" aria-label={closeLabel} on:click={() => close()}>
        <X aria-hidden="true" />
      </button>
      {#if description}<p>{description}</p>{/if}
    </header>
    <div class="record-sheet-body"><slot /></div>
    <footer><slot name="footer" /></footer>
  </section>
</dialog>
```

Backdrop click closes only when `dismissible` is true. CSS renders a right rail at `min-width: 1024px`, a bottom/full-height sheet below that breakpoint, contains internal scrolling, reserves mobile bottom-nav space, and disables transitions for reduced motion.

- [ ] **Step 5: Implement `ActionMenu`, responsive `PageAction`, and overflow disclosure**

`ActionMenu` accepts `choices: ActionChoice[]` and dispatches a `select` event whose detail is the choice `id`. `PageAction` renders one desktop label and one icon-first mobile control with the same click event and an explicit `ariaLabel`. `PageOverflowMenu` uses `<details>` with an accessible `<summary>` and a slotted menu surface.

- [ ] **Step 6: Run shared tests, Svelte check, and formatting**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts
npm run check
npm run format:check
```

Expected: all commands PASS.

- [ ] **Step 7: Commit the shared primitives**

```powershell
git add src/lib/components/app src/app.css tests/unit/authenticated-ux-contract.test.ts
git commit -m "feat: add authenticated page UX primitives"
```

---

### Task 2: Stable generic CRUD routes and sheet-based `FeaturePage`

**Files:**
- Modify: `src/lib/components/FeaturePage.svelte`
- Modify: `src/routes/(app)/documents/+page.svelte`
- Modify: `src/routes/(app)/reminders/+page.svelte`
- Modify: `src/routes/(app)/trabalho/+page.svelte`
- Modify: `src/routes/(app)/expenses/+page.svelte`
- Modify: `src/lib/i18n/locales/pt-BR.ts`
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`

**Interfaces:**
- Consumes: `PageHeader`, `PageAction`, `BikeContextBar`, `RecordSheet`, `ActivityTimeline`, and `PageOverflowMenu` from Task 1.
- Produces: `FeaturePage.routeSlug: string`, independent from `feature.slug`, and optional `addLabel: string`.
- Preserves: root CRUD actions driven by `_intent=create`, `_intent=update`, and `_intent=delete`.

- [ ] **Step 1: Add failing route and permanent-form assertions**

Extend `authenticated-ux-contract.test.ts`:

```ts
it("keeps generic export routes stable and moves creation into a sheet", () => {
  const feature = source("src/lib/components/FeaturePage.svelte");
  expect(feature).toContain("export let routeSlug: string");
  expect(feature).toContain("href={`/${routeSlug}/export.csv`}");
  expect(feature).toContain("<RecordSheet");
  expect(feature).not.toContain('xl:grid-cols-[minmax(0,1fr)_360px]');
});

it.each([
  ["documents", 'routeSlug="documents"'],
  ["reminders", 'routeSlug="reminders"'],
  ["trabalho", 'routeSlug="trabalho"'],
])("uses a stable route for %s", (route, marker) => {
  const page = source(`src/routes/(app)/${route}/+page.svelte`);
  expect(page).toContain(marker);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL because `FeaturePage` does not expose `routeSlug` or use `RecordSheet`.

- [ ] **Step 3: Refactor `FeaturePage` presentation without changing CRUD forms**

Add `export let routeSlug: string; export let addLabel = "";`. Replace the permanent 360px form rail with a `PageAction` and `RecordSheet`. Keep the existing field loop inside the sheet and keep `_intent=create`. Replace row-level inline edit `<details>` with an edit button that opens a single edit sheet populated from `selectedRow`.

On success, close the active sheet after `update()`; on failure, keep it open and focus the status alert. Keep the existing `ConfirmDialog` delete flow.

- [ ] **Step 4: Convert generic route pages to explicit slugs and localized titles**

Pass these exact values:

```svelte
<FeaturePage routeSlug="documents" ... />
<FeaturePage routeSlug="reminders" ... />
<FeaturePage routeSlug="trabalho" ... />
<FeaturePage routeSlug="expenses" ... />
```

Keep localized `feature.title` and `feature.subtitle`, but stop overwriting `feature.slug` with navigation copy. Move Work cost settings and Documents reminder creation below the main timeline as secondary sections; do not place them inside the create-record sheet.

- [ ] **Step 5: Make reminder fields conditional on trigger type**

Within the generic field renderer, special-case route `reminders`: bind the reminder trigger select to `reminderTrigger`, render only date fields for `date`, mileage fields for `mileage`, and recurrence fields for `recurring`. Preserve all original input `name` attributes so the server schema remains unchanged.

- [ ] **Step 6: Add localized shared action and sheet copy**

Add matching `authenticatedUx` keys in both locale files for add, edit, close, more actions, filters, scan receipt, enter manually, repeat last, processing, review before saving, and empty-timeline hints. Do not hardcode visible Portuguese copy in shared components.

- [ ] **Step 7: Run focused and existing generic-route verification**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts tests/unit/feature-config.test.ts tests/unit/reminders.test.ts
npm run check
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 8: Commit generic route migration**

```powershell
git add src/lib/components/FeaturePage.svelte src/routes/(app)/documents src/routes/(app)/reminders src/routes/(app)/trabalho src/routes/(app)/expenses src/lib/i18n tests/unit/authenticated-ux-contract.test.ts
git commit -m "feat: streamline generic record pages"
```

---

### Task 3: Fuel vertical slice

**Files:**
- Modify: `src/routes/(app)/fuel/+page.svelte`
- Modify: `src/lib/i18n/locales/pt-BR.ts`
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`
- Modify: `tests/e2e/data-responsive.spec.ts`

**Interfaces:**
- Consumes: all Task 1 primitives.
- Preserves: `?/createRecord`, `?/repeatLast`, `?/ocrScan`, `?/deleteRecord`, import, preference, station, grade, and review-setting actions.
- Produces: action ids `fuel-scan`, `fuel-manual`, and conditional `fuel-repeat`.

- [ ] **Step 1: Add failing Fuel hierarchy assertions**

```ts
it("gives Fuel one add action and three progressive entry paths", () => {
  const fuel = source("src/routes/(app)/fuel/+page.svelte");
  expect(fuel).toContain('id: "fuel-scan"');
  expect(fuel).toContain('id: "fuel-manual"');
  expect(fuel).toContain('id: "fuel-repeat"');
  expect(fuel).toContain("<RecordSheet");
  expect(fuel).toContain("<SignalStrip");
  expect(fuel).not.toContain('id="fuel-new-record"');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL because Fuel still renders a permanent form and details panels.

- [ ] **Step 3: Recompose Fuel around the selected Bike Timeline concept**

Use `PageHeader`, `BikeContextBar`, and a three-item `SignalStrip`. Select the active motorcycle from the filter/default motorcycle and show its latest known odometer. Keep the existing consumption data, but render a compact trend adjacent to the signals. Render recent fill-ups in date order as a divider-based timeline; retain accessible labels on mobile and the existing delete confirmation.

- [ ] **Step 4: Move all entry paths into action menu and sheets**

Create `fuelChoices` with scan, manual, and repeat only when `data.rows.length > 0`. `select` opens one of three `RecordSheet` instances. Move the existing create, OCR, and repeat forms intact into their corresponding sheets. OCR submit remains `?/ocrScan`; when `form?.ocr` exists, automatically reopen the scan sheet in review state and render the parsed values in editable manual fields before `?/createRecord` can save.

- [ ] **Step 5: Move low-frequency tools behind overflow**

Keep import preview visible only after it exists. Place Export CSV, filters, CSV import, defaults, stations, grades, and review settings inside `PageOverflowMenu` or a secondary settings sheet. Do not delete any existing action or management form.

- [ ] **Step 6: Preserve offline and error behavior**

Keep `handleCreateRecord`, offline queue status, and sync request. Success closes the manual/review sheet after update. Failure leaves the sheet open with the alert visible. OCR errors keep the scan sheet open and the file-picker path available.

- [ ] **Step 7: Extend authenticated Playwright coverage**

In `data-responsive.spec.ts`, after sign-in and navigation to `/fuel`, assert the add button is visible at 1440 and 390 widths, open the menu, verify scan/manual choices, select manual, verify a dialog with date/odometer/liters/total fields, press Escape, and verify focus returns to the add trigger. Keep the existing environment-based skip.

- [ ] **Step 8: Run Fuel verification**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts tests/unit/fuel.test.ts tests/unit/fuel-ocr.test.ts tests/unit/offline-fuel.test.ts
npm run check
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 9: Commit Fuel vertical slice**

```powershell
git add src/routes/(app)/fuel/+page.svelte src/lib/i18n tests/unit/authenticated-ux-contract.test.ts tests/e2e/data-responsive.spec.ts
git commit -m "feat: rebuild Fuel around quick capture"
```

---

### Task 4: Dashboard and Garage

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`
- Modify: `src/routes/(app)/garage/+page.svelte`
- Modify: `src/lib/i18n/locales/pt-BR.ts`
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`
- Modify: `tests/e2e/core-responsive.spec.ts`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: Garage create/update/archive/restore actions and Dashboard secondary forms.
- Produces: Dashboard shortcut hrefs and Garage sheet-based create/edit behavior.

- [ ] **Step 1: Add failing default-state assertions**

Assert Dashboard contains `ActivityTimeline` and `ActionMenu`, Garage contains `RecordSheet`, and Garage no longer has a default-state form with the class marker used by its current permanent add panel.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL on Dashboard/Garage component markers.

- [ ] **Step 3: Recompose Dashboard**

Place selected motorcycle context first, derive a unified visual activity list from already-loaded fuel, maintenance, tire, document, and reminder data, and retain the most important upcoming need. `+ Add record` opens shortcut choices linking to `/fuel?action=add`, `/maintenance?action=add`, `/expenses?action=add`, and `/documents?action=add`. Keep existing analytics below the first-view activity section in compact disclosures.

- [ ] **Step 4: Recompose Garage and enforce plan-limit behavior**

Move the existing add/edit motorcycle fields into `RecordSheet`. Show `PageAction` only when `data.entitlements` permits another active motorcycle. At the limit, render concise plan guidance and the existing billing link instead of mounting a disabled form. Keep archive/restore confirmations and motorcycle setup details.

- [ ] **Step 5: Extend responsive tests**

Assert the Dashboard add-record menu is usable and the Garage action is either enabled or replaced by limit guidance. Verify the mobile fixed action does not overlap `.mobile-bottom-nav` by comparing bounding rectangles.

- [ ] **Step 6: Run Dashboard/Garage verification**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts tests/unit/dashboard.test.ts tests/unit/entitlements.test.ts
npm run check
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 7: Commit Dashboard and Garage**

```powershell
git add src/routes/(app)/dashboard src/routes/(app)/garage src/lib/i18n tests/unit/authenticated-ux-contract.test.ts tests/e2e/core-responsive.spec.ts
git commit -m "feat: focus Dashboard and Garage on bike activity"
```

---

### Task 5: Maintenance and Tires

**Files:**
- Modify: `src/routes/(app)/maintenance/+page.svelte`
- Modify: `src/routes/(app)/tires/+page.svelte`
- Modify: `src/lib/i18n/locales/pt-BR.ts`
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`
- Modify: `tests/e2e/core-responsive.spec.ts`
- Modify: `tests/e2e/data-responsive.spec.ts`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: every existing maintenance, plan, part, photo, marketplace, tire installation, pressure, catalog, edit, and delete action.
- Produces: Maintenance action ids `maintenance-log` and `maintenance-plan`; Tire action ids `tires-pressure` and `tires-install`.

- [ ] **Step 1: Add failing hierarchy assertions**

Assert both pages use `PageHeader`, `BikeContextBar`, `ActionMenu`, and `RecordSheet`, and no longer expose the existing permanent form panel markers in their default page grids.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL on Maintenance and Tires.

- [ ] **Step 3: Recompose Maintenance**

Render upcoming/due work before completed history. Move completed-service and new-plan forms into separate sheets selected from one add menu. Keep parts, marketplace, photos, and suggestions within the relevant record/detail disclosure or page overflow. Preserve current focus helpers by pointing them to the sheet trigger or sheet field after opening.

- [ ] **Step 4: Recompose Tires**

Render current front/rear tire state and replacement need first, then installation and pressure history. Move pressure and install/replace forms into separate sheets. Move catalog management into overflow. Keep edit and delete actions with confirmation.

- [ ] **Step 5: Extend authenticated responsive tests**

At 390px, verify each page has one visible add trigger, the action menu lists the two intended choices, and opening each form yields a dialog without horizontal overflow. At 1440px, verify the first history row begins within the 1024px viewport height.

- [ ] **Step 6: Run domain and UI verification**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts tests/unit/maintenance-forecast.test.ts tests/unit/maintenance-photo.test.ts tests/unit/tire-life.test.ts tests/unit/catalog-models.test.ts
npm run check
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 7: Commit Maintenance and Tires**

```powershell
git add src/routes/(app)/maintenance src/routes/(app)/tires src/lib/i18n tests/unit/authenticated-ux-contract.test.ts tests/e2e
git commit -m "feat: streamline maintenance and tire workflows"
```

---

### Task 6: Expenses, Work secondary tools, and Reports

**Files:**
- Modify: `src/routes/(app)/expenses/+page.svelte`
- Modify: `src/routes/(app)/trabalho/+page.svelte`
- Modify: `src/routes/(app)/reports/+page.svelte`
- Modify: `src/lib/i18n/locales/pt-BR.ts`
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`
- Modify: `tests/e2e/data-responsive.spec.ts`

**Interfaces:**
- Consumes: Task 1 primitives and the sheet-enabled `FeaturePage` from Task 2.
- Preserves: expense CRUD, policy, claim, work-cost settings, sale-report, export, and share actions.
- Produces: Expenses action ids `expense-record`, `expense-policy`, `expense-claim`; Reports primary `Generate report` action.

- [ ] **Step 1: Add failing page-structure assertions**

Assert Expenses defines its three action choices and Reports uses `PageHeader` with `Generate report` while not importing `PageAction`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/authenticated-ux-contract.test.ts`

Expected: FAIL on Expenses and Reports.

- [ ] **Step 3: Recompose Expenses**

Use the generic expense timeline as the main ledger. Open expense creation, policy creation, and claim creation in separate sheets from one action menu. Keep policies and claims below the ledger or behind filters. Treat annual fees as the existing expense record path rather than a permanent competing page form.

- [ ] **Step 4: Recompose Work secondary content**

Keep work records in the shared timeline. Move cost assumptions into overflow/settings, preserve `?/saveCosts`, and show profitability as compact signals plus chronological summaries.

- [ ] **Step 5: Simplify Reports**

Use one `PageHeader` primary action to focus/open the sale-report task. Place data export in a separate secondary section. Preserve report generation, public-share creation/revocation, and current report routes. Localize all visible field labels and use unambiguous locale-formatted dates.

- [ ] **Step 6: Extend responsive tests and run verification**

Run:

```powershell
npx vitest run tests/unit/authenticated-ux-contract.test.ts tests/unit/reports.test.ts tests/unit/report-summary.test.ts tests/unit/sale-report-share.test.ts tests/unit/ownership-cost.test.ts tests/unit/parity.test.ts
npm run check
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 7: Commit Expenses, Work, and Reports**

```powershell
git add src/routes/(app)/expenses src/routes/(app)/trabalho src/routes/(app)/reports src/lib/i18n tests/unit/authenticated-ux-contract.test.ts tests/e2e/data-responsive.spec.ts
git commit -m "feat: clarify expenses work and report tasks"
```

---

### Task 7: Cross-page accessibility and responsive regression coverage

**Files:**
- Modify: `tests/e2e/core-responsive.spec.ts`
- Modify: `tests/e2e/data-responsive.spec.ts`
- Modify: `tests/unit/authenticated-ux-contract.test.ts`
- Modify: `src/lib/components/AppShell.svelte` only if the fixed-action collision test proves a shell spacing issue.
- Modify: `src/app.css` only if shared focus, zoom, or fixed-action rules fail.

**Interfaces:**
- Consumes: all migrated routes and shared component contracts.
- Produces: a repeatable authenticated regression matrix that remains skipped only when the documented auth environment variables are absent.

- [ ] **Step 1: Add keyboard and focus regression scenarios**

For Fuel and one generic route, test Tab access to the primary action, dialog focus placement, Escape close, focus restoration, action-menu keyboard selection, and first-error focus after an intentionally invalid submission when the test account permits mutation.

- [ ] **Step 2: Add geometry and zoom assertions**

At widths 390 and 1440, assert no horizontal overflow, every visible main button is at least 44px high, and the mobile action rectangle ends above the bottom-nav rectangle. Set page scale through a 200% equivalent viewport/zoom check and ensure primary actions remain reachable.

- [ ] **Step 3: Add cross-page default-state assertions**

For every in-scope route, assert no visible default-state form carries the create intent unless the form is inside an open dialog. Assert exactly one primary page action for record routes and the Reports exception.

- [ ] **Step 4: Run authenticated E2E when credentials are available**

Run: `npm run test:e2e`

Expected: PASS. Without `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`, authenticated cases report SKIPPED and public cases PASS; this is not evidence of authenticated runtime behavior and must be supplemented by the logged-in browser run in Task 8.

- [ ] **Step 5: Run complete static and unit verification**

Run:

```powershell
npm run check
npm run lint
npm run format:check
npm run test:unit
npm run build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit regression coverage**

```powershell
git add tests src/lib/components/AppShell.svelte src/app.css
git commit -m "test: cover authenticated quick-action UX"
```

---

### Task 8: Authenticated visual verification and final corrections

**Files:**
- Modify: only files implicated by observed visual or interaction defects.
- Save evidence: `C:/Users/lives/.codex/visualizations/2026/08/29/01a04e22-52e0-70a0-950b-17c1de099701/moto-track-ux-redesign/`

**Interfaces:**
- Consumes: the user’s authenticated Moto Track browser session and the selected Bike Timeline generated concept.
- Produces: accepted desktop/mobile screenshots and a requirement-by-requirement completion audit.

- [ ] **Step 1: Start or verify the local development server**

Run: `npm run dev -- --port 5190`

Expected: Vite reports a local server on port 5190. Keep the returned process handle and poll it rather than starting duplicates.

- [ ] **Step 2: Capture the required dark-theme states**

At 1440 by 1024 and 390 by 844, capture Dashboard, Garage, Fuel default, Fuel action menu, Fuel manual sheet, Fuel OCR upload/review, Maintenance, Tires, Documents, Reminders, Expenses, Work, and Reports. Save numbered PNG files and inspect each saved image before accepting it.

- [ ] **Step 3: Compare against the selected visual target**

Judge page hierarchy, motorcycle context, action placement, number of visible signals, timeline density, permanent-form absence, type scale, spacing, panel nesting, borders, target sizes, and mobile bottom-nav clearance. Fix mismatches in source, then recapture the affected state at the same viewport.

- [ ] **Step 4: Verify light-theme shared tokens**

Capture Fuel default and an open sheet in light theme. Confirm text contrast, dividers, backdrop, focus ring, primary action, and destructive confirmation remain distinct.

- [ ] **Step 5: Exercise recoverable states**

Use the authenticated session to inspect an empty state where available, invalid manual Fuel submission, OCR provider failure or validation failure, successful sheet close/focus restoration where a safe test record can be added, and deletion confirmation without confirming deletion.

- [ ] **Step 6: Run the final command matrix**

Run:

```powershell
npm run check
npm run lint
npm run format:check
npm run test:unit
npm run test:e2e
npm run build
git diff --check
git status --short
```

Expected: all automated commands PASS, authenticated tests either PASS with credentials or are explicitly recorded as skipped, `git diff --check` has no output, and the worktree contains only the final intended correction set.

- [ ] **Step 7: Commit final visual corrections**

If Task 8 changed source files:

```powershell
git add src tests
git commit -m "fix: finish authenticated UX visual QA"
```

If no source file changed, do not create an empty commit.

