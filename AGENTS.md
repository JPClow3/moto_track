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

## Cursor Cloud specific instructions

The startup update script runs `npm install`, so assume `node_modules` is present. Standard commands live in the sections above; notes below are the non-obvious caveats.

- `npm run dev` (Vite, `--host 0.0.0.0`, default port 5173) boots without a real provider environment. Public/marketing pages (`/`, `/precos`, `/blog`, `/roadmap`) render with fallbacks, but auth and data features require Neon (`DATABASE_URL`, `PUBLIC_NEON_AUTH_URL`, `NEON_AUTH_JWKS_URL`). `/healthz` returns 503 without a reachable database.
- `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:unit`, and `npm run build` all pass offline with no `.env`.
- `npm run test:e2e` runs offline public-page coverage after browsers are installed once with `npx playwright install --with-deps`. Authenticated specs require `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, and a real disposable Neon/Auth environment; a skipped authenticated run is not release proof.
- `npm run db:push` applies ordered SQL migrations through `postgres.js`. Database types are hand-maintained in `src/lib/types/database.ts`; the old generator is retired.
- The app is Portuguese (pt-BR) by default and picks locale from `Accept-Language`; Chrome's built-in "translate this page" prompt can flip it to English mid-session during manual testing.
