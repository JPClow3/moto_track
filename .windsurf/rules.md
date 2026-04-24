# Frontend Architecture Rules

## Strict Stack (No Exceptions Without Approval)

| Allowed | Forbidden |
|---------|-----------|
| HTMX (AJAX, partial updates) | jQuery (isolate/remove if found) |
| Alpine.js (UI state, x-data, @click) | Vanilla JS in templates for UI state |
| Tailwind CSS (all styling) | Bootstrap, Bulma, inline `<style>` blocks |
| Chart.js (charts only) | React, Vue, Svelte, Angular |
| Lucide (icons) | Inline `onclick=`, `onchange=`, `onload=` |

## Rules

1. **No `onclick=` / `onchange=` / `onload=`** — Use Alpine `@click`, `@change`, `x-init`.
2. **No `<script>` blocks in templates for UI state** — Use Alpine `x-data`.
3. **No inline `<style>` blocks** — Use Tailwind utilities or `static/css/input.css`.
4. **No `style="..."` attributes** — Except dynamic server-rendered numeric values (percentages).
5. **HTMX + Alpine interop** — Call `Alpine.initTree()` on `htmx:afterSwap`.
6. **Vanilla JS only for**: Service Workers, Push API, Web Crypto, HTMX event glue, Chart.js init.

## Exception Tag
If vanilla JS is absolutely required, add `<!-- AI-NOTE: vanilla-js-justified -->` with justification.

## AI Contributor Checklist
- [ ] No new `<script>` blocks in templates
- [ ] No `onclick=` / `onchange=` / `onload=`
- [ ] No `<style>` blocks
- [ ] No Bootstrap/legacy classes
- [ ] Modals/menus use Alpine `x-data` / `x-show`
- [ ] Data fetching uses HTMX `hx-get` / `hx-post`
