import { describe, expect, it } from "vitest";
import { getFeature } from "../../src/lib/server/domain/features";

describe("motorcycle-linked features", () => {
  it("requires the user to select a motorcycle for operational records", () => {
    for (const slug of [
      "maintenance",
      "tires",
      "documents",
      "reminders",
      "expenses",
      "trabalho",
    ]) {
      expect(getFeature(slug).fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "motorcycle_id",
            kind: "select",
            required: true,
          }),
        ]),
      );
    }
  });
});
