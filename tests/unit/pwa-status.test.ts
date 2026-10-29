import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/routes/api/pwa/status/+server";
vi.mock("$server/runtime", () => ({
  runtimeEnv: () => ({ PUBLIC_VAPID_KEY: "public-key" }),
}));

describe("network-only PWA account binding", () => {
  it.each([null, { id: "owner", email: "private@example.invalid" }])(
    "returns only the authenticated identifier with cache isolation",
    async (user) => {
      const response = await GET({
        locals: { user },
        platform: undefined,
      } as unknown as Parameters<typeof GET>[0]);
      expect(await response.json()).toEqual({
        authenticated: Boolean(user),
        userId: user?.id ?? null,
        pushPublicKey: "public-key",
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
    },
  );
});
