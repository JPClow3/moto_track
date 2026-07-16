import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXPORT_TABLES,
  isDeletionConfirmation,
} from "../../src/lib/server/domain/account-data";

describe("account-data fulfillment", () => {
  it("exports the user's core product records without credential hashes", () => {
    expect(ACCOUNT_EXPORT_TABLES).toContain("motorcycles");
    expect(ACCOUNT_EXPORT_TABLES).toContain("maintenance_records");
    expect(ACCOUNT_EXPORT_TABLES).toContain("motorcycle_documents");
    expect(ACCOUNT_EXPORT_TABLES).not.toContain("api_tokens");
    expect(ACCOUNT_EXPORT_TABLES).not.toContain("push_subscriptions");
  });

  it("requires the explicit Portuguese deletion confirmation", () => {
    expect(isDeletionConfirmation("EXCLUIR")).toBe(true);
    expect(isDeletionConfirmation("excluir")).toBe(false);
    expect(isDeletionConfirmation("DELETE")).toBe(false);
  });
});
