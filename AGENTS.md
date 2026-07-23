# AGENTS.md

Use this file for agent-specific repo workflows. Keep broader product and frontend conventions in [`README.md`](README.md).

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
- **Database (Neon Postgres)**:
  - Apply `db/migrations/*.sql` to the live Neon database: `npm run db:push`
  - `src/lib/types/database.ts` is hand-maintained — update it alongside new migrations
  - Auth is Neon Auth (managed Better Auth); `DATABASE_URL`/`PUBLIC_NEON_AUTH_URL`/`NEON_AUTH_JWKS_URL` are required at runtime
- **CI Pipeline**:
  - GitHub Actions runs check, lint, format:check, unit tests, and e2e tests on push to `main` and all Pull Requests.
