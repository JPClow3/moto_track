import { describe, expect, it } from "vitest";
import {
  nativePlatform,
  nativePurchasesRestricted,
  nativeRestrictedPath,
} from "$lib/domain/distribution";

describe("native distribution boundaries", () => {
  it.each(["iOS", "Android"])(
    "disables hosted upgrades for %s without granting entitlements",
    (platform) => {
      const ua = "Mozilla/5.0 MotoTrackNative/" + platform;
      expect(nativePurchasesRestricted(ua)).toBe(true);
      expect(nativePlatform(ua)).toBe(platform.toLowerCase());
    },
  );
  it("keeps browser and Windows billing behavior", () => {
    for (const ua of [
      null,
      "Mozilla/5.0",
      "Mozilla/5.0 MotoTrackNative/Windows",
    ])
      expect(nativePurchasesRestricted(ua)).toBe(false);
    expect(nativePlatform("OtherMotoTrackNative/iOS")).toBeNull();
  });
  it("normalizes billing trailing slashes and leaves account deletion and webhooks reachable", () => {
    for (const path of [
      "/precos",
      "/billing/checkout/",
      "/billing/portal",
      "/billing",
    ])
      expect(nativeRestrictedPath(path)).toBe(true);
    for (const path of [
      "/billing/conta",
      "/billing/conta/export",
      "/billing/webhook/dodo",
      "/privacidade",
    ])
      expect(nativeRestrictedPath(path)).toBe(false);
  });
});
