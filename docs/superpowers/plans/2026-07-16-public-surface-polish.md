# Public Surface Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a coherent polished public Moto Track experience and substantive generic Terms and Privacy pages.

**Architecture:** Keep public-page styling colocated in the existing Svelte routes, reuse global tokens and public shell components, and avoid changes to billing, data loading, or authentication actions. Legal content is static route content; the previous privacy route forwards to the canonical path.

**Tech Stack:** Svelte 5, SvelteKit 2, Tailwind CSS, lucide-svelte, Vitest, Playwright.

## Global Constraints

- Preserve the zinc/red service-manual visual system in `src/app.css`.
- Keep existing auth action names (`signIn`, `signUp`, `google`, `resetPassword`) and redirect behavior.
- Use Portuguese (Brazil) public copy and generic contact `privacidade@moto-track.app`.
- Legal copy is an operational generic draft, not legal advice.

---

### Task 1: Establish public-surface contracts

**Files:**

- Create: `tests/unit/public-surface.test.ts`
- Modify: `src/lib/components/PublicFooter.svelte`
- Create: `src/routes/(public)/privacidade/+page.svelte`

- [ ] Write a failing source-contract test for the canonical privacy route, dated legal sections, privacy footer link, and auth mode switch.
- [ ] Run `npm run test:unit -- public-surface.test.ts` and confirm the expected missing-route/contract failure.
- [ ] Add the canonical route and shared footer link, then rerun the focused test.

### Task 2: Refine the landing, blog, and roadmap

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/(public)/blog/+page.svelte`
- Modify: `src/routes/(public)/roadmap/+page.svelte`

- [ ] Keep server data contracts intact while adding navigation and visual hierarchy improvements.
- [ ] Use responsive, reduced-motion-safe CSS only; do not add runtime dependencies.
- [ ] Run `npm run check` after the public route changes.

### Task 3: Rebuild the auth surface around clear modes

**Files:**

- Modify: `src/routes/auth/+page.svelte`

- [ ] Replace the collapsed registration flow with accessible sign-in/create-account mode controls.
- [ ] Retain all four existing POST action endpoints and field names.
- [ ] Rerun the focused source-contract test and check after implementation.

### Task 4: Publish complete legal routes and compatibility redirect

**Files:**

- Modify: `src/routes/(public)/termos/+page.svelte`
- Create: `src/routes/(public)/privacidade/+page.svelte`
- Modify: `src/routes/(public)/politica/+page.svelte`

- [ ] Add readable sectioned legal content, a mobile-safe table of contents, and visible generic contact details.
- [ ] Make `/politica` redirect to `/privacidade` without duplicating content.
- [ ] Verify direct route responses with Playwright.

### Task 5: Full verification

**Files:**

- Test: `tests/unit/public-surface.test.ts`
- Test: `tests/e2e/smoke.spec.ts`

- [ ] Run `npm run format:check`, `npm run lint`, `npm run check`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`.
- [ ] Review browser screenshots for `/`, `/blog`, `/roadmap`, `/auth`, `/termos`, and `/privacidade` at desktop and mobile widths.
