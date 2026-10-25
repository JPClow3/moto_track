import { describe, expect, it } from "vitest";
import { notificationCopy } from "$server/domain/notification-copy";

describe("scheduled reminder language", () => {
  it("uses saved account language and translates generated plan prefixes", () => {
    expect(
      notificationCopy(
        {
          title: "Plano: Óleo",
          motorcycle_name: "Minha moto",
          preferred_locale: "en",
          linked_plan_item_id: "plan",
        },
        "overdue",
      ),
    ).toEqual({
      subject: "Moto Track: Maintenance plan: Óleo",
      body: "Minha moto: Maintenance plan: Óleo (Overdue)",
      text: "Minha moto: Maintenance plan: Óleo\nStatus: Overdue",
    });
  });
  it("preserves user titles and defaults existing accounts to Portuguese", () => {
    expect(
      notificationCopy(
        {
          title: "Plano: minha viagem",
          motorcycle_name: null,
          preferred_locale: "en",
        },
        "due_soon",
      ).body,
    ).toBe("Motorcycle: Plano: minha viagem (Due soon)");
    expect(
      notificationCopy(
        { title: "Conferir pneus", motorcycle_name: null },
        "due_soon",
      ).body,
    ).toBe("Moto: Conferir pneus (Próximo do vencimento)");
  });
});
