# AGENTS.md

Use this file for agent-specific repo workflows. Keep broader product and frontend conventions in [`README.md`](README.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

## Validation Commands

- **Type Checking**:
  - `npm run check` (runs svelte-check)
- **Formatting and Linting**:
  - `npm run format:check`
  - `npm run lint`
- **Testing**:
  - Unit Tests (Vitest): `npm run test:unit`
  - End-to-End Tests (Playwright): `npm run test:e2e`
- **Build**:
  - `npm run build`

## Repo Workflows

- **Local Development Server**:
  - `npm run dev`
- **Cloudflare Worker Development**:
  - `npm run worker:dev`
- **Database / Supabase**:
  - Push schema changes: `npm run db:migrate`
  - Regenerate TypeScript types from database: `npm run supabase:types`
- **CI Pipeline**:
  - GitHub Actions runs check, lint, format:check, unit tests, and e2e tests on push to `main` and all Pull Requests.
