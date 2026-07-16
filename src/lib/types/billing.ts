export type PlanPrice = {
  amountCents: number;
  currency: string;
  interval: "month" | "year";
};
// This deliberately carries no pre-formatted string. It used to hold one built
// with a hardcoded pt-BR formatter, which an English reader then saw verbatim —
// and because the pricing lookup is cached process-wide, a formatted string
// here can never be right for more than one reader. Callers format at render
// with formatMoney($locale, amountCents, currency).

export type ProPricing = {
  monthly: PlanPrice | null;
  yearly: PlanPrice | null;
};
