import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportMessages, exportText } from "$lib/i18n/exports";
import {
  buildReminderCalendar,
  calendarResponse,
  loadReminderCalendar,
  type CalendarReminder,
} from "$server/domain/reminder-calendar";
import { summarizeReportMetrics } from "$server/domain/report-summary";
import { GET as calendarFeed } from "../../src/routes/calendar/[token]/+server";
import { GET as csvExport } from "../../src/routes/(app)/[feature]/export.csv/+server";

vi.mock("$server/domain/reminder-calendar", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("$server/domain/reminder-calendar")
  >()),
  loadReminderCalendar: vi.fn(),
}));

vi.mock("$server/domain/features", () => ({
  getFeature: (slug: string) => {
    if (slug !== "fuel") throw new Error("Unknown feature");
    return {
      slug,
      table: "fuel_records",
      listColumns: ["date", "station_name"],
      fields: [{ key: "date", kind: "date" }],
    };
  },
}));

const now = new Date("2026-10-23T12:00:00Z");
const reminder: CalendarReminder = {
  id: "a-b-c",
  title: "Trocar óleo; manual original",
  motorcycle_name: "Minha moto",
  motorcycle_id: "bike",
  current_odometer_km: 1500,
  trigger_type: "by_date",
  reference_date: "2026-10-20",
  reference_km: 1000,
  trigger_value_days: 7,
  trigger_value_km: 1000,
};

describe("localized export presentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps translations complete and interpolates an unchanged schema identifier", () => {
    expect(Object.keys(exportMessages("en")).sort()).toEqual(
      Object.keys(exportMessages("pt-BR")).sort(),
    );
    expect(
      exportText("en", "exportTableFailed", { table: "maintenance_records" }),
    ).toBe("Could not export maintenance_records.");
    expect(exportMessages("pt-BR").accountFilename).toBe(
      "moto-track-dados.json",
    );
    expect(exportMessages("en").accountFilename).toBe("moto-track-data.json");
  });

  it("translates calendar instructions while retaining source titles, dates and UIDs", () => {
    const pt = buildReminderCalendar([reminder], now, "pt-BR");
    const en = buildReminderCalendar([reminder], now, "en");
    expect(pt).toContain(
      "Confira o lembrete e registre a conclusão no Moto Track.",
    );
    expect(en).toContain(
      "Check the reminder and record its completion in Moto Track.",
    );
    for (const output of [pt, en]) {
      expect(output).toContain(
        "SUMMARY:Minha moto: Trocar óleo\\; manual original",
      );
      expect(output).toContain("UID:reminder-a-b-c@moto-track.net");
      expect(output).toContain("DTSTART;VALUE=DATE:20261027");
      for (const line of output.split("\r\n")) {
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      }
    }
    expect(
      calendarResponse(en, true, "en").headers.get("content-language"),
    ).toBe("en");
  });

  it("uses the chosen language for estimated mileage guidance", () => {
    const en = buildReminderCalendar(
      [{ ...reminder, trigger_type: "by_km", km_per_day: 50 }],
      now,
      "en",
    );
    expect(en).toContain(
      "Mileage estimate. Confirm the odometer in Moto Track.",
    );
    expect(en).not.toContain("Estimativa por quilometragem");
  });

  it("uses the stored owner locale for bearer feeds instead of the crawler locale", async () => {
    const db = vi.fn().mockResolvedValue([{ owner_id: "owner", locale: "en" }]);
    vi.mocked(loadReminderCalendar).mockResolvedValue(
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
    );
    const response = await calendarFeed({
      params: { token: `${"a".repeat(64)}.ics` },
      locals: { db, locale: "pt-BR" },
    } as never);
    expect(loadReminderCalendar).toHaveBeenCalledTimes(1);
    expect(loadReminderCalendar).toHaveBeenCalledWith(db, "owner", "en");
    expect(response.headers.get("content-language")).toBe("en");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["pt-BR", "en"] as const)(
    "preserves CSV schema and recorded text in %s",
    async (locale) => {
      const rows = [
        { date: "2026-10-23", station_name: "Posto São João, original" },
      ];
      const db = vi.fn((query: unknown) =>
        typeof query === "string" ? query : Promise.resolve(rows),
      );
      const response = await csvExport({
        params: { feature: "fuel" },
        locals: {
          db,
          locale,
          user: { id: "owner" },
        },
      } as never);
      expect(await response.text()).toBe(
        'date,station_name\n"2026-10-23","Posto São João, original"',
      );
      expect(response.headers.get("content-language")).toBe(locale);
    },
  );

  it("writes Date values as ISO and neutralizes spreadsheet formulas", async () => {
    const rows = [
      {
        date: new Date("2026-10-23T00:00:00.000Z"),
        created_at: new Date("2026-10-23T14:05:00.000Z"),
        station_name: '=HYPERLINK("https://evil.example")',
        odometer_km: -1,
      },
    ];
    const db = vi.fn((query: unknown) =>
      typeof query === "string" ? query : Promise.resolve(rows),
    );
    const response = await csvExport({
      params: { feature: "fuel" },
      locals: { db, locale: "pt-BR", user: { id: "owner" } },
    } as never);
    expect(await response.text()).toBe(
      'date,created_at,station_name,odometer_km\n"2026-10-23","2026-10-23T14:05:00.000Z","\'=HYPERLINK(""https://evil.example"")","-1"',
    );
  });

  it("returns a localized missing-export error before reading any data", async () => {
    const db = vi.fn();
    await expect(
      csvExport({
        params: { feature: "missing" },
        locals: {
          db,
          locale: "en",
          user: { id: "owner" },
        },
      } as never),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Export not found." },
    });
    expect(db).not.toHaveBeenCalled();
  });

  it("translates computed report labels without changing amounts or month keys", () => {
    const input = {
      fuel: [{ date: "2026-10-23", liters: 5, total_price_cents: 3000 }],
      maintenance: [{ date: "2026-10-22", cost_cents: 4000 }],
      tires: [],
      fees: [],
    };
    const pt = summarizeReportMetrics(input, "pt-BR");
    const en = summarizeReportMetrics(input, "en");
    expect(en.distribution.map(({ label }) => label)).toEqual([
      "Fuel",
      "Maintenance",
      "Tires",
      "Fees and insurance",
    ]);
    expect(en.distribution.map(({ amountCents }) => amountCents)).toEqual(
      pt.distribution.map(({ amountCents }) => amountCents),
    );
    expect(en.months).toEqual(pt.months);
  });
});
