# Moto Track

Moto Track is now a SvelteKit + Neon + Cloudflare application.

## Stack

- SvelteKit, TypeScript, Tailwind, lucide-svelte
- Custom SVG charts (no Chart.js)
- Neon Postgres accessed via postgres.js, through Cloudflare Hyperdrive at the edge
- Neon Auth (managed Better Auth) for authentication; authorization is app-layer
  only (every query filters by `owner_id` — there is no RLS on Neon)
- Cloudflare Pages and R2 for deployment and object storage
- Stripe billing
- Resend for transactional app email (sent in-process, no Edge Function hop)

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Validation

```bash
npm run check
npm run format:check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

## Database

Apply `db/migrations/*.sql` to the live Neon database:

```bash
npm run db:push
```

`src/lib/types/database.ts` is hand-maintained — update it by hand alongside
new migrations (see the note at the top of `scripts/generate-db-types.mjs`
for why there's no auto-generation step).

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for Pages bindings, server-only secrets, and the required preview acceptance test.

## Legacy Reference

The previous Django implementation has been fully replaced. See [`docs/parity-checklist.md`](docs/parity-checklist.md)
for the feature-parity record and [`docs/api-migration.md`](docs/api-migration.md) for API field/endpoint changes.
Legacy data import is available via `npm run import:legacy` (see [`scripts/import-legacy-data.ts`](scripts/import-legacy-data.ts)).
