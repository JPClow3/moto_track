# ADR 0001: Server-rendered Django + HTMX + Alpine + Tailwind, no SPA

- **Status**: Accepted
- **Date**: 2026-05-17 (retroactive seed — captures pre-existing decision)
- **Deciders**: Project lead

## Context

Moto Track is a single-developer side project that needs to deliver a feature-rich
dashboard (charts, lists, modals, PWA install) on mobile and desktop, with a
small infrastructure footprint and the ability to add features without a
multi-day frontend tooling tax. The competing options were:

1. **SPA (React/Vue/Svelte) + DRF API** — modern interactivity but doubles the
   build pipeline (Node + Python), requires API contract maintenance, slower
   first paint, and is heavier on a free-tier host.
2. **Server-rendered Django + HTMX + Alpine + Tailwind** — Django templates do
   the rendering; HTMX swaps partials; Alpine handles client-side state
   (modals, menus); Tailwind provides utility classes.
3. **HTMX + custom CSS** — minimal, but loses the design-system productivity of
   Tailwind and the small Alpine sprinkles for state.

## Decision

Option (2) — server-rendered with HTMX + Alpine + Tailwind. Cotton components
for reusable template fragments. Crispy-tailwind for forms.

## Consequences

**Positive**

- One process serves HTML; no API/SPA boundary to keep in sync.
- HTMX `hx-get`/`hx-post` covers ~95% of "make this dynamic" needs.
- Tailwind generated CSS is small once tree-shaken; ships ~30 KB gzipped.
- Excellent SEO and accessibility-by-default because pages are real HTML.
- Easy to test (Django test client renders HTML; pytest covers it natively).

**Negative**

- Rich interactions (complex drag-drop, real-time collaboration) are harder
  than in an SPA; if we ever need them we'll pay a refactor cost.
- HTMX swap behaviour requires discipline (focus management, Alpine reinit,
  Lucide icon re-rendering — see `templates/base.html` `htmx:afterSwap` hook).
- Alpine `x-cloak` is mandatory or we get FOUC; CSS rule already in place.

## Compliance

- New views should return server-rendered HTML, with HTMX for partial swaps,
  unless there is a written exception.
- New JS that exceeds ~50 lines belongs in `static/js/` as a module, not inline.
- See `CONTRIBUTING.md` and `.windsurf/rules.md` for the day-to-day rules.
