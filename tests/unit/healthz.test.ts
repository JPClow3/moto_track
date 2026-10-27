import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/routes/healthz/+server";
import { handle } from "../../src/hooks.server";

describe("/healthz", () => {
  it("reports liveness without a database client", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("does not resolve Neon Auth or open Postgres for a probe that carries a session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await handle({
        event: {
          url: new URL("https://moto-track.net/healthz"),
          request: new Request("https://moto-track.net/healthz"),
          cookies: {
            get: (name: string) =>
              name === "mt_session" ? "session-token" : undefined,
          },
          platform: {
            env: {
              HYPERDRIVE: {
                connectionString: "postgresql://user:pass@127.0.0.1:1/postgres",
              },
              PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth",
            },
          },
          locals: {},
        } as never,
        resolve: async (event) => {
          expect(event.locals.user).toBeNull();
          expect(event.locals.session).toBeNull();
          expect(event.locals.db).toBeUndefined();
          return new Response(null, { status: 204 });
        },
      });

      expect(response.status).toBe(204);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
