import { describe, expect, it, vi } from "vitest";
import {
  MAX_RECEIPT_OCR_BYTES,
  parseReceiptFile,
  parseReceiptText,
} from "../../src/lib/server/domain/fuel";

describe("receipt OCR", () => {
  it("sends a PDF to the configured OCR provider and parses its response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [
            {
              markdown:
                "Data 10/07/2026\nLitros: 12,500\nTotal R$ 75,00\nPreco litro R$ 6,000",
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

  it("correctly parses receipts that use decimal dots instead of commas", () => {
    const text =
      "Data: 15/08/2026\nLitros: 15.750\nTotal: R$ 94.50\nPreco/L: 6.00";
    const parsed = parseReceiptText(text);
    expect(parsed).toMatchObject({
      date: "2026-08-15",
      liters: 15.75,
      total_price: 94.5,
      price_per_liter: 6,
    });
  });

  it("handles both decimal dots and commas in parseReceiptText without inflating amounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [
            {
              markdown:
                "Data 12/08/2026\n15.50 Litros\nValor: R$ 93.00\nPreco litro: 6.00",
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
      date: "2026-08-12",
      liters: 15.5,
      total_price: 93,
      price_per_liter: 6,
    });
  });

  it("fails clearly when OCR is not configured instead of inventing values", async () => {
    const receipt = new File(["receipt"], "receipt.png", {
      type: "image/png",
    });

    await expect(parseReceiptFile(receipt, { apiKey: "" })).rejects.toThrow(
      "OCR de comprovante ainda não está configurado",
    );
  });

  it("rejects oversized text receipts before reading their contents", async () => {
    const text = vi.fn(async () => "Total: R$ 5,00");
    const receipt = {
      type: "text/plain",
      size: MAX_RECEIPT_OCR_BYTES + 1,
      text,
    } as unknown as File;

    await expect(parseReceiptFile(receipt)).rejects.toThrow(
      "excede o limite de 10 MB",
    );
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects unlisted text content types", async () => {
    const receipt = new File(["Total: R$ 5,00"], "receipt.html", {
      type: "text/html",
    });

    await expect(parseReceiptFile(receipt)).rejects.toThrow(
      "Formato de comprovante não suportado",
    );
  });
});
