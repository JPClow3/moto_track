import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  customerCreate: vi.fn(),
  customerRetrieve: vi.fn(),
  customerList: vi.fn(),
  subscriptionList: vi.fn(),
  productRetrieve: vi.fn(),
  checkoutCreate: vi.fn(),
  checkoutRetrieve: vi.fn(),
}));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
vi.mock("dodopayments", () => ({
  default: class {
    customers = {
      create: mocks.customerCreate,
      retrieve: mocks.customerRetrieve,
      list: mocks.customerList,
    };
    subscriptions = { list: mocks.subscriptionList };
    products = { retrieve: mocks.productRetrieve };
    checkoutSessions = {
      create: mocks.checkoutCreate,
      retrieve: mocks.checkoutRetrieve,
    };
  },
}));
import {
  ensureBillingCustomer,
  createCheckoutSession,
} from "$server/domain/billing";
import { GET } from "../../src/routes/billing/checkout/+server";
const platform = {
  env: {
    DODO_PAYMENTS_API_KEY: "key_test",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
    DODO_PRO_YEARLY_PRODUCT_ID: "pdt_yearly",
    PUBLIC_SITE_URL: "https://moto-track.net",
  },
} as unknown as App.Platform;
const customer = {
  customer_id: "cus_owner",
  email: "owner@example.com",
  metadata: { user_id: "owner", environment: "test_mode", app: "moto_track" },
};
const product = {
  is_recurring: true,
  product_id: "pdt_yearly",
  price: {
    type: "recurring_price",
    price: 9900,
    currency: "BRL",
    payment_frequency_count: 1,
    payment_frequency_interval: "Year",
    trial_payment_method_optional: false,
  },
};
function iterate<T>(items: T[]) {
  return (async function* () {
    for (const item of items) yield item;
  })();
}
type Row = Record<string, unknown>;
function database() {
  const state: {
    profile: Row | null;
    deleted: boolean;
    userExists: boolean;
    environment: string;
  } = {
    profile: null,
    deleted: false,
    userExists: true,
    environment: "test_mode",
  };
  const commits: Array<Row | null> = [];
  function queryFor(current: typeof state) {
    return vi.fn((first: unknown, ...values: unknown[]) => {
      if (!Array.isArray(first)) return { __row: first };
      const sql = first.join("?").replace(/\s+/g, " ").trim().toLowerCase();
      if (sql.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (sql.startsWith("select exists"))
        return Promise.resolve([
          {
            user_exists: current.userExists,
            deleted: current.deleted,
            entitlement_environment: current.environment,
          },
        ]);
      if (sql.startsWith("select billing_customer_id"))
        return Promise.resolve(current.profile ? [current.profile] : []);
      if (sql.startsWith("insert into subscription_profiles"))
        current.profile = {
          ...current.profile,
          ...(values[0] as { __row: Row }).__row,
        };
      else if (sql.startsWith("update subscription_profiles")) {
        if (sql.includes("billing_subscription_id = null"))
          current.profile = {
            ...current.profile,
            billing_subscription_id: null,
            billing_subscription_status: null,
            billing_checkout_session_id: null,
            billing_checkout_url: null,
          };
        else if (sql.includes("billing_checkout_url = ''"))
          current.profile = {
            ...current.profile,
            billing_checkout_session_id: values[0],
            billing_checkout_url: "",
            billing_checkout_created_at: values[1],
          };
        else
          current.profile = {
            ...current.profile,
            billing_checkout_session_id: values[0],
            billing_checkout_url: values[1],
          };
      } else throw new Error(`Unexpected query ${sql}`);
      return Promise.resolve([]);
    });
  }
  const db = {
    begin: async (callback: (tx: unknown) => Promise<unknown>) => {
      const current = {
        ...state,
        profile: state.profile ? { ...state.profile } : null,
      };
      const result = await callback(queryFor(current));
      Object.assign(state, current);
      commits.push(state.profile ? { ...state.profile } : null);
      return result;
    },
  };
  return { state, db, commits };
}
function request(
  db: ReturnType<typeof database>["db"],
  interval = "yearly",
  authenticated = true,
) {
  return {
    locals: {
      db,
      user: authenticated ? { id: "owner", email: "owner@example.com" } : null,
    },
    url: new URL(
      `https://moto-track.net/billing/checkout?interval=${interval}`,
    ),
    platform,
  } as unknown as Parameters<typeof GET>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.customerCreate.mockResolvedValue(customer);
  mocks.customerRetrieve.mockResolvedValue(customer);
  mocks.customerList.mockImplementation(() => iterate([]));
  mocks.subscriptionList.mockImplementation(() => iterate([]));
  mocks.productRetrieve.mockResolvedValue(product);
  mocks.checkoutCreate.mockResolvedValue({
    session_id: "cks_owner",
    checkout_url: "https://checkout.dodopayments.com/session/cks_owner",
  });
  mocks.checkoutRetrieve.mockResolvedValue({ payment_status: null });
});
describe("Dodo checkout identity and provider lifecycle", () => {
  it("commits customer and durable intent before creating a payable session", async () => {
    const db = database();
    mocks.checkoutCreate.mockImplementation(async () => {
      expect(db.state.profile).toMatchObject({
        billing_customer_id: "cus_owner",
        billing_provider: "dodo",
        billing_environment: "test_mode",
        billing_checkout_url: "",
      });
      expect(db.state.profile?.billing_checkout_session_id).toMatch(
        /^pending:/,
      );
      expect(db.commits).toHaveLength(2);
      return {
        session_id: "cks_owner",
        checkout_url: "https://checkout.dodopayments.com/session/cks_owner",
      };
    });
    await expect(GET(request(db.db))).rejects.toMatchObject({
      status: 303,
      location: "https://checkout.dodopayments.com/session/cks_owner",
    });
    expect(db.state.profile).toMatchObject({
      billing_checkout_session_id: "cks_owner",
    });
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: "pdt_yearly", quantity: 1 }],
        subscription_data: { trial_period_days: 7 },
        metadata: expect.objectContaining({
          checkout_attempt_id: expect.stringMatching(/^pending:/),
        }),
      }),
      { maxRetries: 0 },
    );
    expect(mocks.customerCreate).toHaveBeenCalledWith(expect.anything(), {
      maxRetries: 0,
    });
  });
  it("reuses the original payable link across tabs and interval changes", async () => {
    const db = database();
    await expect(GET(request(db.db))).rejects.toMatchObject({ status: 303 });
    await expect(GET(request(db.db, "monthly"))).rejects.toMatchObject({
      location: "https://checkout.dodopayments.com/session/cks_owner",
    });
    expect(mocks.checkoutCreate).toHaveBeenCalledTimes(1);
    expect(mocks.customerCreate).toHaveBeenCalledTimes(1);
  });
  it("retains an ambiguous session creation intent and never blindly retries CREATE", async () => {
    const db = database();
    mocks.checkoutCreate.mockRejectedValue(new Error("response lost"));
    await expect(GET(request(db.db))).rejects.toMatchObject({
      location: "/precos?checkout=error",
    });
    expect(db.state.profile?.billing_checkout_session_id).toMatch(/^pending:/);
    expect(db.state.profile?.billing_customer_id).toBe("cus_owner");
    await expect(GET(request(db.db))).rejects.toMatchObject({
      location: "/precos?checkout=error",
    });
    expect(mocks.checkoutCreate).toHaveBeenCalledTimes(1);
  });
  it("recovers a customer created before a lost provider response by exact metadata", async () => {
    const db = database();
    mocks.customerCreate.mockRejectedValueOnce(new Error("response lost"));
    await expect(GET(request(db.db))).rejects.toMatchObject({
      location: "/precos?checkout=error",
    });
    expect(db.state.profile).toBeNull();
    mocks.customerList.mockImplementation(() => iterate([customer]));
    await expect(GET(request(db.db))).rejects.toMatchObject({
      status: 303,
      location: "https://checkout.dodopayments.com/session/cks_owner",
    });
    expect(mocks.customerCreate).toHaveBeenCalledTimes(1);
  });
  it("does not reuse another account's customer solely by email", async () => {
    mocks.customerList.mockImplementation(() =>
      iterate([
        { ...customer, metadata: { ...customer.metadata, user_id: "other" } },
      ]),
    );
    await ensureBillingCustomer({
      email: customer.email,
      userId: "owner",
      platform,
    });
    expect(mocks.customerCreate).toHaveBeenCalledTimes(1);
  });
  it("fails closed on duplicate matching customers or a stale configured customer", async () => {
    mocks.customerList.mockImplementation(() =>
      iterate([customer, { ...customer, customer_id: "cus_duplicate" }]),
    );
    await expect(
      ensureBillingCustomer({
        email: customer.email,
        userId: "owner",
        platform,
      }),
    ).rejects.toThrow("Multiple Dodo customers");
    mocks.customerRetrieve.mockRejectedValue(
      Object.assign(new Error("missing"), { status: 404 }),
    );
    await expect(
      ensureBillingCustomer({
        email: customer.email,
        userId: "owner",
        customerId: "cus_stale",
        platform,
      }),
    ).rejects.toThrow("missing");
    expect(mocks.customerCreate).not.toHaveBeenCalled();
  });
  it("never unblocks closed billing identities", async () => {
    mocks.customerRetrieve.mockResolvedValue({
      ...customer,
      blocked_at: "2026-09-29",
    });
    await expect(
      ensureBillingCustomer({
        email: customer.email,
        userId: "owner",
        customerId: customer.customer_id,
        platform,
      }),
    ).rejects.toThrow("blocked");
  });
  it("does not offer another trial when historical subscriptions exist", async () => {
    mocks.subscriptionList.mockImplementation(() =>
      iterate([
        {
          subscription_id: "sub_old",
          status: "cancelled",
          customer: { customer_id: customer.customer_id },
        },
      ]),
    );
    await createCheckoutSession({
      email: customer.email,
      userId: "owner",
      customerId: customer.customer_id,
      interval: "yearly",
      trialEligible: true,
      checkoutKey: "attempt",
      platform,
    });
    expect(
      mocks.checkoutCreate.mock.calls[0][0].subscription_data.trial_period_days,
    ).toBe(0);
  });
  it.each(["active", "pending", "on_hold", "paused", "past_due"])(
    "refuses a duplicate checkout for existing %s subscription",
    async (status) => {
      mocks.subscriptionList.mockImplementation(() =>
        iterate([
          {
            subscription_id: "sub_existing",
            status,
            customer: { customer_id: customer.customer_id },
          },
        ]),
      );
      const db = database();
      await expect(GET(request(db.db))).rejects.toMatchObject({
        location: "/billing/portal",
      });
      expect(mocks.checkoutCreate).not.toHaveBeenCalled();
    },
  );
  it.each(["deleted", "missing", "wrong_mode"])(
    "checks account eligibility after acquiring its lock (%s)",
    async (failure) => {
      const db = database();
      if (failure === "deleted") db.state.deleted = true;
      if (failure === "missing") db.state.userExists = false;
      if (failure === "wrong_mode") db.state.environment = "live_mode";
      await expect(GET(request(db.db))).rejects.toMatchObject({
        location: "/precos?checkout=error",
      });
      expect(mocks.customerCreate).not.toHaveBeenCalled();
      expect(mocks.checkoutCreate).not.toHaveBeenCalled();
    },
  );
  it("preserves annual checkout choice through authentication", async () => {
    const db = database();
    await expect(GET(request(db.db, "yearly", false))).rejects.toMatchObject({
      location: "/auth?redirectTo=%2Fbilling%2Fcheckout%3Finterval%3Dyearly",
    });
    expect(db.commits).toHaveLength(0);
  });
  it("preserves historical billing references until operator reconciliation", async () => {
    const db = database();
    db.state.profile = {
      billing_provider: "legacy",
      billing_customer_id: "historical_customer",
      billing_subscription_id: "historical_subscription",
      plan: "pro",
      grace_until: "2026-10-20T12:00:00Z",
    };
    await expect(GET(request(db.db))).rejects.toMatchObject({
      location: "/precos?checkout=error",
    });
    expect(db.state.profile).toMatchObject({
      billing_provider: "legacy",
      billing_subscription_id: "historical_subscription",
      plan: "pro",
    });
    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.customerRetrieve).not.toHaveBeenCalled();
  });
  it.each([
    { trial_payment_method_optional: true },
    { trial_amount: 100 },
    { type: "usage_based_price" },
  ])(
    "refuses products that violate advertised free/card-required trial",
    async (changes) => {
      mocks.productRetrieve.mockResolvedValue({
        ...product,
        price: { ...product.price, ...changes },
      });
      await expect(
        createCheckoutSession({
          email: customer.email,
          userId: "owner",
          customerId: customer.customer_id,
          interval: "yearly",
          trialEligible: true,
          checkoutKey: "attempt",
          platform,
        }),
      ).rejects.toThrow("fixed recurring");
      expect(mocks.checkoutCreate).not.toHaveBeenCalled();
    },
  );
});
