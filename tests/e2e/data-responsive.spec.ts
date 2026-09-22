import { expect, test, type APIResponse, type Page } from "@playwright/test";

/**
 * Data-heavy routes are exercised with a real account when CI provides one.
 * Keeping the suite skipped without credentials preserves the repository's
 * offline test contract while still guarding the authenticated surfaces in
 * preview runs.
 */
const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

const widths = [320, 375, 768, 1024, 1440];
const dataRoutes = [
  "/fuel",
  "/expenses",
  "/tires",
  "/documents",
  "/reports",
  "/trabalho",
];

async function gotoAppRoute(page: Page, route: string) {
  await expect(async () => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe(route);
  }).toPass({ intervals: [250, 500, 1_000], timeout: 10_000 });
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
}

type ApiRow = Record<string, unknown> & { id: string };

async function apiRows(page: Page, resource: string): Promise<ApiRow[]> {
  const response = await page.request.get(`/api/v1/${resource}`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { results: ApiRow[] }).results;
}

async function apiCreate(
  page: Page,
  resource: string,
  payload: Record<string, unknown>,
): Promise<{ response: APIResponse; row?: ApiRow }> {
  const response = await page.request.post(`/api/v1/${resource}`, {
    data: payload,
  });
  if (!response.ok()) return { response };
  return {
    response,
    row: ((await response.json()) as { result: ApiRow }).result,
  };
}

async function apiUpdate(
  page: Page,
  resource: string,
  payload: ApiRow,
): Promise<ApiRow> {
  const response = await page.request.patch(`/api/v1/${resource}`, {
    data: payload,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { result: ApiRow }).result;
}

async function apiDelete(page: Page, resource: string, id: string) {
  const response = await page.request.delete(
    `/api/v1/${resource}?id=${encodeURIComponent(id)}`,
  );
  expect(response.ok(), await response.text()).toBe(true);
}

async function postAction(
  page: Page,
  path: string,
  values: Record<string, string>,
) {
  return page.evaluate(
    async ({ path, values }) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(values),
      });
      return { status: response.status, body: await response.text() };
    },
    { path, values },
  );
}

async function createFuelRecord(
  page: Page,
  payload: {
    motorcycleId: string;
    odometer: number;
    marker: string;
    date: string;
    liters?: number;
  },
) {
  await gotoAppRoute(page, "/fuel");
  const result = await postAction(page, "/fuel?/createRecord", {
    motorcycle_id: payload.motorcycleId,
    date: payload.date,
    odometer_km: String(payload.odometer),
    liters: String(payload.liters ?? 10),
    total_price: "60",
    price_per_liter: "6",
    station_name: payload.marker,
    fuel_type: "gasoline",
    tank_full: "true",
    notes: payload.marker,
  });
  expect(result.status, result.body).toBe(200);
  const row = (await apiRows(page, "fuel-records")).find(
    (item) => item.station_name === payload.marker,
  );
  expect(row, `Fuel action did not persist ${payload.marker}`).toBeTruthy();
  return row!;
}

async function activeMotorcycle(page: Page) {
  await gotoAppRoute(page, "/garage");
  const form = page.locator('form[action="?/updateOdometer"]').first();
  await expect(
    form,
    "The acceptance account needs an active motorcycle",
  ).toBeVisible();
  return {
    id: await form.locator('input[name="motorcycle_id"]').inputValue(),
    odometer: Number(
      await form.locator('input[name="odometer_override_km"]').inputValue(),
    ),
  };
}

async function expectOdometer(page: Page, expected: number) {
  await gotoAppRoute(page, "/garage");
  await expect(
    page
      .locator('form[action="?/updateOdometer"]')
      .first()
      .locator('input[name="odometer_override_km"]'),
  ).toHaveValue(String(expected));
}

async function isFreePlan(page: Page) {
  await gotoAppRoute(page, "/billing/conta");
  return (await page.getByText(/^free$/i).count()) > 0;
}

test.describe("data surfaces responsive behavior", () => {
  test.setTimeout(300_000);
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test("data routes remain usable at every supported width", async ({
    page,
  }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of dataRoutes) {
        await gotoAppRoute(page, route);
        expect(page.url(), `${route} redirected to onboarding`).not.toContain(
          "/onboarding",
        );

        const geometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          geometry.scrollWidth,
          `${route} overflows at ${width}px`,
        ).toBeLessThanOrEqual(geometry.clientWidth + 1);

        const smallButtons = await page
          .locator("main button:visible")
          .evaluateAll((buttons) =>
            buttons
              .map((button) => {
                const box = button.getBoundingClientRect();
                return {
                  label: button.textContent?.trim(),
                  height: box.height,
                };
              })
              .filter(({ height }) => height < 44),
          );
        expect(
          smallButtons,
          `${route} has a touch target below 44px at ${width}px`,
        ).toEqual([]);

        const unlabeledFields = await page.evaluate(() => {
          const fields = Array.from(
            document.querySelectorAll<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >("main input:not([type=hidden]), main select, main textarea"),
          ).filter((field) => {
            const box = field.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          });

          return fields
            .filter((field) => {
              const labelledBy = field.getAttribute("aria-labelledby");
              const hasAria = Boolean(
                field.getAttribute("aria-label") || labelledBy,
              );
              const hasLabel = Boolean(
                field.id &&
                document.querySelector(`label[for="${CSS.escape(field.id)}"]`),
              );
              return !hasAria && !hasLabel && !field.closest("label");
            })
            .map((field) => field.name || field.type || field.tagName);
        });
        expect(
          unlabeledFields,
          `${route} has a visible form control without an accessible label at ${width}px`,
        ).toEqual([]);
      }
    }
  });

  test("generic record action persists a document", async ({ page }) => {
    await gotoAppRoute(page, "/documents");

    const addButton = page
      .getByRole("button", {
        name: /^(adicionar|adicionar registro|novo registro)$/i,
      })
      .first();
    await expect(addButton).toBeVisible();
    await addButton.click();
    const form = page.locator(
      'form[action="?/record"]:has(input[name="_intent"][value="create"])',
    );
    await form.locator("#new-motorcycle_id").selectOption({ index: 1 });
    await form.locator("#new-name").fill("Documento E2E");
    await form.locator("#new-document_type").fill("Validação de release");
    await form.getByRole("button", { name: /salvar|save/i }).click();

    await expect(page.getByText("Documento E2E").first()).toBeVisible();
  });

  test("fuel, maintenance, and tire records advance the motorcycle odometer", async ({
    page,
  }) => {
    const marker = `release-odometer-${Date.now()}`;
    const motorcycle = await activeMotorcycle(page);
    const created: Array<{ resource: string; id: string }> = [];

    try {
      const fuel = await createFuelRecord(page, {
        motorcycleId: motorcycle.id,
        date: "2026-09-20",
        odometer: motorcycle.odometer + 11,
        marker,
      });
      created.push({ resource: "fuel-records", id: fuel.id });
      await expectOdometer(page, motorcycle.odometer + 11);

      const maintenance = await apiCreate(page, "maintenance-records", {
        motorcycle_id: motorcycle.id,
        date: "2026-09-20",
        odometer_km: motorcycle.odometer + 22,
        maintenance_type: marker,
        description: "release acceptance",
        cost_cents: 10,
      });
      expect(
        maintenance.response.status(),
        await maintenance.response.text(),
      ).toBe(201);
      created.push({
        resource: "maintenance-records",
        id: maintenance.row!.id,
      });
      await expectOdometer(page, motorcycle.odometer + 22);

      const tire = await apiCreate(page, "tire-records", {
        motorcycle_id: motorcycle.id,
        installed_at: "2026-09-20",
        position: "rear",
        brand_model: marker,
        installed_odometer_km: motorcycle.odometer + 33,
        cost_cents: 10,
        wear_percent: 0,
        is_active: true,
      });
      expect(tire.response.status(), await tire.response.text()).toBe(201);
      created.push({ resource: "tire-records", id: tire.row!.id });
      await expectOdometer(page, motorcycle.odometer + 33);
    } finally {
      for (const item of created.reverse()) {
        await apiDelete(page, item.resource, item.id);
      }
    }

    await expectOdometer(page, motorcycle.odometer);
  });

  test("a work session advances the motorcycle odometer", async ({ page }) => {
    const marker = `release-work-odometer-${Date.now()}`;
    const motorcycle = await activeMotorcycle(page);
    let workId = "";

    try {
      await gotoAppRoute(page, "/trabalho");
      const workResult = await postAction(page, "/trabalho?/record", {
        _intent: "create",
        motorcycle_id: motorcycle.id,
        work_date: "2020-01-15",
        platform_source: marker,
        payment_method: "pix",
        odometer_start_km: String(motorcycle.odometer + 1),
        odometer_end_km: String(motorcycle.odometer + 10),
        gross_income_cents: "20",
        tips_cents: "0",
        fuel_spent_cents: "5",
        deliveries_count: "1",
        notes: marker,
      });
      await gotoAppRoute(page, "/trabalho");
      const workRow = page.locator("tbody tr", { hasText: marker });
      if (!(await workRow.count())) {
        expect(workResult.body).toContain(
          "O plano Free permite até 3 turnos por mês",
        );
        test.skip(
          true,
          "The dedicated account has reached its Free monthly work-session cap.",
        );
      }
      workId = await workRow
        .first()
        .locator('form[action="?/record"] input[name="id"]')
        .inputValue();
      await expectOdometer(page, motorcycle.odometer + 10);
    } finally {
      if (workId) {
        await gotoAppRoute(page, "/trabalho");
        const deleted = await postAction(page, "/trabalho?/record", {
          _intent: "delete",
          id: workId,
        });
        expect(deleted.status, deleted.body).toBe(200);
      }
    }

    await expectOdometer(page, motorcycle.odometer);
  });

  test("document, annual-fee, and maintenance updates keep one linked reminder in sync", async ({
    page,
  }) => {
    const motorcycle = await activeMotorcycle(page);
    const activeCount = (await apiRows(page, "reminders")).filter(
      (row) => row.is_active === true,
    ).length;
    const freePlan = await isFreePlan(page);
    test.skip(
      freePlan && activeCount >= 3,
      "The dedicated Free account has no reminder slot for linked-reminder acceptance.",
    );

    const marker = `release-linked-${Date.now()}`;
    const cases = [
      {
        resource: "documents",
        initial: {
          motorcycle_id: motorcycle.id,
          name: `${marker}-document`,
          document_type: "release",
          valid_until: "2030-06-30",
          notify_before_days: 30,
        },
        updated: {
          motorcycle_id: motorcycle.id,
          name: `${marker}-document-updated`,
          document_type: "release",
          valid_until: "2030-07-31",
          notify_before_days: 15,
        },
        title: `Documento vence: ${marker}-document-updated`,
        referenceDate: "2030-07-16",
      },
      {
        resource: "expenses",
        initial: {
          motorcycle_id: motorcycle.id,
          fee_type: `${marker}-fee`,
          year: 2030,
          due_date: "2030-03-31",
          amount_cents: 100,
          notify_before_days: 20,
        },
        updated: {
          motorcycle_id: motorcycle.id,
          fee_type: `${marker}-fee-updated`,
          year: 2030,
          due_date: "2030-04-30",
          amount_cents: 125,
          notify_before_days: 10,
        },
        title: `Taxa vence: ${marker}-fee-updated`,
        referenceDate: "2030-04-20",
      },
      {
        resource: "maintenance-records",
        initial: {
          motorcycle_id: motorcycle.id,
          date: "2026-09-20",
          odometer_km: motorcycle.odometer,
          maintenance_type: `${marker}-maintenance`,
          interval_km: 5000,
          cost_cents: 100,
        },
        updated: {
          motorcycle_id: motorcycle.id,
          date: "2026-09-21",
          odometer_km: motorcycle.odometer,
          maintenance_type: `${marker}-maintenance-updated`,
          interval_km: 6000,
          cost_cents: 125,
        },
        title: `Manutenção: ${marker}-maintenance-updated`,
        referenceDate: "2026-09-21",
      },
    ];

    for (const linkedCase of cases) {
      const created = await apiCreate(
        page,
        linkedCase.resource,
        linkedCase.initial,
      );
      expect(created.response.status(), await created.response.text()).toBe(
        201,
      );
      const record = created.row!;
      try {
        const reminderMarker = `auto:${
          linkedCase.resource === "documents"
            ? "motorcycle_documents"
            : linkedCase.resource === "expenses"
              ? "annual_fees"
              : "maintenance_records"
        }:${record.id}`;
        const original = (await apiRows(page, "reminders")).find(
          (row) => row.notes === reminderMarker,
        );
        expect(original, `missing ${reminderMarker}`).toBeTruthy();

        await apiUpdate(page, linkedCase.resource, {
          ...linkedCase.updated,
          id: record.id,
        });
        const synchronized = (await apiRows(page, "reminders")).filter(
          (row) => row.notes === reminderMarker,
        );
        expect(synchronized).toHaveLength(1);
        expect(synchronized[0]).toMatchObject({
          id: original!.id,
          title: linkedCase.title,
          reference_date: linkedCase.referenceDate,
          is_active: true,
        });
      } finally {
        await apiDelete(page, linkedCase.resource, record.id);
      }

      expect(
        (await apiRows(page, "reminders")).some((row) =>
          String(row.notes ?? "").endsWith(`:${record.id}`),
        ),
      ).toBe(false);
    }
  });

  test("Free reminder cap accepts the last slot and rejects the next create", async ({
    page,
  }) => {
    const isFree = await isFreePlan(page);
    test.skip(
      !isFree,
      "The dedicated account is Pro, so Free caps do not apply.",
    );

    const motorcycle = await activeMotorcycle(page);
    const marker = `release-cap-${Date.now()}`;
    const stale = (await apiRows(page, "reminders")).filter((row) =>
      String(row.title ?? "").startsWith("release-cap-"),
    );
    for (const row of stale) await apiDelete(page, "reminders", row.id);

    const initialActive = (await apiRows(page, "reminders")).filter(
      (row) => row.is_active === true,
    ).length;
    const created: string[] = [];
    try {
      for (let index = initialActive; index < 3; index += 1) {
        const result = await apiCreate(page, "reminders", {
          motorcycle_id: motorcycle.id,
          title: `${marker}-${index}`,
          trigger_type: "by_km",
          trigger_value_km: 500,
          reference_km: motorcycle.odometer,
          is_active: true,
          send_email: false,
          send_push: false,
        });
        expect(result.response.status(), await result.response.text()).toBe(
          201,
        );
        created.push(result.row!.id);
      }

      expect(
        (await apiRows(page, "reminders")).filter(
          (row) => row.is_active === true,
        ),
      ).toHaveLength(Math.max(3, initialActive));

      const blocked = await apiCreate(page, "reminders", {
        motorcycle_id: motorcycle.id,
        title: `${marker}-blocked`,
        trigger_type: "by_km",
        trigger_value_km: 500,
        reference_km: motorcycle.odometer,
        is_active: true,
      });
      expect(blocked.response.status()).toBe(403);
      expect(await blocked.response.text()).toContain(
        "O plano Free permite até 3 lembretes ativos",
      );
    } finally {
      for (const id of created) await apiDelete(page, "reminders", id);
    }
  });

  test("LGPD rejects an invalid deletion confirmation and returns a complete export", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/billing/conta");
    const deletionForm = page.locator('form[action="?/requestDeletion"]');
    await deletionForm.locator('input[name="confirmation"]').fill("INVALIDO");
    await deletionForm.getByRole("button").click();
    await expect(page.getByRole("alert")).toContainText(
      "Digite EXCLUIR para confirmar a exclusão da conta.",
    );

    const response = await page.request.get("/billing/conta/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["content-disposition"]).toContain(
      "moto-track-dados.json",
    );
    const exported = (await response.json()) as {
      exportedAt: string;
      profile: { id: string; email: string };
      records: Record<string, unknown[]>;
    };
    expect(Date.parse(exported.exportedAt)).not.toBeNaN();
    expect(exported.profile.email).toBe(process.env.E2E_USER_EMAIL);
    expect(exported.records).toEqual(
      expect.objectContaining({
        motorcycles: expect.any(Array),
        fuel_records: expect.any(Array),
        maintenance_records: expect.any(Array),
        account_data_requests: expect.any(Array),
      }),
    );
  });

  test("anonymous benchmark contribution is an upsert and respects the privacy floor", async ({
    page,
  }) => {
    const motorcycle = await activeMotorcycle(page);
    const marker = `release-benchmark-${Date.now()}`;
    const created: string[] = [];
    try {
      for (const [offset, liters] of [
        [100, 10],
        [300, 10],
      ] as const) {
        const result = await createFuelRecord(page, {
          motorcycleId: motorcycle.id,
          date: offset === 100 ? "2026-09-20" : "2026-09-21",
          odometer: motorcycle.odometer + offset,
          liters,
          marker: `${marker}-${offset}`,
        });
        created.push(result.id);
      }

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await gotoAppRoute(
          page,
          `/dashboard?benchmark=${encodeURIComponent(motorcycle.id)}`,
        );
        await page.locator("details.group\\/benchmark > summary").click();
        const benchmark = page
          .locator('form[action="?/contributeBenchmark"]')
          .first();
        await expect(benchmark).toBeVisible();
        await benchmark.locator('input[name="consent"]').check();
        await benchmark.getByRole("button").click();
        await expect(page).toHaveURL(
          new RegExp(`dashboard\\?benchmark=${motorcycle.id}`),
        );
        await expect(
          page.getByText(/contribuição anônima está ativa/i),
        ).toBeVisible();
      }

      const sampleText = await page
        .getByText(/Amostra: \d+ participantes/i)
        .first()
        .textContent();
      const sampleSize = Number(sampleText?.match(/\d+/)?.[0] ?? 0);
      if (sampleSize < 5) {
        await expect(
          page.getByText(/faltam .* participantes para liberar as médias/i),
        ).toBeVisible();
        await expect(page.getByText(/Média do grupo/i)).toHaveCount(0);
      }
    } finally {
      for (const id of created) await apiDelete(page, "fuel-records", id);
    }
  });
});
