/** Scheduled delivery has no browser cookie; use the account's saved preference. */
export function notificationCopy(
  reminder: {
    title: string;
    motorcycle_name: string | null;
    preferred_locale?: string | null;
    linked_plan_item_id?: string | null;
  },
  status: "overdue" | "due_soon",
) {
  const english = reminder.preferred_locale === "en";
  const title =
    english &&
    reminder.linked_plan_item_id &&
    reminder.title.startsWith("Plano: ")
      ? `Maintenance plan: ${reminder.title.slice(7)}`
      : reminder.title;
  const bike = reminder.motorcycle_name ?? (english ? "Motorcycle" : "Moto");
  const state = english
    ? status === "overdue"
      ? "Overdue"
      : "Due soon"
    : status === "overdue"
      ? "Vencido"
      : "Próximo do vencimento";
  return {
    subject: `Moto Track: ${title}`,
    body: `${bike}: ${title} (${state})`,
    text: `${bike}: ${title}\nStatus: ${state}`,
  };
}
