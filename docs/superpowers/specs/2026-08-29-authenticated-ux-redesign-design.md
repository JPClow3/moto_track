# Moto Track authenticated UX redesign

## Intent

Rebuild the authenticated Moto Track experience around a motorcycle-centered activity timeline and one clear primary action per page. The redesign must make frequent logging fast, especially fuel receipt capture, while preserving the current brand, database model, SvelteKit server actions, and route contracts.

The selected visual direction is the third generated concept, “Bike Timeline”: dark zinc surfaces, restrained red racing accents, condensed technical headings, a persistent motorcycle context, compact signals, and chronological records with lightweight separators rather than a grid of panels.

## Outcomes

- A rider can start the most common task from the first viewport on desktop and mobile.
- Record-creation pages expose one stable `+ Add` action instead of permanent forms.
- Fuel offers receipt OCR, manual entry, and repeat-last from the same action menu.
- Default pages show context, at most three useful signals, and recent or upcoming activity.
- Occasional tools such as export, imports, catalogs, and settings do not compete with daily work.
- Every authenticated page uses the same hierarchy, interaction vocabulary, responsive behavior, and accessibility rules.
- Existing mutations and persisted data continue to work without a database migration.

## Scope

The redesign covers these authenticated routes:

- `/dashboard`
- `/garage`
- `/fuel`
- `/maintenance`
- `/tires`
- `/documents`
- `/reminders`
- `/expenses`
- `/trabalho`
- `/reports`

The sale-report print surface, billing, onboarding, authentication, admin, and public marketing pages are outside this visual refactor except where a shared component change must remain backward compatible.

## Visual language

Retain the existing Moto Track system from `src/app.css`: Barlow and Barlow Condensed, dark/light theme variables, technical labels, minimum 44px controls, visible focus rings, reduced-motion behavior, and Lucide icons. Use spacing, alignment, typography, and row dividers before borders or elevated panels.

Red is the primary-action and selection accent. Destructive actions remain red only inside an explicit confirmation context; ordinary save buttons use the normal primary treatment without resembling deletion. Pages must not introduce gradients, nested cards, decorative badges, or persistent feature inventories.

## Shared page anatomy

Authenticated record pages use this order:

1. Page title, concise description, and stable primary action.
2. Motorcycle context when the task belongs to a motorcycle.
3. A compact signal strip containing zero to three decision-useful values.
4. The primary chronological list or timeline.
5. Secondary tools accessible from overflow, filters, or the record detail view.

The first viewport must contain the page title, motorcycle context when relevant, primary action, and the beginning of the core list. Empty states occupy the same structure and provide one direct action.

## Shared interactions

### Primary action

Record-creation pages use a `PageAction` control in a stable upper-right desktop position. On viewports below the desktop breakpoint, it becomes a thumb-reachable floating action above the existing bottom navigation. Its accessible name includes the object being created, even if the visible mobile label is only a plus icon.

When a page supports one creation path, activating the control opens that form directly. When it supports several distinct paths, it opens an `ActionMenu` containing no more than four choices with a title and one-line explanation.

Pages that do not create records must not display an artificial plus action. Reports uses `Generate report` as its primary task.

### Responsive record sheet

Creation and editing use one `RecordSheet` component backed by native `<dialog>`. It appears as a right-side sheet on desktop and a full-height bottom/full-screen sheet on mobile. It owns the title, description, close control, footer actions, scroll containment, focus restoration, Escape behavior, and backdrop dismissal policy.

Forms remain page-owned slots so existing SvelteKit actions and field names do not change. Desktop and mobile share the same markup; responsive CSS changes only presentation.

### Submission states

- On submit, disable duplicate submission and expose a concise busy label.
- On server validation failure, keep the sheet open, preserve values, render the existing action message, and focus the first invalid field or error summary.
- On success, close the sheet, restore focus to the initiating action, and refresh the list through the existing enhanced form behavior.
- Destructive actions always use the existing confirmation-dialog pattern.

### Fuel OCR

Fuel’s action menu contains exactly:

1. `Scan receipt` — recommended path.
2. `Enter manually`.
3. `Repeat last fill-up` when a previous fill-up exists.

Receipt capture progresses through upload, processing, editable review, and save. OCR never saves automatically. The review step exposes the parsed date, station, liters, total, price per liter, fuel type, odometer, and full-tank status using the same field names as manual entry. Parse or network failure returns to a recoverable review/upload state and never discards the selected file without explanation.

## Shared components

- `BikeContextBar.svelte`: selected motorcycle name, optional image, odometer, and selection slot.
- `PageHeader.svelte`: technical eyebrow, title, description, primary action slot, and overflow slot.
- `PageAction.svelte`: responsive desktop/mobile action control.
- `ActionMenu.svelte`: native-dialog choice list used by multi-path add flows.
- `RecordSheet.svelte`: accessible responsive dialog shell for create and edit forms.
- `SignalStrip.svelte`: zero-to-three compact metrics separated by dividers.
- `ActivityTimeline.svelte`: structural timeline/list wrapper with page-owned row snippets.
- `PageOverflowMenu.svelte`: quiet disclosure for export and low-frequency tools.

Components accept content and callbacks rather than domain objects where possible. Domain forms remain close to their route until repeated form structure is proven.

## Page mapping

### Dashboard

Show the selected motorcycle snapshot, the most important upcoming item, and a unified recent-activity timeline. `+ Add record` offers fuel, maintenance, expense, and document shortcuts. Existing diagnostic and analytics panels move below the activity section or into compact disclosures.

### Garage

Show motorcycles as a scannable list with odometer, status, and next need. `+ Add motorcycle` opens a sheet only when the account can add one. At the plan limit, replace the disabled permanent form with concise limit guidance and the existing upgrade path. Motorcycle editing uses the same sheet.

### Fuel

Use the selected concept most literally: motorcycle/odometer context, three signals (month spend, average consumption, distance since last fill-up or cost per kilometer), a small inline trend, and chronological fill-ups. Remove the permanent manual rail. Move export, filters, stations, grades, defaults, CSV import, and review settings behind overflow or a secondary settings disclosure.

### Maintenance

Lead with upcoming work, followed by completed service history. `+ Add` offers `Log completed service` and `Schedule maintenance`. Parts, marketplace, service suggestions, and photo management live inside the relevant record/detail context or overflow rather than competing as page-level forms.

### Tires

Lead with current front/rear tire status and replacement need, followed by pressure and installation history. `+ Add` offers `Log pressure` and `Install or replace tire`. Tire catalog management moves to overflow.

### Documents

Group documents by motorcycle and expiration state. `+ Add` offers scan/upload and manual metadata entry. Editing and attachment actions live in the record sheet. Route identity remains `/documents` regardless of translated display labels.

### Reminders

Show upcoming reminders chronologically. `+ Add reminder` first asks for trigger type; only date, mileage, or recurring fields relevant to that choice render. Route identity remains `/reminders` regardless of locale.

### Expenses

Show monthly totals and a chronological ledger. `+ Add` offers expense, insurance policy, and claim. Annual fees become an expense subtype rather than a competing permanent form. Policy and claim lists remain available below the ledger or through filtering.

### Work

Show recent work/trip records and relevant totals. `+ Add record` opens the existing form in a sheet. Route identity remains `/trabalho`; translated copy must never determine export or mutation URLs.

### Reports

Separate sale report and data export into two clear tasks. No permanent competing forms and no artificial plus button. The primary action is `Generate report`; secondary exports remain clearly labeled.

## Localization and routing

Visible titles, field labels, action copy, empty states, and validation messages use the active locale consistently. Stable route slugs and server action names are explicit nonlocalized values. `FeaturePage` consumers must pass a route slug separately from the translated page title so export URLs never become `/Documents/export.csv`, `/Reminders/export.csv`, or other localized/cased variants.

## Accessibility

- Native dialog semantics provide focus trapping, background inertness, and Escape behavior.
- Closing a menu or sheet restores focus to its trigger.
- Every icon-only control has a visible tooltip or accessible name.
- Interactive targets remain at least 44 by 44 CSS pixels.
- Focus order follows visual order, and fixed mobile actions do not cover content or bottom navigation.
- Form errors are associated with fields and announced through the existing live status treatment.
- Timeline data remains meaningful without color, icons, charts, or motion.
- Reduced-motion preferences remove sheet and menu transitions.
- Desktop and mobile layouts must work at 200% zoom without losing actions or requiring two-dimensional scrolling for forms.

## Data and server contracts

This is a presentation refactor. Existing page load functions, form field names, validation schemas, server action names, offline fuel queue, OCR endpoints, and database queries remain authoritative. No migration is required. If a route needs a combined timeline representation, the page derives it from already-loaded data unless a measured query gap proves a server change necessary.

## Implementation sequence

1. Add shared primitives and their focused tests.
2. Refactor route slug handling in `FeaturePage` and its consumers.
3. Rebuild Fuel as the full vertical slice, including OCR/manual/repeat flows.
4. Verify Fuel at 1440px and 390px, including keyboard and error behavior.
5. Apply the approved shell to Dashboard and Garage.
6. Apply it to Maintenance and Tires.
7. Apply it to Documents, Reminders, Expenses, and Work.
8. Simplify Reports.
9. Run the complete automated and visual verification matrix.

Each phase must leave its affected route functional; no page may ship with a visible action that opens an unfinished placeholder.

## Verification

Automated verification must include:

- Unit/component contracts for action choice, dialog open/close, focus restoration, stable route slugs, and conditional reminder fields.
- Playwright flows for Fuel manual entry, Fuel OCR entry through editable review, mobile primary-action visibility, and at least one generic-sheet create/edit route.
- Existing unit and end-to-end tests.
- `npm run check`
- `npm run lint`
- `npm run format:check`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

Visual verification compares the implementation with the selected Bike Timeline concept at 1440 by 1024 and 390 by 844. Capture and inspect Dashboard, Garage, Fuel default, Fuel action menu, Fuel manual sheet, Fuel OCR review, Maintenance, Tires, Documents, Reminders, Expenses, Work, and Reports. Verify light and dark themes where shared tokens change appearance.

## Acceptance criteria

- Fuel has one first-viewport add action with OCR, manual, and conditional repeat-last paths.
- No audited record page displays a permanent creation form in its default state.
- Every in-scope page follows the approved title/context/signals/timeline/action hierarchy or the documented Reports exception.
- Mobile primary actions remain visible and do not collide with the bottom navigation.
- Editing uses the shared sheet pattern.
- Export links use stable lowercase route slugs independent of locale.
- Loading, empty, validation-error, OCR-failure, and successful-save states are usable and recoverable.
- Keyboard focus, accessible names, target size, reduced motion, and zoom requirements pass manual inspection.
- All required automated commands pass.
- Captured desktop and mobile screenshots show the selected motorcycle-centered visual direction without persistent form rails or unnecessary panel grids.
