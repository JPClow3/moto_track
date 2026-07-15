import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();

vi.mock("stripe", () => ({
  default: class {
    prices = { retrieve };
  },
}));

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

/**
 * Intl separates "R$" from the number with a non-breaking space, and the exact
 * codepoint varies by ICU version. Normalise any whitespace for assertions.
 */
const plain = (value: string) => value.replace(/\s/g, " ");

beforeEach(() => {
  retrieve.mockReset();
});

describe("fetchProPricing", () => {
  it("formats the live Stripe prices as pt-BR currency", async () => {
    retrieve.mockImplementation(async (id: string) =>
      id === "price_monthly" ? monthlyPrice : yearlyPrice,
    );

    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing(platform);

    expect(plain(pricing.monthly!.formatted)).toBe("R$ 19,90");
    expect(pricing.monthly!.amountCents).toBe(1990);
    expect(pricing.monthly!.interval).toBe("month");
    expect(plain(pricing.yearly!.formatted)).toBe("R$ 199,00");
    expect(pricing.yearly!.interval).toBe("year");
  });

  it("keeps the monthly price when the yearly lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    retrieve.mockImplementation(async (id: string) => {
      if (id === "price_monthly") return monthlyPrice;
      throw new Error("No such price: price_yearly");
    });

    const { fetchProPricing } = await loadBilling();
    const pricing = await fetchProPricing(platform);

    expect(plain(pricing.monthly!.formatted)).toBe("R$ 19,90");
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
    expect(plain(recovered.monthly!.formatted)).toBe("R$ 19,90");
  });
});
