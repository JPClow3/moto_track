type DatedAmount = {
  date?: string | null;
  installed_at?: string | null;
  due_date?: string | null;
  cost_cents?: number | null;
  amount_cents?: number | null;
};

type FuelRecord = {
  date: string;
  liters: number | null;
  total_price_cents: number | null;
};

const sum = (values: Array<number | null | undefined>) =>
  values.reduce<number>((total, value) => total + Number(value ?? 0), 0);

function monthFrom(record: {
  date?: string | null;
  installed_at?: string | null;
  due_date?: string | null;
}) {
  const date = record.date ?? record.installed_at ?? record.due_date;
  return typeof date === "string" ? date.slice(0, 7) : "";
}

export function summarizeReportMetrics({
  fuel,
  maintenance,
  tires,
  fees,
}: {
  fuel: FuelRecord[];
  maintenance: DatedAmount[];
  tires: DatedAmount[];
  fees: DatedAmount[];
}) {
  const distribution = [
    {
      label: "Abastecimento",
      amountCents: sum(fuel.map((r) => r.total_price_cents)),
    },
    {
      label: "Manutenção",
      amountCents: sum(maintenance.map((r) => r.cost_cents)),
    },
    { label: "Pneus", amountCents: sum(tires.map((r) => r.cost_cents)) },
    {
      label: "Taxas e seguro",
      amountCents: sum(fees.map((r) => r.amount_cents)),
    },
  ];
  const monthly = new Map<
    string,
    { fuelLiters: number; spendingCents: number }
  >();
  const add = (month: string, fuelLiters: number, spendingCents: number) => {
    if (!month) return;
    const current = monthly.get(month) ?? { fuelLiters: 0, spendingCents: 0 };
    current.fuelLiters += fuelLiters;
    current.spendingCents += spendingCents;
    monthly.set(month, current);
  };
  for (const row of fuel)
    add(
      monthFrom(row),
      Number(row.liters ?? 0),
      Number(row.total_price_cents ?? 0),
    );
  for (const row of maintenance)
    add(monthFrom(row), 0, Number(row.cost_cents ?? 0));
  for (const row of tires) add(monthFrom(row), 0, Number(row.cost_cents ?? 0));
  for (const row of fees) add(monthFrom(row), 0, Number(row.amount_cents ?? 0));

  return {
    distribution,
    months: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({ month, ...values })),
  };
}
