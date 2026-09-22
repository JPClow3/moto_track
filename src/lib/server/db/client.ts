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
  // Production must use Hyperdrive even if a legacy DATABASE_URL secret is
  // still present. Wrangler exposes the configured localConnectionString as a
  // binding during local emulation; the port-1 sentinel is intentionally
  // unusable, so local/CI falls back to the real DATABASE_URL from .env.
  const hyperdriveUrl = platform?.env?.HYPERDRIVE?.connectionString;
  const directUrl = runtimeEnv(platform).DATABASE_URL;
  if (hyperdriveUrl && !isLocalHyperdriveSentinel(hyperdriveUrl)) {
    return hyperdriveUrl;
  }
  if (directUrl) {
    return directUrl;
  }

  if (hyperdriveUrl) {
    return hyperdriveUrl;
  }

  throw new Error(
    "No database connection available: neither the HYPERDRIVE binding nor DATABASE_URL is configured.",
  );
}

function isLocalHyperdriveSentinel(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      url.port === "1"
    );
  } catch {
    return false;
  }
}

// Whether to negotiate TLS is a property of the endpoint, not of how we got
// the string. Neon requires TLS. Some dashboard-issued URLs omit sslmode, so
// recognise the Neon hostname as well as the explicit query parameter. The
// production Hyperdrive proxy uses a non-Neon hostname and terminates TLS.
function sslForConnection(connectionString: string): "require" | undefined {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    return (sslmode && sslmode !== "disable") ||
      url.hostname.endsWith(".neon.tech")
      ? "require"
      : undefined;
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
