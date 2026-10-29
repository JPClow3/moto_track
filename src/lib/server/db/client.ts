import postgres from "postgres";
import { dev } from "$app/environment";
import { runtimeEnv } from "$server/runtime";

// Hyperdrive pools connections for us on the edge, so a small `max` here is
// intentional, not a bottleneck. Keep the driver scoped to this request;
// Hyperdrive owns the underlying origin connection pool.
const POOLED_OPTIONS = {
  max: 1,
  // Keep cold-fail fast when the Hyperdrive local placeholder (or a down
  // Postgres) is unreachable — public pages catch query errors and still
  // render, but a long TCP hang would trip Playwright's webServer timeout.
  connect_timeout: 5,
} satisfies postgres.Options<Record<string, never>>;

function resolveConnection(platform?: App.Platform) {
  // Production must use Hyperdrive even if a legacy DATABASE_URL secret is
  // still present. Wrangler exposes the configured localConnectionString as a
  // binding during local emulation; the port-1 sentinel is intentionally
  // unusable, so local/CI falls back to the real DATABASE_URL from .env.
  const hyperdriveUrl = platform?.env?.HYPERDRIVE?.connectionString;
  const directUrl = runtimeEnv(platform).DATABASE_URL;
  if (hyperdriveUrl && !isLocalHyperdriveSentinel(hyperdriveUrl)) {
    return { connectionString: hyperdriveUrl, hyperdrive: true };
  }
  if (directUrl) {
    return { connectionString: directUrl, hyperdrive: false };
  }

  if (hyperdriveUrl) {
    return { connectionString: hyperdriveUrl, hyperdrive: false };
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
  const { connectionString, hyperdrive } = resolveConnection(platform);

  return postgres(connectionString, {
    ...POOLED_OPTIONS,
    // Hyperdrive supports prepared statements. Disabling them adds parameter
    // discovery messages that its transaction pool cannot reliably handle.
    prepare: hyperdrive,
    // Vite's Node process has no Workers request cleanup. A request-scoped
    // direct client must release its idle socket instead of accumulating one
    // connection for every page or API request. Active queries are unaffected.
    idle_timeout: hyperdrive && !dev ? undefined : 5,
    ssl: sslForConnection(connectionString),
  });
}
