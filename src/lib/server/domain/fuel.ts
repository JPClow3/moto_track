export type FuelRecord = {
  date: string;
  odometer_km: number;
  liters: number;
  total_price_cents?: number | null;
  tank_full?: boolean | null;
};

export type FuelOcrResult = {
  liters: number | null;
  total_price: number | null;
  price_per_liter: number | null;
  date: string | null;
};

export type ReceiptOcrOptions = {
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
};

type MistralOcrResponse = {
  pages?: Array<{ markdown?: string }>;
  message?: string;
};

const MAX_RECEIPT_OCR_BYTES = 10 * 1024 * 1024;

function toBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const value of new Uint8Array(bytes)) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function supportedReceiptType(file: File) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

function numberFromMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const normalized = match[1].replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function parseReceiptText(text: string): FuelOcrResult {
  const normalized = text.toLowerCase();
  const liters = numberFromMatch(normalized, [
    /(?:litros?|l)\s*[:=]?\s*(\d+(?:[,.]\d{1,3})?)/i,
    /(\d+(?:[,.]\d{1,3})?)\s*l(?:itros?)?\b/i,
  ]);
  const total = numberFromMatch(normalized, [
    /(?:total|valor)\s*[:=]?\s*r?\$?\s*(\d+(?:[,.]\d{2})?)/i,
    /r\$\s*(\d+(?:[,.]\d{2})?)/i,
  ]);
  const price = numberFromMatch(normalized, [
    /(?:pre[cç]o|unit[aá]rio|litro)\s*[:=]?\s*r?\$?\s*(\d+(?:[,.]\d{2,3})?)/i,
  ]);
  const dateMatch = normalized.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch?.[1]?.includes("/")
    ? dateMatch[1].split("/").reverse().join("-")
    : (dateMatch?.[1] ?? null);
  return {
    liters,
    total_price: total,
    price_per_liter:
      price ??
      (liters && total ? Math.round((total / liters) * 1000) / 1000 : null),
    date,
  };
}

export async function parseReceiptFile(
  file: File,
  { apiKey, fetch: fetchImpl = globalThis.fetch }: ReceiptOcrOptions = {},
): Promise<FuelOcrResult> {
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
  const document =
    file.type === "application/pdf"
      ? { type: "document_url", document_url: dataUrl }
      : { type: "image_url", image_url: dataUrl };
  const response = await fetchImpl("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      confidence_scores_granularity: "page",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OCR request failed (${response.status}): ${message}`);
  }

  const result = (await response.json()) as MistralOcrResponse;
  const text = (result.pages ?? [])
    .map((page) => page.markdown ?? "")
    .filter(Boolean)
    .join("\n");
  if (!text) {
    throw new Error("OCR did not return readable receipt text.");
  }
  return parseReceiptText(text);
}

export type FuelCsvPreviewRow = {
  row: number;
  data: {
    date: string;
    odometer_km: number;
    liters: number;
    total_price_cents: number;
    price_per_liter_millicents: number;
    fuel_type: string;
    tank_full: boolean;
    station_name: string;
    notes: string;
  };
  errors: string[];
};

export function parseFuelCsv(text: string): FuelCsvPreviewRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header =
    lines
      .shift()
      ?.split(",")
      .map((item) => item.trim()) ?? [];
  return lines.map((line, index) => {
    const values = line.split(",").map((item) => item.trim());
    const raw = Object.fromEntries(
      header.map((key, col) => [key, values[col] ?? ""]),
    );
    const liters = Number(String(raw.liters ?? "").replace(",", "."));
    const total = Number(
      String(raw.total_price ?? raw.total ?? "").replace(",", "."),
    );
    const price =
      Number(String(raw.price_per_liter ?? "").replace(",", ".")) ||
      (liters > 0 && total > 0 ? total / liters : 0);
    const data = {
      date: String(raw.date ?? ""),
      odometer_km: Number(raw.odometer_km ?? raw.odometer ?? 0),
      liters,
      total_price_cents: Math.round(total * 100),
      price_per_liter_millicents: Math.round(price * 100000),
      fuel_type: String(raw.fuel_type ?? "gasoline"),
      tank_full: ["1", "true", "sim", "yes"].includes(
        String(raw.tank_full ?? "").toLowerCase(),
      ),
      station_name: String(raw.station_name ?? raw.station ?? ""),
      notes: String(raw.notes ?? ""),
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

export function averageConsumption(records: FuelRecord[]) {
  const ordered = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometer_km - b.odometer_km,
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
  return Math.round((distance / liters) * 10) / 10;
}

export function costPerKm(records: FuelRecord[]) {
  const ordered = [...records].sort((a, b) => a.odometer_km - b.odometer_km);
  if (ordered.length < 2) return null;
  const distance =
    ordered[ordered.length - 1].odometer_km - ordered[0].odometer_km;
  const total = ordered.reduce(
    (sum, record) => sum + Number(record.total_price_cents || 0),
    0,
  );
  if (distance <= 0) return null;
  return Math.round((total / 100 / distance) * 1000) / 1000;
}
