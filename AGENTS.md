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

- `npm run dev` (Vite, `--host 0.0.0.0`, default port 5173) boots **without any `.env`**: `src/lib/server/env.ts` falls back to `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `PUBLIC_SUPABASE_ANON_KEY=local-anon-key`, and `PUBLIC_SITE_URL=http://localhost:5173`. Public/marketing pages (`/`, `/precos`, `/blog`, `/roadmap`) render fully, but auth, dashboard, and other data features need a real Supabase project (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). `/healthz` returns 503 without a working service-role key.
- `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:unit`, and `npm run build` all pass offline with no `.env`.
- `npm run test:e2e` passes offline, but only after browsers are installed once with `npx playwright install --with-deps` (not part of the base env). Its Playwright config starts its own dev server on port 5187, so it does not need a manually started `npm run dev`. The e2e suite only exercises public pages (landing, pricing, i18n, PWA), so no Supabase is required.
- `npm run db:migrate` (`supabase db push`) and `npm run supabase:types` require the Supabase CLI, and full auth/dashboard testing requires a local Supabase stack (Docker) — none of these are installed in the base env.
- The app is Portuguese (pt-BR) by default and picks locale from `Accept-Language`; Chrome's built-in "translate this page" prompt can flip it to English mid-session during manual testing.
