import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postgres: vi.fn(),
  dev: false,
}));

vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
vi.mock("$app/environment", () => ({
  get dev() {
    return mocks.dev;
  },
}));

import { getDb } from "../../src/lib/server/db/client";

describe("database client lifetime", () => {
  beforeEach(() => {
    mocks.postgres.mockReset();
    mocks.dev = false;
    mocks.postgres.mockImplementation(() => ({}));
  });

  it("creates a new client for each Cloudflare request", () => {
    const platform = {
      env: {
        HYPERDRIVE: {
          connectionString: "postgres://hyperdrive.example/neondb",
        },
      },
    };

    const first = getDb(platform as never);
    const second = getDb(platform as never);

    expect(first).not.toBe(second);
    expect(mocks.postgres).toHaveBeenCalledTimes(2);
  });

  it("requires TLS for direct Neon URLs even when sslmode is omitted", () => {
    getDb({
      env: { DATABASE_URL: "postgres://user:pass@ep-example.neon.tech/neondb" },
    } as never);

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://user:pass@ep-example.neon.tech/neondb",
      expect.objectContaining({
        ssl: "require",
        prepare: false,
        idle_timeout: 5,
      }),
    );
  });

  it("leaves TLS termination to Hyperdrive", () => {
    getDb({
      env: {
        HYPERDRIVE: {
          connectionString: "postgres://hyperdrive.internal/neondb",
        },
      },
    } as never);

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://hyperdrive.internal/neondb",
      expect.objectContaining({
        ssl: undefined,
        prepare: true,
        idle_timeout: undefined,
      }),
    );
  });

  it("prefers production Hyperdrive over a legacy direct secret", () => {
    getDb({
      env: {
        DATABASE_URL: "postgres://user:pass@ep-example.neon.tech/neondb",
        HYPERDRIVE: {
          connectionString: "postgres://hyperdrive.internal/neondb",
        },
      },
    } as never);

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://hyperdrive.internal/neondb",
      expect.objectContaining({ prepare: true }),
    );
  });

  it("uses DATABASE_URL instead of Wrangler's local port-1 sentinel", () => {
    getDb({
      env: {
        DATABASE_URL: "postgres://user:pass@ep-example.neon.tech/neondb",
        HYPERDRIVE: {
          connectionString: "postgres://user:pass@127.0.0.1:1/neondb",
        },
      },
    } as never);

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://user:pass@ep-example.neon.tech/neondb",
      expect.objectContaining({ prepare: false, idle_timeout: 5 }),
    );
  });

  it("releases idle clients during Vite emulation even with a local Hyperdrive binding", () => {
    mocks.dev = true;
    getDb({
      env: {
        HYPERDRIVE: { connectionString: "postgres://hyperdrive.local/neondb" },
      },
    } as never);
    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://hyperdrive.local/neondb",
      expect.objectContaining({ prepare: true, idle_timeout: 5 }),
    );
  });
});
