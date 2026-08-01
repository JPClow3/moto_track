import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postgres: vi.fn(),
}));

vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

import { getDb } from "../../src/lib/server/db/client";

describe("database client lifetime", () => {
  beforeEach(() => {
    mocks.postgres.mockReset();
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
});
