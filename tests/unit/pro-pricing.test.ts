import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();

vi.mock("stripe", () => ({
  default: class {
    prices = { retrieve };
  },
}));

// Keep these tests hermetic: fetchProPricing resolves secrets via runtimeEnv,
// which otherwise falls back to the ambient $env (a developer's local .env).
// Blanking the fallback makes the `platform.env` passed in each test the only
// source of Stripe config, so the "secret key absent" case is genuinely absent.
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

const platform = {
  env: {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly",
    STRIPE_PRO_YEARLY_PRICE_ID: "price_yearly",
  },
} as unknown as App.Platform;

const monthlyPrice = {
  active: true,
  unit_amount: 1990,
  currency: "brl",
  recurring: { interval: "month" },
};
const yearlyPrice = {
  active: true,
  unit_amount: 19900,
  currency: "brl",
  recurring: { interval: "year" },
};

/** Fresh module each time, so the in-module price cache never leaks across tests. */
async function loadBilling() {
  vi.resetModules();
  return import("$server/domain/billing");
}

beforeEach(() => {
  retrieve.mockReset();
});

describe("fetchProPricing", () => {
  // These used to assert a pre-formatted "R$ 19,90" string built here. That
  // string is gone on purpose: this lookup is cached process-wide, so a locale
  // baked in at this layer would be served to every reader. Formatting is now
  // the renderer's job and is covered in i18n-format.test.ts.
  it("returns the live Stripe prices as raw amounts for the caller to format", async () => {
    retrieve.mockImplementation(async (id: string) =>
      id === "price_monthly" ? monthlyPrice : yearlyPrice,
    );

    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing(platform);

    expect(pricing.monthly).toEqual({
      amountCents: 1990,
      currency: "brl",
      interval: "month",
    });
    expect(pricing.yearly).toEqual({
      amountCents: 19900,
      currency: "brl",
      interval: "year",
    });
  });

  it("keeps the monthly price when the yearly lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    retrieve.mockImplementation(async (id: string) => {
      if (id === "price_monthly") return monthlyPrice;
      throw new Error("No such price: price_yearly");
    });

    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing(platform);

    expect(pricing.monthly!.amountCents).toBe(1990);
    expect(pricing.yearly).toBeNull();
  });

  it("returns no prices, and never calls Stripe, when the secret key is absent", async () => {
    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing({
      env: {},
    } as unknown as App.Platform);

    expect(pricing).toEqual({ monthly: null, yearly: null });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("ignores prices it cannot render as a single headline figure", async () => {
    // Tiered/metered prices carry a null unit_amount; archived ones are inactive.
    retrieve.mockImplementation(async (id: string) =>
      id === "price_monthly"
        ? { ...monthlyPrice, unit_amount: null }
        : { ...yearlyPrice, active: false },
    );

    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing(platform);

    expect(pricing).toEqual({ monthly: null, yearly: null });
  });

  it("serves the cached prices rather than hitting Stripe on every render", async () => {
    retrieve.mockImplementation(async (id: string) =>
      id === "price_monthly" ? monthlyPrice : yearlyPrice,
    );

    const { fetchProPricing } = await loadBilling();
    await fetchProPricing(platform);
    await fetchProPricing(platform);

    expect(retrieve).toHaveBeenCalledTimes(2); // one monthly + one yearly, not four
  });

  it("does not cache a failed lookup, so a Stripe outage cannot pin the placeholder", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    retrieve.mockRejectedValue(new Error("Stripe is down"));

    const { fetchProPricing } = await loadBilling();
    expect(await fetchProPricing(platform)).toEqual({
      monthly: null,
      yearly: null,
    });

    retrieve.mockImplementation(async (id: string) =>
      id === "price_monthly" ? monthlyPrice : yearlyPrice,
    );
    const recovered = await fetchProPricing(platform);
    expect(recovered.monthly!.amountCents).toBe(1990);
  });
});
