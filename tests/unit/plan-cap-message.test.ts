import { describe, expect, it } from "vitest";
import {
  actionMessage,
  planCapMessage,
} from "../../src/lib/i18n/action-messages";

describe("Free-plan trigger messages", () => {
  it("answers a raced write with the guard's own wording", () => {
    expect(planCapMessage("Free plan allows at most 3 active reminders")).toBe(
      "O plano Free permite até 3 lembretes ativos. Assine o Pro para liberar mais.",
    );
    expect(planCapMessage("Free plan allows at most 1 active motorcycle")).toBe(
      "O plano Free permite uma moto ativa.",
    );
    expect(planCapMessage("duplicate key value")).toBe("duplicate key value");
  });

  it("localizes the trigger text in both released locales", () => {
    const raw = "Free plan allows at most 3 work sessions per month";
    expect(actionMessage("pt-BR", raw)).toBe(
      "O plano Free permite até 3 turnos por mês. Assine o Pro para liberar mais.",
    );
    expect(actionMessage("en", raw)).toBe(
      "The Free plan allows up to 3 shifts per month. Subscribe to Pro for more.",
    );
  });
});
