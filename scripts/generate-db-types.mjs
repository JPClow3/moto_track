// The Supabase-CLI-based generator this script used to run (`supabase gen
// types` against `supabase/migrations/*.sql`) no longer applies: schema
// migrations now live in `db/migrations/` (applied via `npm run db:push`)
// and `src/lib/types/database.ts` is a hand-maintained TypeScript file, not
// a generated artifact.
//
// There is intentionally no `supabase:types`/`db:types` npm script pointing
// here anymore. If you need this automated again, the lower-risk path is a
// postgres.js introspection query against `information_schema.columns` for
// the live Neon database (DATABASE_URL), not a Supabase regeneration.
console.error(
  "generate-db-types.mjs is retired: edit src/lib/types/database.ts by hand " +
    "to match db/migrations/*.sql. See the comment at the top of this file " +
    "if you want to rebuild an introspection-based generator against Neon.",
);
process.exit(1);
