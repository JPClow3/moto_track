export type PlanPrice = {
  amountCents: number;
  currency: string;
  /** Pre-formatted for pt-BR, e.g. "R$ 19,90". */
  formatted: string;
  interval: "month" | "year";
};

export type ProPricing = {
  monthly: PlanPrice | null;
  yearly: PlanPrice | null;
};
