import { describe, expect, it } from "vitest";
import {
  decryptPushField,
  encryptPushField,
} from "../../workers/reminders/push-crypto";

describe("push subscription crypto", () => {
  it("round-trips endpoint material with the Conta encryption scheme", async () => {
    const secret = "test-push-encryption-secret";
    const endpoint = "https://push.example.test/abc";
    const sealed = await encryptPushField(endpoint, secret);
    expect(sealed).toContain(".");
    expect(await decryptPushField(sealed, secret)).toBe(endpoint);
  });
});
