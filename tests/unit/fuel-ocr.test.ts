import { describe, expect, it, vi } from "vitest";
import { parseReceiptFile } from "../../src/lib/server/domain/fuel";

describe("receipt OCR", () => {
  it("sends a PDF to the configured OCR provider and parses its response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [
            {
              markdown:
                "Data 10/07/2026\\nLitros: 12,500\\nTotal R$ 75,00\\nPreco litro R$ 6,000",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const receipt = new File(["receipt"], "receipt.pdf", {
      type: "application/pdf",
    });

    const result = await parseReceiptFile(receipt, {
      apiKey: "test-key",
      fetch: fetchMock,
    });

    expect(result).toMatchObject({
      date: "2026-07-10",
      liters: 12.5,
      total_price: 75,
      price_per_liter: 6,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: "mistral-ocr-latest",
      document: { type: "document_url" },
    });
  });

  it("fails clearly when OCR is not configured instead of inventing values", async () => {
    const receipt = new File(["receipt"], "receipt.png", {
      type: "image/png",
    });

    await expect(parseReceiptFile(receipt, { apiKey: "" })).rejects.toThrow(
      "MISTRAL_API_KEY",
    );
  });
});
