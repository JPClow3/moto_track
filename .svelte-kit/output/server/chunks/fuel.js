import { z } from "zod";
const MAX_RECEIPT_OCR_BYTES = 10 * 1024 * 1024;
function toBase64(bytes) {
  let binary = "";
  for (const value of new Uint8Array(bytes)) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}
function supportedReceiptType(file) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}
function numberFromMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const normalized = match[1].replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function parseReceiptText(text) {
  const normalized = text.toLowerCase();
  const liters = numberFromMatch(normalized, [
    /(?:litros?|l)\s*[:=]?\s*(\d+(?:[,.]\d{1,3})?)/i,
    /(\d+(?:[,.]\d{1,3})?)\s*l(?:itros?)?\b/i
  ]);
  const total = numberFromMatch(normalized, [
    /(?:total|valor)\s*[:=]?\s*r?\$?\s*(\d+(?:[,.]\d{2})?)/i,
    /r\$\s*(\d+(?:[,.]\d{2})?)/i
  ]);
  const price = numberFromMatch(normalized, [
    /(?:pre[cç]o|unit[aá]rio|litro)\s*[:=]?\s*r?\$?\s*(\d+(?:[,.]\d{2,3})?)/i
  ]);
  const dateMatch = normalized.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch?.[1]?.includes("/") ? dateMatch[1].split("/").reverse().join("-") : dateMatch?.[1] ?? null;
  return {
    liters,
    total_price: total,
    price_per_liter: price ?? (liters && total ? Math.round(total / liters * 1e3) / 1e3 : null),
    date
  };
}
async function parseReceiptFile(file, { apiKey, fetch: fetchImpl = globalThis.fetch } = {}) {
  if (file.type.startsWith("text/")) {
    return parseReceiptText(await file.text());
  }
  if (!supportedReceiptType(file)) {
    throw new Error("Formato de comprovante não suportado para OCR.");
  }
  if (file.size > MAX_RECEIPT_OCR_BYTES) {
    throw new Error("O comprovante excede o limite de 10 MB para OCR.");
  }
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY must be configured for receipt OCR.");
  }
  const dataUrl = `data:${file.type};base64,${toBase64(await file.arrayBuffer())}`;
  const document = file.type === "application/pdf" ? { type: "document_url", document_url: dataUrl } : { type: "image_url", image_url: dataUrl };
  const response = await fetchImpl("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      confidence_scores_granularity: "page"
    })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OCR request failed (${response.status}): ${message}`);
  }
  const result = await response.json();
  const text = (result.pages ?? []).map((page) => page.markdown ?? "").filter(Boolean).join("\n");
  if (!text) {
    throw new Error("OCR did not return readable receipt text.");
  }
  return parseReceiptText(text);
}
const fuelImportRowSchema = z.object({
  date: z.string().date(),
  odometer_km: z.number().int().nonnegative(),
  liters: z.number().positive(),
  total_price_cents: z.number().int().nonnegative(),
  price_per_liter_millicents: z.number().int().nonnegative(),
  fuel_type: z.string().trim().min(1),
  tank_full: z.boolean(),
  station_name: z.string(),
  notes: z.string()
});
function parseFuelImportRows(value) {
  try {
    const rows = z.array(fuelImportRowSchema).min(1).max(500).safeParse(JSON.parse(value));
    return rows.success ? { ok: true, rows: rows.data } : { ok: false, message: "Import data is invalid." };
  } catch {
    return { ok: false, message: "Import data is invalid." };
  }
}
function parseFuelCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines.shift()?.split(",").map((item) => item.trim()) ?? [];
  return lines.map((line, index) => {
    const values = line.split(",").map((item) => item.trim());
    const raw = Object.fromEntries(
      header.map((key, col) => [key, values[col] ?? ""])
    );
    const liters = Number(String(raw.liters ?? "").replace(",", "."));
    const total = Number(
      String(raw.total_price ?? raw.total ?? "").replace(",", ".")
    );
    const price = Number(String(raw.price_per_liter ?? "").replace(",", ".")) || (liters > 0 && total > 0 ? total / liters : 0);
    const data = {
      date: String(raw.date ?? ""),
      odometer_km: Number(raw.odometer_km ?? raw.odometer ?? 0),
      liters,
      total_price_cents: Math.round(total * 100),
      price_per_liter_millicents: Math.round(price * 1e5),
      fuel_type: String(raw.fuel_type ?? "gasoline"),
      tank_full: ["1", "true", "sim", "yes"].includes(
        String(raw.tank_full ?? "").toLowerCase()
      ),
      station_name: String(raw.station_name ?? raw.station ?? ""),
      notes: String(raw.notes ?? "")
    };
    const errors = [];
    if (!data.date) errors.push("Data ausente.");
    if (!Number.isFinite(data.odometer_km) || data.odometer_km < 0)
      errors.push("Odômetro inválido.");
    if (!Number.isFinite(data.liters) || data.liters <= 0)
      errors.push("Litros inválidos.");
    if (!Number.isFinite(data.total_price_cents) || data.total_price_cents < 0)
      errors.push("Valor inválido.");
    return { row: index + 2, data, errors };
  });
}
function averageConsumption(records) {
  const ordered = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometer_km - b.odometer_km
  );
  const full = ordered.filter((record) => record.tank_full);
  if (full.length < 2) return null;
  const first = full[0];
  const last = full[full.length - 1];
  const startIndex = ordered.indexOf(first);
  const endIndex = ordered.indexOf(last);
  const relevantRecords = ordered.slice(startIndex + 1, endIndex + 1);
  const liters = relevantRecords.reduce(
    (sum, record) => sum + Number(record.liters || 0),
    0
  );
  const distance = last.odometer_km - first.odometer_km;
  if (distance <= 0 || liters <= 0) return null;
  return Math.round(distance / liters * 10) / 10;
}
function costPerKm(records) {
  const ordered = [...records].sort((a, b) => a.odometer_km - b.odometer_km);
  if (ordered.length < 2) return null;
  const distance = ordered[ordered.length - 1].odometer_km - ordered[0].odometer_km;
  const total = ordered.reduce(
    (sum, record) => sum + Number(record.total_price_cents || 0),
    0
  );
  if (distance <= 0) return null;
  return Math.round(total / 100 / distance * 1e3) / 1e3;
}
export {
  averageConsumption as a,
  parseFuelCsv as b,
  costPerKm as c,
  parseReceiptFile as d,
  parseFuelImportRows as p
};
