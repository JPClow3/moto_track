# App completion audit

Requested outcome: finish the app and all features. The public roadmap and
maintained parity/deployment documents define the minimum scope. Existing code,
local tests, an isolated Neon/Auth environment, hosted deployment and provider
acceptance are separate evidence layers. This audit does not mark the goal done.

## Implementation in progress (2026-10-23)

| Capability                         | Current implementation                                                                                                                   | Evidence still required                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Maintenance date prediction        | Recent observed riding pace; confirmed history; calendar interval wins when earlier; optional actual service date                        | Browser persistence, linked-plan lifecycle and date urgency                                                 |
| Tire replacement mileage/date      | Explicit wear observation mileage/time; metadata corrections preserve known history; unknown legacy history stays unknown                | Browser lifecycle; database rollback probes passed                                                          |
| Total ownership cost per km        | Purchase date, price and acquisition mileage; owner-scoped costs since acquisition, including insurance                                  | Authenticated browser persistence and totals                                                                |
| Calendar reminders                 | Authenticated `.ics` download and hashed, expiring, revocable subscription links                                                         | Authenticated export, anonymous feed access, revocation and calendar-client acceptance                      |
| Nearby fuel stations               | Coordinates entered or requested explicitly; rider's latest same-fuel/grade observation within 30 days, sorted by price                  | Browser location, station edits and filtering                                                               |
| Odometer photo reading             | OCR preview, editable confirmation and explicit save                                                                                     | Image-provider and authenticated browser acceptance                                                         |
| Manual-source transparency         | Existing staff source-age/item-count view                                                                                                | Current staff browser acceptance                                                                            |
| Shared garages and workshop access | Verified-email invitations, viewer/contributor/workshop roles, revocation, audit log; owner writes serialized before bike locks          | Browser invitation and permission journeys; actual database role/revocation and concurrent FK probes passed |
| Workshop labor comparison          | Explicit per-record consent, actual labor split, withdrawal, five distinct accounts per workshop/service/city/state                      | Browser journeys; real cohort, equal-weight, withdrawal and cascade probes passed                           |
| Phased official maintenance        | Individual service occurrences, original in-service date, actual replacement clocks, history corrections and stale-completion protection | Browser template application; database lifecycle probes passed; final correction tests pending              |
| English                            | Public/app/auth/admin/legal/export copy, locale negotiation, saved notification language                                                 | Final translation tests and browser journeys; branch QA only                                                |
| Offline fuel queue                 | Fixing authentication redirects, explicit server acknowledgement, stable retry IDs and account binding                                   | Regression and browser acceptance pending                                                                   |

## Browser acceptance status (2026-10-27, America/Sao_Paulo)

Disposable Neon Auth e2e on `release-verify-20261027` / PR #47 proved:

| Capability                 | Browser evidence                                                       |
| -------------------------- | ---------------------------------------------------------------------- |
| Ownership cost per km      | completion-flows acquisition save + reload                             |
| Calendar reminders         | create private feed, anonymous GET, revoke, `.ics` download            |
| Nearby fuel                | feature-acceptance same-grade/premium/stale filtering                  |
| Odometer OCR confirm       | preview does not write until confirm (provider mocked at boundary)     |
| Manual-source transparency | staff source versions / item counts                                    |
| Shared garages             | invite/revoke/accept/workshop role enforcement                         |
| Workshop labor comparison  | five-account unlock, equal weight, withdrawal                          |
| Phased maintenance         | exact model-year occurrence persistence                                |
| Tire wear observations     | remaining distance + confirmed reset                                   |
| Offline fuel queue         | durable ACK, no resurrection, expired-auth drafts                      |
| English / locale           | public locale suite 5/5                                                |
| Responsive shell           | core + data routes within viewport at 320–1280px after date-format fix |

Still not browser-proven against **production providers**: live Mistral OCR, Dodo paid renewal, R2 ownership with real bucket, VAPID push delivery.

## Remaining roadmap scope

- Keep disposable browser acceptance green as the app changes.
- Expand exact, year-specific schedules only where primary manufacturer evidence
  supports applicability. Four new Dafra model-years are automatic; contradictory
  or incompletely mapped official documents remain visibly advisory.
- In-app parts purchasing through a supported Mercado Livre integration.
- Real insurance quotations through a selected insurer/aggregator.

The owner confirmed on 2026-10-23 that Mercado Livre and insurer partner/test
credentials are not available. Those integrations remain open requirements.
External search links and saved policy records do not prove purchase or quoting.
The OAuth transport is prepared and tested by contract; authorization persistence,
partner credentials and a supported purchasing/quoting contract remain pending.

## Current validation evidence

- Disposable Neon: migrations through `210000` applied;
  root tire function was reapplied before its `160000` correction. Production
  has not been migrated or deployed.
- Database probes passed for tire observations, ownership totals, membership
  revocation, concurrent garage actors, maintenance history/phase correction,
  idempotent completion and workshop cohort privacy. Fixtures were rolled back
  or explicitly removed from the disposable branch.
- `npm run db:verify` passed against an empty, local PostgreSQL 16 database:
  all 35 migrations applied, and the second run applied none. The temporary
  server was stopped after verification.
- A database regression passed for an initial odometer of 1,200 km, a later
  fill-up at 1,300 km, and deletion back to the original 1,200 km baseline.
  Existing motorcycles with ambiguous record-backed history are not assigned
  an invented creation reading.
- Durable offline acknowledgement probes passed for lost responses, deletion
  without resurrection, conflicting ownership/payloads, legacy tombstones,
  adoption of existing records, transactional rollback and account deletion.
  The disposable transaction was reverted and no fixture rows remained.
- Authenticated browser checks passed for login, calendar download/private
  subscription/revocation, acquisition-basis persistence and the core responsive
  matrix. Mobile and desktop screenshots of shared-garage and tire pages were
  inspected. These checks predate the final atomic-write source snapshot.
- On 2026-10-27 (America/Sao_Paulo), disposable-auth e2e against
  `release-verify-20261027` on `cursor/release-finish-gaps-5937` (PR #47):
  - completion-flows + feature-acceptance **7/7** (calendar create/revoke/ICS,
    ownership cost, Free-slot concurrency, nearby fuel, OCR confirm-before-write,
    staff sources)
  - tire life, shared garage, maintenance phase, offline fuel, workshop **8/8**
  - public project **15/15** (locale, responsive, PWA, smoke)
    Calendar create/download now live in an always-visible reminders secondary
    section; PageOverflowMenu stays mounted and stops trigger-click close races.
- 320px overflow on `/dashboard` and `/fuel` fixed by formatting activity/list
  Date values (no raw GMT dumps) plus AppShell `min-w-0` / `overflow-x-hidden`.
  core-responsive + data-responsive viewport suites passed after the fix.

- Frozen product snapshot on Node 22.23.4: lint and format checks passed,
  all 701 unit tests passed in 90 files, and the Cloudflare build passed.
  One E2E-only TypeScript narrowing fix and the final browser suites remain
  pending. Subsequent dependency security changes require their own rerun.
- Linux validation uses an isolated temporary checkout and browser libraries
  without changing other project environments. Windows startup stalls are
  tooling evidence, not passing test results. Local browser diagnostics used
  IPv4-first networking with family autoselection disabled; deployed networking
  has not been validated by this run.
- A configuration-presence check found no local Mistral, VAPID or push-encryption
  credentials. OCR and notification-provider acceptance remain pending; no
  receipt was sent to an image provider and no reminder delivery was triggered.
- Read-only Cloudflare metadata confirms that current Pages previews share
  production resources. No provider settings, production schema or deployment
  were changed. Production secret names are present but their values and actual
  provider acceptance remain unverified.

## Required acceptance

- `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:unit`,
  `npm run test:e2e`, `npm run build`, and migration verification.
- Authenticated happy paths, validation errors, authorization boundaries,
  persistence after reload and responsive views for each changed journey.
- Disposable Neon branch: migrations apply and rerun cleanly; new constraints
  and triggers enforce their intended invariants.
- Offline/public coverage is independent from authenticated/provider coverage.
- Production migrations and deployment need their own verified result.
- Dodo paid renewal, refund/dispute handling, scheduled email/push delivery,
  operational recovery and the deployment runbook remain release requirements;
  local mocks or a zero-value trial do not prove provider acceptance.

## Release blockers (explicit)

These remain open and prevent declaring the product release-ready:

1. **Production Neon migrate + Pages/Workers deploy** — disposable branch only; production schema/deploy unverified.
2. **Provider acceptance** — local env has no `MISTRAL_*`, `DODO_*`, `R2_*`, or `VAPID_*` values; `PRODUCTION_PROVIDER_SMOKE` cannot run here. Shared Pages previews still point at production bindings, so tip commits keep `[CF-Pages-Skip]`.
3. **Mercado Livre / insurer partner credentials** — owner confirmed unavailable (2026-10-23); OAuth transport alone is not purchase/quoting proof.
4. **Legal counsel sign-off** on terms/privacy/commercial copy.

This audit does not mark the release goal done while any blocker above is unmet.

## Working environment

- Git branch: `cursor/release-finish-gaps-5937` (continues `work/complete-product-flows`).
- Isolated Neon branch: `release-verify-20261027` (`br-twilight-hat-ac2ujtl1`),
  project `misty-meadow-08424188`. Production has not been migrated by this work.
- On 2026-10-27 the 15 pending migrations through
  `20261023220000_maintenance_first_replacement_deadline.sql` applied cleanly to
  that disposable branch; a second `npm run db:push` applied none. Integration
  probes passed with fixtures rolled back: `tests/integration/core-flows.cjs`,
  `garage-account-concurrency.cjs`, `workshop-benchmark.cjs`, and
  `offline-fuel-receipts.cjs`.
- Local disposable configuration and credentials are kept in ignored
  `.env.finish-app`; do not commit or publish that file.
