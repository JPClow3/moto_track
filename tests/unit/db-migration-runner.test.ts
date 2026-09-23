import { describe, expect, it } from "vitest";
import { migrationDatabaseUrl, postgresOptions } from "../../db/apply.mjs";

describe("database migration connection security", () => {
  it("prefers Neon's unpooled URL when both database URLs are configured", () => {
    expect(
      migrationDatabaseUrl({
        DATABASE_URL:
          "postgres://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/moto_track",
        DATABASE_URL_UNPOOLED:
          "postgres://user:secret@ep-example.us-east-2.aws.neon.tech/moto_track",
      }),
    ).toContain("@ep-example.us-east-2.aws.neon.tech/");
  });

  it("falls back to DATABASE_URL for CI and local disposable databases", () => {
    const databaseUrl =
      "postgres://postgres:postgres@127.0.0.1:5432/moto_track";
    expect(migrationDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(
      databaseUrl,
    );
  });

  it("refuses a pooled Neon URL when no direct migration URL is configured", () => {
    expect(() =>
      migrationDatabaseUrl({
        DATABASE_URL:
          "postgres://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/moto_track",
      }),
    ).toThrow("DATABASE_URL_UNPOOLED is required for Neon migrations");
  });

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
