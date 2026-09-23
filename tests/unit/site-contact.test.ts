import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import {
  DEFAULT_SITE_CONTACT,
  getSiteContact,
} from "../../src/lib/server/domain/site-contact";

describe("site contact for legal pages", () => {
  it("publishes the staff-configured support email as the privacy channel", async () => {
    const db = vi.fn(() =>
      Promise.resolve([
        { company_name: "Moto Track Ltda", support_email: "ajuda@example.com" },
      ]),
    );

    await expect(getSiteContact(db as unknown as Sql)).resolves.toEqual({
      companyName: "Moto Track Ltda",
      supportEmail: "ajuda@example.com",
    });
  });

  it("falls back to the schema defaults for blank settings", async () => {
    const db = vi.fn(() =>
      Promise.resolve([{ company_name: " ", support_email: null }]),
    );

    await expect(getSiteContact(db as unknown as Sql)).resolves.toEqual(
      DEFAULT_SITE_CONTACT,
    );
  });

  it("still renders a contact when the database is unreachable", async () => {
    const db = vi.fn(() => Promise.reject(new Error("offline")));

    await expect(getSiteContact(db as unknown as Sql)).resolves.toEqual(
      DEFAULT_SITE_CONTACT,
    );
  });
});
