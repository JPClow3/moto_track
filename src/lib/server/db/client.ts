import postgres from "postgres";
import { runtimeEnv } from "$server/runtime";

// Hyperdrive pools connections for us on the edge, so a small `max` here is
// intentional, not a bottleneck. `prepare: false` is required for Hyperdrive
// (and any other transaction-pooling proxy) since prepared statements can't
// be pinned to a single backend connection through a pooler.
const POOLED_OPTIONS = {
  prepare: false,
  max: 1,
  // Keep cold-fail fast when the Hyperdrive local placeholder (or a down
  // Postgres) is unreachable — public pages catch query errors and still
  // render, but a long TCP hang would trip Playwright's webServer timeout.
  connect_timeout: 5,
} satisfies postgres.Options<Record<string, never>>;

function resolveConnectionString(platform?: App.Platform): string {
  // Prefer DATABASE_URL whenever it is set. In local/CI, wrangler always
  // exposes a Hyperdrive binding (and requires localConnectionString), which
  // would otherwise shadow a real Neon URL from .env. Production Workers
  // typically only have the Hyperdrive binding, so this still selects it.
  const directUrl = runtimeEnv(platform).DATABASE_URL;
  if (directUrl) {
    return directUrl;
  }

  const hyperdriveUrl = platform?.env?.HYPERDRIVE?.connectionString;
  if (hyperdriveUrl) {
    return hyperdriveUrl;
  }

  throw new Error(
    "No database connection available: neither the HYPERDRIVE binding nor DATABASE_URL is configured.",
  );
}

// Whether to negotiate TLS is a property of the *endpoint*, not of how we got
// the string. Neon requires TLS and its URLs carry `sslmode=require` — this is
// true both for the direct DATABASE_URL and for the connection string Hyperdrive
// hands back during LOCAL emulation (miniflare connects straight to Neon). In
// production the real Hyperdrive proxy terminates TLS itself and its
// connectionString carries no sslmode, so we leave TLS off there. Keying on the
// sslmode param gets all three cases right.
function sslForConnection(connectionString: string): "require" | undefined {
  try {
    const sslmode = new URL(connectionString).searchParams.get("sslmode");
    return sslmode && sslmode !== "disable" ? "require" : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns a request-scoped postgres.js `Sql` instance for the current
 * environment. Cloudflare Workers associates the driver's I/O objects with
 * the request that created them; keeping a `Sql` instance in module scope and
 * reusing it on a later request causes the runtime to reject the cross-request
 * stream access with "Cannot perform I/O on behalf of a different request".
 * Hyperdrive owns the connection pool, so the client itself does not need to
 * be shared here.
 */
export function getDb(platform?: App.Platform): postgres.Sql {
  const connectionString = resolveConnectionString(platform);

  return postgres(connectionString, {
    ...POOLED_OPTIONS,
    ssl: sslForConnection(connectionString),
  });
}
