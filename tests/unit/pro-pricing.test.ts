import { beforeEach, describe, expect, it, vi } from "vitest";
const retrieve = vi.hoisted(() => vi.fn());
vi.mock("dodopayments", () => ({
  default: class {
    products = { retrieve };
  },
}));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
const platform = {
  env: {
    DODO_PAYMENTS_API_KEY: "test_key",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
    DODO_PRO_YEARLY_PRODUCT_ID: "pdt_yearly",
  },
} as unknown as App.Platform;
const monthly = {
  is_recurring: true,
  price: {
    type: "recurring_price",
    price: 1990,
    currency: "BRL",
    payment_frequency_count: 1,
    payment_frequency_interval: "Month",
  },
};
const yearly = {
  is_recurring: true,
  price: { ...monthly.price, price: 19900, payment_frequency_interval: "Year" },
};
async function loadBilling() {
  vi.resetModules();
  return import("$server/domain/billing");
}
beforeEach(() => {
  retrieve
    .mockReset()
    .mockImplementation(async (id) =>
      id === "pdt_monthly" ? monthly : yearly,
    );
});
describe("Dodo Pro pricing", () => {
  it("returns locale-neutral live product amounts", async () => {
    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing(platform)).toEqual({
      monthly: { amountCents: 1990, currency: "brl", interval: "month" },
      yearly: { amountCents: 19900, currency: "brl", interval: "year" },
    });
  });
  it("preserves a healthy interval when the other lookup fails", async () => {
    retrieve.mockImplementation(async (id) => {
      if (id === "pdt_monthly") return monthly;
      throw new Error("provider unavailable");
    });
    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing(platform)).toMatchObject({
      monthly: { amountCents: 1990 },
      yearly: null,
    });
  });
  it.each([
    {},
    {
      DODO_PAYMENTS_API_KEY: "replace_me",
      DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    },
    { DODO_PAYMENTS_API_KEY: "key" },
  ])("returns fallback with missing/placeholder configuration", async (env) => {
    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing({ env } as App.Platform)).toEqual({
      monthly: null,
      yearly: null,
    });
    expect(retrieve).not.toHaveBeenCalled();
  });
  it("rejects usage-based, unsupported frequency, and country-varying products", async () => {
    retrieve
      .mockResolvedValueOnce({
        ...monthly,
        price: { ...monthly.price, type: "usage_based_price" },
      })
      .mockResolvedValueOnce({
        ...yearly,
        price: { ...yearly.price, payment_frequency_count: 2 },
      });
    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing(platform)).toEqual({
      monthly: null,
      yearly: null,
    });
    retrieve.mockResolvedValue({
      ...monthly,
      price: { ...monthly.price, purchasing_power_parity: true },
    });
    expect(await fetchProPricing(platform)).toEqual({
      monthly: null,
      yearly: null,
    });
  });
  it("applies configured product discounts in basis points", async () => {
    retrieve.mockResolvedValue({
      ...monthly,
      price: { ...monthly.price, discount_bps: 1250 },
    });
    const { fetchProPricing } = await loadBilling();
    expect((await fetchProPricing(platform)).monthly?.amountCents).toBe(1741);
  });
  it("caches pricing for the same account/configuration", async () => {
    const { fetchProPricing } = await loadBilling();
    await fetchProPricing(platform);
    await fetchProPricing(platform);
    expect(retrieve).toHaveBeenCalledTimes(2);
  });
  it.each([
    { DODO_PAYMENTS_ENVIRONMENT: "live_mode" },
    { DODO_PAYMENTS_API_KEY: "another_account" },
    { DODO_PRO_MONTHLY_PRODUCT_ID: "another_product" },
  ])(
    "does not reuse pricing across mode/account/product configuration",
    async (change) => {
      const { fetchProPricing } = await loadBilling();
      await fetchProPricing(platform);
      await fetchProPricing({
        env: { ...platform.env, ...change },
      } as App.Platform);
      expect(retrieve).toHaveBeenCalledTimes(4);
    },
  );
  it("does not cache a total outage", async () => {
    retrieve.mockRejectedValue(new Error("provider unavailable"));
    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing(platform)).toEqual({
      monthly: null,
      yearly: null,
    });
    retrieve.mockImplementation(async (id) =>
      id === "pdt_monthly" ? monthly : yearly,
    );
    expect((await fetchProPricing(platform)).monthly?.amountCents).toBe(1990);
  });
});
