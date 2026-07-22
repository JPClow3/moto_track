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
- **Database / Supabase**:
  - Push schema changes: `npm run db:migrate`
  - Regenerate TypeScript types from database: `npm run supabase:types`
- **CI Pipeline**:
  - GitHub Actions runs check, lint, format:check, unit tests, and e2e tests on push to `main` and all Pull Requests.

## Cursor Cloud specific instructions

Dependencies are installed by the startup update script (`npm install`). Assume `node_modules` is present.

- `npm run dev` (Vite, `--host 0.0.0.0`, default port 5173) boots **without any `.env`**: `src/lib/server/env.ts` falls back to `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` / `PUBLIC_SUPABASE_ANON_KEY=local-anon-key` and `PUBLIC_SITE_URL=http://localhost:5173`. Public/marketing pages (`/`, `/precos`, `/blog`, `/roadmap`) render, but auth, dashboard, and data features need a real Supabase project (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); `/healthz` returns 503 without the service-role key.
- First `npm run dev` may warn that `./.svelte-kit/tsconfig.json` is missing until `svelte-kit sync` runs (it runs as part of `npm run check`).
- Standard commands (see the Validation Commands section above): `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run build` all pass offline. `npm run db:migrate` (`supabase db push`) and `npm run test:e2e` need the Supabase CLI / `npx playwright install --with-deps` respectively, which are not part of the base env.
