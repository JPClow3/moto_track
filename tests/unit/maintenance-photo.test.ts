import { describe, expect, it } from "vitest";
import {
  MAX_MAINTENANCE_PHOTO_BYTES,
  validateMaintenancePhoto,
} from "../../src/lib/server/domain/maintenance-photos";

describe("maintenance photo validation", () => {
  it("accepts a non-empty image within the upload limit", () => {
    const file = new File(["photo"], "before.jpg", { type: "image/jpeg" });

    expect(validateMaintenancePhoto(file)).toEqual({ ok: true, file });
  });

  it("rejects an empty, non-image, or active-image upload", () => {
    expect(validateMaintenancePhoto(null)).toMatchObject({ ok: false });
    expect(
      validateMaintenancePhoto(
        new File(["not a photo"], "invoice.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateMaintenancePhoto(
        new File(["<svg />"], "logo.svg", { type: "image/svg+xml" }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects an image over the maintenance-photo size limit", () => {
    const file = new File(
      [new Uint8Array(MAX_MAINTENANCE_PHOTO_BYTES + 1)],
      "large.png",
      { type: "image/png" },
    );

    expect(validateMaintenancePhoto(file)).toMatchObject({ ok: false });
  });
});
