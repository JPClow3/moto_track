import { render } from "svelte/server";
import { readable } from "svelte/store";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTranslator,
  formatDate,
  formatDistance,
  formatMoney,
  formatNumber,
  formatPreciseMoney,
} from "$lib/i18n";
import { getFeature } from "$server/domain/features";

vi.mock("$app/stores", () => ({
  page: readable({
    data: { locale: "en" },
    url: new URL("https://app.example/"),
  }),
  navigating: readable(null),
  updated: readable(false),
}));
vi.mock("$lib/i18n/store", () => ({
  locale: readable("en"),
  t: readable(createTranslator("en")),
  format: readable({
    money: (value: number) => formatMoney("en", value),
    preciseMoney: (value: number) => formatPreciseMoney("en", value),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber("en", value, options),
    distance: (value: number) => formatDistance("en", value),
    date: (
      value: string | number | Date,
      options?: Intl.DateTimeFormatOptions,
    ) => formatDate("en", value, options),
  }),
}));

let authPage: typeof import("../../src/routes/auth/+page.svelte");
let landingPage: typeof import("../../src/routes/+page.svelte");
let blogPage: typeof import("../../src/routes/(public)/blog/+page.svelte");
let featurePage: typeof import("../../src/lib/components/FeaturePage.svelte");
let skeleton: typeof import("../../src/lib/components/Skeleton.svelte");
let timeline: typeof import("../../src/lib/components/app/ActivityTimeline.svelte");
beforeAll(async () => {
  [authPage, landingPage, blogPage, featurePage, skeleton, timeline] =
    await Promise.all([
      import("../../src/routes/auth/+page.svelte"),
      import("../../src/routes/+page.svelte"),
      import("../../src/routes/(public)/blog/+page.svelte"),
      import("../../src/lib/components/FeaturePage.svelte"),
      import("../../src/lib/components/Skeleton.svelte"),
      import("../../src/lib/components/app/ActivityTimeline.svelte"),
    ]);
}, 60_000);

afterEach(() => vi.unstubAllEnvs());

describe("feature updated-at dates", () => {
  it.each(["UTC", "America/Sao_Paulo", "Asia/Tokyo"])(
    "uses the product calendar day in a %s runtime for strings and Date objects",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone);
      const timestamp = "2026-10-29T01:30:00.000Z";
      for (const updatedAt of [timestamp, new Date(timestamp)]) {
        const { body } = render(featurePage.default, {
          props: {
            routeSlug: "reminders",
            feature: getFeature("reminders"),
            rows: [
              { id: "reminder", title: "Oil change", updated_at: updatedAt },
            ],
          },
        });
        const cell = body.match(
          /data-label="Updated"[^>]*>([\s\S]*?)<\/td>/,
        )?.[1];
        expect(cell).toContain("Oct 28, 2026");
        expect(cell).not.toContain("Oct 29");
      }
    },
  );

  it.each([null, "invalid", new Date("invalid")])(
    "renders an empty value for an invalid updated-at timestamp (%s)",
    (updatedAt) => {
      const { body } = render(featurePage.default, {
        props: {
          routeSlug: "reminders",
          feature: getFeature("reminders"),
          rows: [{ id: "reminder", updated_at: updatedAt }],
        },
      });
      const cell = body.match(
        /data-label="Updated"[^>]*>([\s\S]*?)<\/td>/,
      )?.[1];
      expect(cell).toContain("—");
    },
  );
});

describe("English rendered journeys for branch acceptance", () => {
  it("localizes default loading and empty-state accessibility labels", () => {
    expect(render(skeleton.default).body).toContain(
      'aria-label="Loading content"',
    );
    const { body } = render(timeline.default, { props: { items: [] } });
    expect(body).toContain('aria-label="Activity"');
    expect(body).toContain("No activity recorded yet.");
    expect(body).not.toContain("Atividades");
  });
  it("renders sign-in, account creation and recovery controls in English", () => {
    const { body, head } = render(authPage.default, {
      props: {
        data: {
          redirectTo: "/dashboard",
          socialProviders: ["google", "apple"],
        },
        form: undefined,
      },
    });
    expect(head).toContain("Sign in");
    expect(body).toContain("Access your garage.");
    expect(body).toContain("Create account");
    expect(body).toContain("Forgot my password");
    expect(body).toContain('action="?/google"');
    expect(body).toContain('action="?/apple"');
    expect(body).toContain("password (at least 6 characters)");
    expect(body).not.toMatch(
      /Acesse sua garagem|Criar conta|Esqueci minha senha|>Senha</,
    );
  });

  it("renders landing navigation, features, plan segments and metadata in English", () => {
    const { body, head } = render(landingPage.default, {
      props: {
        data: {
          pricing: { monthly: null, yearly: null } as never,
          articles: [],
        },
      },
    });
    expect(head).toContain("Your Motorcycle Command Center");
    expect(body).toContain("Start for free");
    expect(body).toContain("Costs &amp; Fuel");
    expect(body).toContain("1 active motorcycle");
    expect(body).toContain("3 active reminders at a time");
    expect(body).toContain("Privacy");
    expect(body).not.toMatch(
      /Custos &amp; Combustível|Começar de graça|3 lembretes ativos|Navegação secundária/,
    );
  });

  it("renders blog availability and source-language disclosure in English", () => {
    const { body } = render(blogPage.default, {
      props: { data: { articles: [] } },
    });
    expect(body).toContain("No guides published yet");
    expect(body).toContain("original language");
    expect(body).not.toContain("Nenhum guia publicado");
  });

  it("renders translated reminder fields and existing trigger values without changing their submitted values", () => {
    const { body } = render(featurePage.default, {
      props: {
        routeSlug: "reminders",
        feature: {
          ...getFeature("reminders"),
          title: "Reminders",
          subtitle: "Reminders",
        },
        rows: [
          {
            id: "owned-reminder",
            title: "My own reminder",
            trigger_type: "by_km",
            is_active: true,
            reference_date: "2026-01-02",
            reference_km: 1000,
          },
        ],
        motorcycles: [
          {
            id: "owned-bike",
            name: "My own bike",
            brand: "Honda",
            model: "CG",
          },
        ],
      },
    });
    expect(body).toContain("When to notify");
    expect(body).toContain("By mileage");
    expect(body).toContain('value="by_km"');
    expect(body).toContain("Starting odometer for the interval.");
    expect(body).toContain("My own reminder");
    expect(body).not.toContain("Quando avisar");
  });
});
