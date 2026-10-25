import { describe, expect, it } from "vitest";
import {
  adminActionMessage,
  adminMessages,
  adminText,
  adminValue,
} from "$lib/i18n/admin";

describe("staff console translation", () => {
  it("keeps both admin catalogs complete", () => {
    expect(Object.keys(adminMessages("en")).sort()).toEqual(
      Object.keys(adminMessages("pt-BR")).sort(),
    );
    expect(adminMessages("en").consoleTitle).toBe("Operations console");
    expect(
      adminText("en", "runSummary", {
        emailed: 1,
        pushed: 2,
        deleted: 3,
        attempted: 4,
      }),
    ).toBe("Reminders: 1 emailed, 2 pushed; R2 deletions: 3/4 completed.");
  });

  it("translates protocol labels without changing their persisted identifiers", () => {
    expect(adminValue("en", "status", "fulfilled")).toBe("Fulfilled");
    expect(adminValue("pt-BR", "request", "deletion")).toBe("Exclusão");
    expect(adminValue("en", "failure", "email_delivery_failed")).toBe(
      "Email delivery failed (email_delivery_failed)",
    );
    for (const value of ["new-provider-status", "constructor", "__proto__"]) {
      expect(adminValue("en", "status", value)).toBe(value);
    }
  });

  it("translates the operation message and retains private diagnostic/source text", () => {
    const original =
      "A cobrança foi encerrada, mas a exclusão local falhou. A solicitação continua aberta e pode ser tentada novamente.";
    const diagnostic =
      "provider_reference=original-123; detalhe original da origem";
    const storedNote = `${original} ${diagnostic}`;
    expect(adminActionMessage("en", storedNote)).toBe(
      `Billing ended, but local deletion failed. The request remains open and can be retried. ${diagnostic}`,
    );
    expect(adminActionMessage("pt-BR", storedNote)).toBe(storedNote);
    expect(storedNote).toBe(`${original} ${diagnostic}`);
    expect(adminActionMessage("en", diagnostic)).toBe(diagnostic);
  });

  it("localizes staff-only and exact form errors at the presentation boundary", () => {
    expect(adminActionMessage("pt-BR", "Staff only.")).toBe(
      "Acesso restrito à equipe.",
    );
    expect(adminActionMessage("en", "Solicitação já processada.")).toBe(
      "Request already processed.",
    );
    expect(adminActionMessage("en", "Ano inicial inválido.")).toBe(
      "Invalid first model year.",
    );
  });
});
