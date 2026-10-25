# Dependency security review — 2026-10-23

The manifest and lockfile contain compatible security updates. This review does
not claim that `npm audit` is clean or that the updated application has passed its
full quality suite. The central validation run must install this lockfile before
running those checks; updating only the lockfile does not update `node_modules`.

## Locked changes

| Package                                      | Previous lock | Current lock |
| -------------------------------------------- | ------------- | ------------ |
| Vite                                         | 7.3.6         | 7.3.7        |
| Vitest and its matching `@vitest/*` packages | 4.1.11        | 4.1.12       |
| `brace-expansion`, major 1                   | 1.1.18        | 1.1.21       |
| `brace-expansion`, major 5                   | 5.0.9         | 5.0.12       |
| `source-map-js`                              | 1.2.1         | 1.2.2        |
| `sharp`                                      | 0.35.4        | 0.35.5       |
| `undici`                                     | 7.29.0        | 7.29.1       |
| `postcss-selector-parser`, major 6           | 6.1.4         | 6.1.5        |
| `postcss-selector-parser`, major 7           | 7.1.4         | 7.1.6        |

The `sharp` update also updates its matching platform packages and bundled
libvips packages from 1.3.3 to 1.3.4. The Vitest update resolves compatible
`chai` 6.3.0 and `tinyrainbow` 3.2.0. Existing authentication overrides and the
explicit `devalue` test dependency are preserved.

Version-specific parser overrides keep Tailwind 3 and `postcss-nested` on their
declared major 6 ranges. ESLint's Svelte parser remains on major 7. The upstream
[6.1.5 release](https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.5)
explicitly backports the flat-selector CPU exhaustion fix from
[7.1.6](https://github.com/postcss/postcss-selector-parser/releases/tag/7.1.6)
for consumers including Tailwind 3. No Tailwind major migration or forced parser
major override is part of this change.

## Audit result and remaining advisory metadata

`npm audit --package-lock-only --json` reports **7 affected package entries:
5 high and 2 moderate**, and exits with status 1. The original report contained
20 entries: 16 high and 4 moderate. Counts include dependent packages, rather
than representing seven independent vulnerabilities.

All remaining entries derive from these two advisories:

| Advisory                                                                                            | Current audit result                                                                    | Primary-source evidence                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces`                  | Five high entries through `braces`, `micromatch`, `fast-glob`, `chokidar`, and Tailwind | GitHub withdrew the advisory on 2026-10-23 because it was not practically exploitable. The npm audit response still includes it. `braces` stays at 3.0.3.       |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), `postcss-selector-parser` | Two moderate entries for parser 6.1.5 and `postcss-nested`                              | The advisory's `<7.1.6` range does not yet distinguish the upstream 6.1.5 security backport. Both locked major-6 copies use 6.1.5; the major-7 copy uses 7.1.6. |

No audit suppression, severity threshold, `npm audit fix --force`, local package
fork, or replacement of an upstream package was used. Re-run the audit when its
database changes; the current nonzero result must remain visible to reviewers.

The parser advisory describes exposure when a consumer synchronously parses
untrusted selectors. It explicitly distinguishes ordinary builds of trusted
source files. This app's package graph uses the parser through Tailwind,
`postcss-nested`, and the Svelte ESLint parser; the source scan found no direct
runtime import of the parser. This is reachability evidence, not proof that every
possible deployment is unaffected.

## Runtime scope and compatibility

The checked lockfile has `sharp` and `undici` under Miniflare, which is pulled in
by Wrangler. Application and reminder Worker sources do not directly import
either package and use the platform `fetch` API for network calls. This supports
classifying these particular dependency paths as local Cloudflare tooling; the
lockfile's production/dev flags alone do not establish what a deployed bundle
contains. A build and deployment smoke check are separate evidence.

Published npm metadata confirms the selected versions and their Node engine
requirements. A lockfile-wide engine check for Node **22.23.4** found no conflicts
for Windows x64 or Linux x64. Vite requires Node 22.12 or newer within the Node 22
line. The platform-specific optional `sharp-win32-ia32` package targets Node 20
and is not selected on either checked x64 platform. Node engine compatibility
does not replace application tests.

Completed checks for this dependency change:

- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` — passed.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund` — passed; lockfile and
  manifest dependencies match.
- Every changed lockfile version was inspected; changes are limited to the
  packages above and their matching platform/test dependencies.
- `npm audit --package-lock-only --json` — completed with the residual result
  documented above, not a passing audit.
- Import and dependency-path checks were read-only. No provider credentials,
  database schema, deployed service, or user data were changed by this review.

Primary references for the other fixes include the
[Vite Windows editor advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm),
[Vitest manual-mock advisory](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
[brace expansion advisory](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[source-map advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), and
[Undici TLS advisory](https://github.com/advisories/GHSA-w293-vg96-wgc3).
