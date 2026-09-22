---
name: moto-track-dev
description: >-
  Development runbook, architecture patterns, and verification commands for Moto Track
  SvelteKit, TailwindCSS, and Cloudflare Workers application.
---

# Moto Track Development Skill

This skill provides procedures and guidelines for developing and verifying the Moto Track telemetry and maintenance application.

## 1. Project Architecture & Stack

- **Framework**: SvelteKit 2.x / Svelte 5 / TypeScript
- **Styling**: TailwindCSS / PostCSS
- **Edge Deployment**: Cloudflare Workers / Pages (`@sveltejs/adapter-cloudflare`)
- **Database / Storage**: Neon Postgres through Cloudflare Hyperdrive / R2
- **Authentication**: Neon Auth (managed Better Auth)
- **Testing**: Vitest (unit/component) + Playwright (e2e)
- **Code Quality**: ESLint + Prettier + TypeScript compiler

## 2. Key Commands

### Environment Setup

```powershell
npm ci
```

### Development & Build

```powershell
# Run local dev server
npm run dev

# Run type check
npm run check

# Run linter
npm run lint

# Run unit tests
npm run test:unit

# Run e2e tests
npm run test:e2e

# Production build for Cloudflare Workers
npm run build

# Preview edge worker locally
npm run preview
```

### Neon Postgres Migrations

```powershell
# Apply every pending db/migrations/*.sql file to DATABASE_URL
npm run db:push
```

## 3. Development Guidelines

1. **Edge Compatibility**: Keep dependencies compatible with Cloudflare Workers runtime (V8 isolates; no native Node C++ extensions).
2. **Reactivity**: Follow modern Svelte runes / reactivity paradigms.
3. **Data Integrity**: Validate all incoming telemetry data shapes before database insertion and keep `src/lib/types/database.ts` aligned with migrations.

## 4. Git Tagging & Release Workflow

- **Release Tag Standard**: `vMAJOR.MINOR.PATCH` (e.g. `v1.2.0`)
- **Commands**:
  ```powershell
  git tag -a v1.2.0 -m "Release v1.2.0: Telemetry sync and fuel tracking"
  git push origin v1.2.0
  ```
