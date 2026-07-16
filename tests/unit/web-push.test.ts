import { afterEach, describe, expect, it, vi } from "vitest";
import { base64Url, sendWebPush } from "../../workers/reminders/web-push";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Web Push delivery", () => {
  it("encrypts a payload and signs a VAPID request", async () => {
    const vapid = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const client = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const privateKey = await crypto.subtle.exportKey("jwk", vapid.privateKey);
    const publicKey = base64Url(
      new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey)),
    );
    const clientPublic = base64Url(
      new Uint8Array(await crypto.subtle.exportKey("raw", client.publicKey)),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    globalThis.fetch = fetchMock;

    await sendWebPush(
      {
        endpoint: "https://push.example.test/send",
        p256dh: clientPublic,
        auth: base64Url(crypto.getRandomValues(new Uint8Array(16))),
      },
      { title: "Moto Track", body: "Teste", url: "/reminders" },
      {
        publicKey,
        privateKey: JSON.stringify(privateKey),
        subject: "mailto:ops@example.test",
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toContain("vapid t=");
    expect(options.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(options.body.byteLength).toBeGreaterThan(86);
  });
});
