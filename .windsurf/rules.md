# Frontend Architecture Rules

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the complete frontend stack rules, forbidden technologies, and exception process.

## Quick Reference

| Allowed | Forbidden |
| --- | --- |
| HTMX | jQuery, inline `onclick=`/`onchange=` |
| Alpine.js | Vanilla JS in templates for UI state |
| Tailwind CSS | Bootstrap, Bulma, inline `<style>` blocks |
| Chart.js (dashboard only) | React, Vue, Svelte, Angular |
| Lucide | — |

## Exception Tag

If vanilla JS is absolutely required, add `<!-- AI-NOTE: justified-exception -->` with justification.

## AI Contributor Checklist

- [ ] No new `<script>` blocks in templates (except Service Workers / Chart.js init)
- [ ] No `onclick=` / `onchange=` / `onload=`
- [ ] No `<style>` blocks
- [ ] No Bootstrap/legacy classes
- [ ] Modals/menus use Alpine `x-data` / `x-show`
- [ ] Data fetching uses HTMX `hx-get` / `hx-post`
