# Contributing to Moto Track

## Frontend Architecture Rules (Strict)

This project's frontend stack is **locked to three technologies**. Any deviation must be explicitly justified and tagged.

### Allowed Technologies

| Technology | Purpose | CDN / Import |
| ---------- | ------- | ------------- |
| **HTMX** | Server-rendered interactivity, AJAX, partial page updates | `https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js` |
| **Alpine.js** | Reactive UI state: `x-data`, `x-show`, `x-init`, `@click` | `https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js` |
| **Tailwind CSS** | All styling via utility classes | `static/css/tailwind.generated.css` |

### Restricted (Allowed with Conditions)

| Technology | Condition |
| ---------- | ----------- |
| **Chart.js** | Dashboard charts only; init via Alpine `x-init` |
| **Lucide** | Icons only |
| **Vanilla JS** | Only for: Service Workers, Push API, Web Crypto, HTMX event glue, Chart.js init |

### Forbidden Technologies

| Technology | Why Forbidden |
| ---------- | -------------- |
| **jQuery** | Replaced by HTMX + Alpine.js. Only tolerated for django-autocomplete-light third-party dependency. |
| **Bootstrap / Bulma / Foundation** | Conflicts with Tailwind CSS; single source of truth required. |
| **React / Vue / Svelte / Angular** | Overkill for server-rendered Django application. |
| **Inline `onclick=` / `onchange=` / `onload=`** | Must use Alpine.js directives (`@click`, `@change`, `x-init`). |
| **Inline `<style>` blocks in templates** | Must use Tailwind utilities or `static/css/input.css`. |
| **`<script>` blocks in templates for UI state** | Must use Alpine.js `x-data` for reactive state. |

## Template Rules

### 1. No Inline Event Handlers

**Forbidden:**

```html
<button onclick="openModal()">Open</button>
<button onchange="updateValue()">Change</button>
```

**Required:**

```html
<button @click="open = true">Open</button>
<select @change="updateValue">...</select>
```

### 2. No Scripts for UI State

**Forbidden:**

```html
<script>
  document.querySelector('.menu').classList.toggle('hidden');
</script>
```

**Required:**

```html
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <div x-show="open" x-cloak>...</div>
</div>
```

### 3. HTMX + Alpine Interoperability

When HTMX swaps content containing Alpine directives, re-initialize Alpine:

```javascript
document.body.addEventListener("htmx:afterSwap", (event) => {
  if (window.Alpine && event.detail?.target) {
    window.Alpine.initTree(event.detail.target);
  }
});
```

### 4. All CSS via Tailwind

- Use `static/css/input.css` for custom properties and reusable component patterns (`@layer base`, `@layer components`).
- Use `static/css/app.css` only for HTMX indicator states and skeleton shimmer effects.
- Never add custom CSS classes in templates that duplicate Tailwind utilities.
- Never use Bootstrap-style classes: `form-control`, `btn`, `container`, `row`, `col-*`.

## File Organization

```text
templates/
  base.html              # Alpine.js + HTMX + x-cloak loaded here
  allauth/layouts/
    base.html            # Same stack for auth pages
  core/
    dashboard.html       # Chart.js init via Alpine x-init
    onboarding.html      # Wizard via Alpine x-data
  fuel/partials/
    quick_form.html      # HTMX-loaded form
  maintenance/partials/
    quick_form.html      # HTMX-loaded form

static/
  css/
    input.css            # Tailwind entry point
    app.css              # Minimal HTMX/loading states only
    tailwind.generated.css # Build output (do not edit)
  vendor/                # Generated from npm packages and committed for Compose dev
  js/
    theme.js             # Theme toggle (cross-cutting, localStorage)
public/
  sw.js                  # Root-served service worker
```

## Exception Process

If a feature genuinely requires a forbidden technology:

1. Document the justification in the PR description.
2. Tag the code with an explicit annotation:

   ```html
   <!-- AI-NOTE: justified-exception — ServiceWorker registration requires imperative JS -->
   ```

   or

   ```javascript
   /* AI-NOTE: justified-exception — JSON endpoint fetch requires imperative parsing */
   ```
3. Must be approved by maintainer.

## AI Contributor Checklist

Before submitting any frontend change, verify:

- [ ] No new `<script>` blocks in templates (unless for Chart.js/service workers)
- [ ] No `onclick=`, `onchange=`, `onload=` attributes anywhere
- [ ] No `<style>` blocks in templates
- [ ] No `style="..."` attributes except dynamic template values (percentages, etc.)
- [ ] No Bootstrap or legacy CSS framework classes
- [ ] All modals, menus, toggles use Alpine.js `x-data` / `x-show`
- [ ] All data fetching uses HTMX `hx-get` / `hx-post`
- [ ] `[x-cloak] { display: none !important; }` is present in `<head>` for any new base template
