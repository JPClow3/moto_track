import { describe, expect, it } from "vitest";
import {
  decryptPushField,
  encryptPushField,
  isAllowedPushEndpoint,
} from "../../src/lib/server/domain/push-crypto";

describe("push subscription crypto", () => {
  it("round-trips endpoint material with the Conta encryption scheme", async () => {
    const secret = "test-push-encryption-secret";
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    const sealed = await encryptPushField(endpoint, secret);
    expect(sealed).toContain(".");
    expect(await decryptPushField(sealed, secret)).toBe(endpoint);
  });

  it("allows known push providers and rejects SSRF targets", () => {
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/token"),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/x",
      ),
    ).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/push")).toBe(false);
  });
});
