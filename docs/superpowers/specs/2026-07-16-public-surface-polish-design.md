# Moto Track public-surface polish

## Intent

Refine the public experience without changing the established product identity: an engineered, service-manual interface built from zinc surfaces, Barlow typography, technical labels, blueprint grid, and red speed-mark accents. The work covers the home page, blog index, roadmap, authentication surface, and legal pages.

## Visual direction

Use clearer editorial pacing rather than extra decoration. Public-page headers keep a compact technical label, large condensed headline, one explanatory paragraph, and a useful action. Content lists use rails and open bands rather than nested cards. Interaction remains restrained: hover state, visible focus treatment, and reduced-motion-safe transitions.

## Page behavior

- Landing: strengthen the first-view product proof and feature-to-action transitions while retaining live pricing and article data.
- Blog: make the lead story feel editorial, add an explicit browse action, and make empty state/action treatment intentional.
- Roadmap: improve status legibility, navigation between roadmap groups, and mobile scanning without making delivery promises.
- Auth: use a clear sign-in/create-account mode switch; keep existing form actions, Google flow, password recovery, redirect safety, and server contract unchanged.
- Terms and Privacy: add substantive generic Brazilian service and privacy documents, dated 16 July 2026. They must describe LGPD requests, data categories, account deletion/export flow, and a non-legal-advice review notice. The generic contact is `privacidade@moto-track.app`.

## Shared-system changes

The public footer links to `/termos`, `/privacidade`, and `/lgpd`. `/politica` remains a compatibility route that forwards visitors to `/privacidade`.

## Validation

Add a source-contract test for legal route presence/content, the privacy footer link, and the accessible auth mode switch. Run unit tests, formatting, lint, Svelte check, production build, and focused Playwright smoke coverage.
