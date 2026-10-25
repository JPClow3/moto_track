import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  error,
  fail,
  isActionFailure,
  redirect,
  type RequestEvent,
} from "@sveltejs/kit";
import { featureConfigs } from "$server/domain/features";
import { localizedActions } from "$server/domain/localized-actions";
import { signInEmail } from "$server/auth/session";
import { translate } from "$lib/i18n";
import {
  ACTION_ENGLISH_MESSAGES,
  actionMessage,
} from "$lib/i18n/action-messages";
import { FEATURE_ENGLISH_COPY, featureCopy } from "$lib/i18n/feature-copy";
import { PUBLIC_ENGLISH_COPY, publicCopy } from "$lib/i18n/public-copy";
import { appCopy } from "$lib/i18n/app-copy";

vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
afterEach(() => vi.unstubAllGlobals());

describe("translated product journeys", () => {
  it("covers every registered form label, option and help text in English", () => {
    for (const feature of Object.values(featureConfigs)) {
      for (const field of feature.fields) {
        for (const text of [
          field.label,
          field.help,
          ...(field.options ?? []).map((option) => option.label),
        ].filter((value): value is string => Boolean(value))) {
          expect(
            Object.hasOwn(FEATURE_ENGLISH_COPY, text),
            `${feature.slug}.${field.key}: ${text}`,
          ).toBe(true);
          expect(featureCopy("en", text)).toBe(FEATURE_ENGLISH_COPY[text]);
          expect(featureCopy("pt-BR", text)).toBe(text);
        }
      }
    }
  });

  it("covers all landing-plan and roadmap source entries rather than only headings", () => {
    const untranslated: string[] = [];
    for (const path of [
      "src/routes/+page.svelte",
      "src/routes/(public)/roadmap/+page.svelte",
    ]) {
      const source = readFileSync(resolve(path), "utf8");
      const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
      const ast = ts.createSourceFile(
        path,
        script,
        ts.ScriptTarget.Latest,
        true,
      );
      function walk(node: ts.Node) {
        if (
          ts.isPropertyAssignment(node) &&
          ["title", "body", "label", "heading", "blurb", "t"].includes(
            node.name.getText(ast),
          ) &&
          ts.isStringLiteralLike(node.initializer)
        ) {
          const value = node.initializer.text.replace(/\s+/g, " ").trim();
          if (value !== "API v1" && !Object.hasOwn(PUBLIC_ENGLISH_COPY, value))
            untranslated.push(value);
        }
        ts.forEachChild(node, walk);
      }
      walk(ast);
    }
    expect(untranslated).toEqual([]);
    expect(publicCopy("en", "Gestão de ")).toBe("Manage ");
    expect(publicCopy("en", " na garagem")).toBe(" in your garage");
    expect(appCopy("en", "Histórico de manutenção")).toBe(
      "Maintenance history",
    );
    expect(appCopy("en", "A rider's own unregistered text")).toBe(
      "A rider's own unregistered text",
    );
    for (const text of ["__proto__", "toString", "constructor"]) {
      expect(appCopy("en", text)).toBe(text);
      expect(publicCopy("en", text)).toBe(text);
      expect(featureCopy("en", text)).toBe(text);
      expect(actionMessage("en", text)).toBe(text);
    }
  });

  it("explains source-language content and preserves user content instead of translating it as interface copy", () => {
    expect(
      publicCopy(
        "en",
        "Artigos e comentários são exibidos no idioma original.",
      ),
    ).toContain("original language");
    expect(publicCopy("en", "Minha viagem particular")).toBe(
      "Minha viagem particular",
    );
    expect(translate("en", "auth.confirmPassword")).toBe("Confirm password");
    expect(translate("en", "garage.inServiceHelp")).toContain(
      "not a used purchase date",
    );
  });

  it("keeps dynamic Free-plan caps and actionable validation details", () => {
    expect(
      actionMessage(
        "en",
        "O plano Free permite até 3 uploads. Assine o Pro para liberar mais.",
      ),
    ).toBe("The Free plan allows up to 3 uploads. Subscribe to Pro for more.");
    expect(
      actionMessage(
        "en",
        "O plano Free permite até 3 lembretes ativos. Assine o Pro para liberar mais.",
      ),
    ).toContain("3 active reminders");
    expect(
      actionMessage(
        "en",
        "O plano Free permite até 3 turnos por mês. Assine o Pro para liberar mais.",
      ),
    ).toContain("3 shifts per month");
    expect(
      ACTION_ENGLISH_MESSAGES[
        "O último serviço não pode superar o odômetro atual da moto."
      ],
    ).toContain("cannot exceed");
  });

  it("covers Portuguese static validation messages in the localized rider actions", () => {
    const paths = [
      "src/routes/onboarding/+page.server.ts",
      "src/routes/(app)/dashboard/+page.server.ts",
      "src/routes/(app)/documents/+page.server.ts",
      "src/routes/(app)/expenses/+page.server.ts",
      "src/routes/(app)/fuel/+page.server.ts",
      "src/routes/(app)/garage/+page.server.ts",
      "src/routes/(app)/maintenance/+page.server.ts",
      "src/routes/(app)/reminders/+page.server.ts",
      "src/routes/(app)/reports/+page.server.ts",
      "src/routes/(app)/billing/conta/+page.server.ts",
      "src/routes/(public)/blog/[slug]/+page.server.ts",
      "src/lib/server/domain/reminder-lifecycle.ts",
      "src/lib/server/domain/maintenance-photos.ts",
      "src/lib/server/domain/crud.ts",
    ];
    const missing: string[] = [];
    for (const path of paths) {
      const source = readFileSync(resolve(path), "utf8");
      const ast = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      function walk(node: ts.Node) {
        if (ts.isStringLiteralLike(node) && /[ãõçáéíóúâêô]/i.test(node.text)) {
          const parent = node.parent;
          if (
            (ts.isPropertyAssignment(parent) &&
              parent.name.getText(ast) === "message") ||
            (ts.isNewExpression(parent) &&
              parent.expression.getText(ast) === "Error")
          ) {
            if (!Object.hasOwn(ACTION_ENGLISH_MESSAGES, node.text))
              missing.push(`${path}: ${node.text}`);
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(ast);
    }
    expect(missing).toEqual([]);
  });

  it.each(["pt-BR", "en"] as const)(
    "localizes provider authentication errors for %s without exposing provider prose",
    async (locale) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({
            code: "INVALID_EMAIL_OR_PASSWORD",
            message: "Unreviewed provider prose",
          }),
        }),
      );
      const result = await signInEmail(
        {
          locals: { locale },
          url: new URL("https://app.example/auth"),
          platform: {
            env: { PUBLIC_NEON_AUTH_URL: "https://auth.example/auth" },
          },
        } as never,
        "reader@example.com",
        "wrong-password",
      );
      expect(result).toEqual({
        ok: false,
        message: translate(locale, "auth.invalidCredentials"),
      });
    },
  );
});

describe("action locale isolation and protocol", () => {
  it("preserves failure status and fields across concurrent locales", async () => {
    const actions = localizedActions({
      save: async (_event: RequestEvent) => {
        void _event;
        return fail(403, {
          message: "O plano Free permite uma moto ativa.",
          recordId: "owned-id",
          values: { amount: "10" },
        });
      },
    });
    const [english, portuguese] = await Promise.all([
      actions.save({ locals: { locale: "en" } } as never),
      actions.save({ locals: { locale: "pt-BR" } } as never),
    ]);
    expect(isActionFailure(english)).toBe(true);
    expect(english).toMatchObject({
      status: 403,
      data: {
        message: "The Free plan allows one active motorcycle.",
        recordId: "owned-id",
        values: { amount: "10" },
      },
    });
    expect(portuguese).toMatchObject({
      status: 403,
      data: { message: "O plano Free permite uma moto ativa." },
    });
  });

  it("preserves redirects and translates thrown HTTP errors", async () => {
    const actions = localizedActions({
      move: async (_event: RequestEvent) => {
        void _event;
        return redirect(303, "/maintenance");
      },
      missing: async (_event: RequestEvent) => {
        void _event;
        return error(404, "Registro não encontrado.");
      },
    });
    await expect(
      actions.move({ locals: { locale: "en" } } as never),
    ).rejects.toMatchObject({ status: 303, location: "/maintenance" });
    await expect(
      actions.missing({ locals: { locale: "en" } } as never),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Record not found." },
    });
  });

  it("lets staff-specific translation preserve its own stored notes and failure payload", async () => {
    const translateMessage = vi.fn(
      (locale: string, value: string) => `${locale}: ${value}`,
    );
    const actions = localizedActions(
      {
        save: async (_event: RequestEvent) => {
          void _event;
          return fail(400, { message: "review", note: "stored-original" });
        },
      },
      translateMessage,
    );
    expect(
      await actions.save({ locals: { locale: "en" } } as never),
    ).toMatchObject({
      data: { message: "en: review", note: "stored-original" },
    });
  });
});
