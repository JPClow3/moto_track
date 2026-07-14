# Moto Track

Moto Track is now a SvelteKit + Supabase + Cloudflare application.

## Stack

- SvelteKit, TypeScript, Tailwind, lucide-svelte, Chart.js
- Supabase Auth and Postgres with SQL migrations and RLS
- Cloudflare Pages and R2 for deployment and object storage
- Stripe billing
- Supabase Edge Functions + Resend for transactional app email

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

Apply Supabase migrations:

```bash
npm run db:migrate
```

Generate database types:

```bash
npm run supabase:types
```

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for Pages bindings, server-only secrets, and the required preview acceptance test.

## Legacy Reference

The previous Django implementation is temporarily preserved under `_legacy/django`
for feature parity and data import work.
