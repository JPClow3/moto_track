import { describe, expect, it } from "vitest";
import { postgresOptions } from "../../db/apply.mjs";

describe("database migration connection security", () => {
  it("disables TLS for loopback PostgreSQL used by the integration gate", () => {
    expect(
      postgresOptions("postgres://postgres:postgres@127.0.0.1:5432/moto_track"),
    ).toMatchObject({ ssl: false });
    expect(
      postgresOptions("postgres://postgres:postgres@localhost:5432/moto_track"),
    ).toMatchObject({ ssl: false });
    expect(
      postgresOptions("postgres://postgres:postgres@[::1]:5432/moto_track"),
    ).toMatchObject({ ssl: false });
  });

  it("requires TLS for Neon even if a URL attempts to disable it", () => {
    expect(
      postgresOptions(
        "postgres://user:secret@ep-example.us-east-2.aws.neon.tech/moto_track?sslmode=disable",
      ),
    ).toMatchObject({ ssl: "require" });
  });

  it("requires TLS by default for non-local PostgreSQL hosts", () => {
    expect(
      postgresOptions("postgres://user:secret@database.example.com/moto_track"),
    ).toMatchObject({ ssl: "require" });
  });
});
