import { expect, test } from "@playwright/test";

const enabled = process.env.PRODUCTION_PROVIDER_SMOKE === "true";
const marker = process.env.PROVIDER_SMOKE_MARKER ?? "PROVIDER-SMOKE-LOCAL";

test.describe("production provider acceptance", () => {
  test.skip(!enabled, "Run only from the protected production smoke workflow.");
  test.setTimeout(180_000);

  test("auth, OCR, Stripe, R2 ownership and LGPD export are wired", async ({
    page,
  }, testInfo) => {
    const receiptPath = testInfo.outputPath("provider-receipt.png");
    await page.setViewportSize({ width: 900, height: 600 });
    await page.setContent(`
      <main style="font: 700 34px/1.6 monospace; padding: 48px; color: #111; background: #fff">
        <h1>POSTO MOTO TRACK</h1>
        <p>DATA: 22/09/2026</p>
        <p>VOLUME (L): 10,00</p>
        <p>PRECO LITRO: R$ 6,00</p>
        <p>TOTAL: R$ 60,00</p>
      </main>
    `);
    await page.screenshot({ path: receiptPath });

    await test.step("production session and provider configuration", async () => {
      await page.goto("/billing/conta");
      await expect(
        page.getByRole("heading", { name: /Conta|Account/i }),
      ).toBeVisible();

      const status = await page.request.get("/api/pwa/status");
      expect(status.ok()).toBe(true);
      const statusBody = await status.json();
      expect(statusBody).toMatchObject({ authenticated: true });
      expect(String(statusBody.pushPublicKey ?? "").length).toBeGreaterThan(20);
    });

    await test.step("Mistral OCR populates review fields without persisting", async () => {
      await page.goto("/fuel");
      await page
        .getByRole("button", { name: /novo abastecimento|new fuel/i })
        .first()
        .click();
      await page
        .getByRole("button", { name: /escanear comprovante|scan receipt/i })
        .click();
      await page.locator("#fuel-ocr-file").setInputFiles(receiptPath);
      await page
        .locator('form[action="?/ocrScan"]')
        .getByRole("button", { name: /escanear|scan/i })
        .click();

      await expect(page.locator("#ocr-date")).toHaveValue("2026-09-22", {
        timeout: 60_000,
      });
      await expect(page.locator("#ocr-liters")).toHaveValue("10");
      await expect(page.locator("#ocr-total-price")).toHaveValue("60");
      await expect(page.locator("#ocr-price-per-liter")).toHaveValue("6");
      await page
        .getByRole("button", { name: /fechar|close/i })
        .last()
        .click();
    });

    await test.step("Stripe creates a hosted test checkout", async () => {
      await page.goto("/billing/checkout?interval=monthly", {
        waitUntil: "domcontentloaded",
      });
      expect(new URL(page.url()).hostname).toMatch(
        /(^|\.)checkout\.stripe\.com$/,
      );
    });

    let fileUrl = "";
    let documentCreated = false;
    await test.step("R2 upload is owner-only and deletion removes it", async () => {
      try {
        await page.goto("/documents");
        await page
          .getByRole("button", {
            name: /^(adicionar|adicionar registro|novo registro)$/i,
          })
          .first()
          .click();
        const form = page.locator(
          'form[action="?/record"]:has(input[name="_intent"][value="create"])',
        );
        const motorcycle = form.locator("#new-motorcycle_id");
        if ((await motorcycle.locator("option").count()) > 1) {
          await motorcycle.selectOption({ index: 1 });
        }
        await form.locator("#new-name").fill(marker);
        await form.locator("#new-document_type").fill("Provider smoke");
        await form.locator("#new-file_key").setInputFiles(receiptPath);
        await form.getByRole("button", { name: /salvar|save/i }).click();

        const row = page.locator("tbody tr").filter({ hasText: marker });
        await expect(row).toBeVisible();
        documentCreated = true;
        fileUrl = (await row
          .getByRole("link", { name: /abrir|open/i })
          .getAttribute("href"))!;
        expect(fileUrl).toMatch(/^\/files\//);

        const ownerDownload = await page.request.get(fileUrl);
        expect(ownerDownload.ok()).toBe(true);
        expect((await ownerDownload.body()).length).toBeGreaterThan(100);

        const anonymous = await page.context().browser()!.newContext({
          baseURL: process.env.E2E_BASE_URL,
        });
        try {
          const strangerDownload = await anonymous.request.get(fileUrl);
          expect([401, 404]).toContain(strangerDownload.status());
        } finally {
          await anonymous.close();
        }

        await row.getByRole("button", { name: /excluir|delete/i }).click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("button", { name: /confirmar|excluir|delete|confirm/i })
          .click();
        await expect(row).toHaveCount(0);
        documentCreated = false;
        const deletedDownload = await page.request.get(fileUrl);
        expect(deletedDownload.status()).toBe(404);
      } finally {
        if (documentCreated) {
          await page.goto("/documents");
          const leftover = page.locator("tbody tr").filter({ hasText: marker });
          if (await leftover.isVisible()) {
            await leftover
              .getByRole("button", { name: /excluir|delete/i })
              .click();
            await page
              .getByRole("dialog")
              .getByRole("button", {
                name: /confirmar|excluir|delete|confirm/i,
              })
              .click();
          }
        }
      }
    });

    await test.step("LGPD export is downloadable and excludes credentials", async () => {
      const response = await page.request.get("/billing/conta/export");
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-disposition"]).toContain("attachment");
      const body = await response.text();
      expect(body).not.toMatch(/password|secret|credential/i);
      expect(() => JSON.parse(body)).not.toThrow();
    });
  });
});
