import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "../../src/lib/utils/push";

describe("push subscription key", () => {
  it("converts an URL-safe VAPID public key to bytes", () => {
    expect([...urlBase64ToUint8Array("AQID-_8")]).toEqual([1, 2, 3, 251, 255]);
  });
});
