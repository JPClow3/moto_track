import { fail } from "@sveltejs/kit";
import { isStaffUser as staffState } from "$server/domain/staff";
import {
  deleteQueuedObjectsBestEffort,
  enqueueObjectDeletions,
  lockObjectOwner,
} from "$server/r2/files";
import { terminateStripeBillingForAccount } from "$server/domain/billing";
import { getWorkerOperationsSummary } from "$server/domain/worker-operations";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

export async function load({ locals }) {
  const isStaff = await staffState(locals);
  if (!isStaff) {
    return {
      isStaff,
      settings: null,
      articles: [],
      templates: [],
      requests: [],
      counts: { users: 0, articles: 0, events: 0, requests: 0 },
    };
  }

  const db = locals.db;
  const workerOperations = await getWorkerOperationsSummary(db);
  const [
    [{ count: users }],
    [{ count: articlesCount }],
    [{ count: events }],
    [{ count: requestsCount }],
    settingsRows,
    articles,
    manualSources,
    requests,
  ] = await Promise.all([
    db<Array<{ count: number }>>`select count(*)::int from profiles`,
    db<Array<{ count: number }>>`select count(*)::int from forum_articles`,
    db<Array<{ count: number }>>`select count(*)::int from billing_events`,
    db<
      Array<{ count: number }>
    >`select count(*)::int from account_data_requests`,
    db<Row[]>`select * from site_settings where id = 1`,
    db<Row[]>`
      select id, title, slug, is_published, published_at from forum_articles
      order by published_at desc
      limit 10
    `,
    // Catalogue QA: sources ordered oldest verification first, with the item
    // count that decides whether choosing the model yields any schedule at
    // all. Exact templates must have items; line models are allowed none.
    db<
      Array<{
        template_id: string;
        brand: string;
        model: string;
        year_from: number;
        year_to: number | null;
        variant: string;
        is_exact_schedule: boolean;
        document_version: string;
        last_verified_date: string;
        maintenance_count: number;
      }>
    >`
      select t.id as template_id, t.brand, t.model, t.year_from,
        t.year_to, t.variant, t.is_exact_schedule,
        ms.document_version, ms.last_verified_date::text,
        (select count(*)::int from motorcycle_template_maintenance_items mi
         where mi.template_id = t.id) as maintenance_count
      from motorcycle_manual_sources ms
      join motorcycle_templates t on t.id = ms.template_id
      order by ms.last_verified_date asc, t.brand, t.model
      limit 30
    `,
    db<Row[]>`
      select * from account_data_requests
      order by created_at desc
      limit 20
    `,
  ]);

  return {
    isStaff,
    settings: settingsRows[0] ?? null,
    articles,
    manualSources,
    requests,
    counts: {
      users,
      articles: articlesCount,
      events,
      requests: requestsCount,
    },
    workerOperations,
  };
}

export const actions = {
  fulfillDataRequest: async ({ request, locals, platform }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const id = String(form.get("id") ?? "");

    let existing:
      | {
          owner_id: string;
          request_type: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
        }
      | undefined;
    try {
      [existing] = await locals.db<
        Array<{
          owner_id: string;
          request_type: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
        }>
      >`
        select request.owner_id, request.request_type, request.status,
          coalesce(subscription.stripe_customer_id, '') as stripe_customer_id,
          coalesce(subscription.stripe_subscription_id, '') as stripe_subscription_id
        from account_data_requests request
        left join subscription_profiles subscription
          on subscription.owner_id = request.owner_id
        where request.id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!existing) return fail(404, { message: "Solicitação não encontrada." });
    if (existing.status !== "open") {
      return fail(400, { message: "Solicitação já processada." });
    }

    if (existing.request_type === "deletion") {
      // Stripe is external to the Neon cascade and must be terminated first.
      // A provider failure leaves the request open, preserving every local
      // billing reference so staff can retry without orphaning live charges.
      try {
        await terminateStripeBillingForAccount(
          {
            customerId: existing.stripe_customer_id,
            subscriptionId: existing.stripe_subscription_id,
          },
          platform,
        );
      } catch (err) {
        const retryNote =
          `Falha ao encerrar cobrança na Stripe; dados locais preservados. Tente novamente. ${messageFrom(err)}`.slice(
            0,
            1000,
          );
        await locals.db`
          update account_data_requests
          set notes = ${retryNote}
          where id = ${id}
            and owner_id = ${existing.owner_id}
            and status = 'open'
        `.catch(() => undefined);
        return fail(502, {
          message:
            "Não foi possível encerrar a cobrança na Stripe. Os dados locais foram preservados e a solicitação continua aberta para nova tentativa.",
        });
      }

      // Most owner-scoped tables cascade from neon_auth."user". Benchmark
      // contributions intentionally have no owner_id, so remove only samples
      // reached through this owner's guard rows before the auth cascade erases
      // that reversible association.
      let objectKeys: string[];
      try {
        objectKeys = await locals.db.begin(async (transaction) => {
          const db = transaction as unknown as typeof locals.db;
          await lockObjectOwner(db, existing.owner_id);
          const files = await db<Array<{ object_key: string }>>`
            select object_key from object_files
            where owner_id = ${existing.owner_id}
            for update
          `;
          await enqueueObjectDeletions(
            db,
            existing.owner_id,
            files.map((file) => file.object_key),
          );
          await db`
            delete from anonymous_model_benchmark_contributions contribution
            using model_benchmark_submission_guards guard
            where guard.owner_id = ${existing.owner_id}
              and guard.contribution_id = contribution.id
              and guard.model_key = contribution.model_key
          `;
          await db`
            insert into account_deletion_tombstones (
              owner_id,
              stripe_customer_id,
              stripe_subscription_id
            ) values (
              ${existing.owner_id},
              ${existing.stripe_customer_id},
              ${existing.stripe_subscription_id}
            )
            on conflict (owner_id) do update set
              stripe_customer_id = excluded.stripe_customer_id,
              stripe_subscription_id = excluded.stripe_subscription_id,
              deleted_at = now()
          `;
          const deleted = await db<Array<{ id: string }>>`
            delete from neon_auth."user" account
            where account.id = ${existing.owner_id}
              and exists (
                select 1 from account_data_requests request
                where request.id = ${id}
                  and request.owner_id = account.id
                and request.status = 'open'
              )
            returning account.id
          `;
          if (!deleted.length) {
            throw new Error(
              "A solicitação deixou de estar aberta antes da exclusão.",
            );
          }
          return files.map((file) => file.object_key);
        });
      } catch (err) {
        return fail(400, {
          message: `A cobrança foi encerrada, mas a exclusão local falhou. A solicitação continua aberta e pode ser tentada novamente. ${messageFrom(err)}`,
        });
      }
      await deleteQueuedObjectsBestEffort({
        db: locals.db,
        objectKeys,
        ownerId: existing.owner_id,
        platform,
      });
      return { ok: true };
    }

    try {
      await locals.db`
        update account_data_requests
        set status = 'fulfilled', fulfilled_at = ${new Date().toISOString()}
        where id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveSettings: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    try {
      await locals.db`
        insert into site_settings ${locals.db({
          id: 1,
          company_name: String(form.get("company_name") ?? "Moto Track"),
          support_email: String(form.get("support_email") ?? ""),
          support_phone: String(form.get("support_phone") ?? ""),
          support_whatsapp: String(form.get("support_whatsapp") ?? ""),
          address_city: String(form.get("address_city") ?? ""),
          address_state: String(form.get("address_state") ?? ""),
          dpo_name: String(form.get("dpo_name") ?? ""),
          dpo_email: String(form.get("dpo_email") ?? ""),
        })}
        on conflict (id) do update set
          company_name = excluded.company_name,
          support_email = excluded.support_email,
          support_phone = excluded.support_phone,
          support_whatsapp = excluded.support_whatsapp,
          address_city = excluded.address_city,
          address_state = excluded.address_state,
          dpo_name = excluded.dpo_name,
          dpo_email = excluded.dpo_email,
          updated_at = now()
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  createArticle: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const title = String(form.get("title") ?? "");
    const slug =
      String(form.get("slug") ?? "") ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    try {
      await locals.db`
        insert into forum_articles ${locals.db({
          title,
          slug,
          summary: String(form.get("summary") ?? ""),
          body: String(form.get("body") ?? ""),
          is_published: form.get("is_published") === "true",
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  createTemplate: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const brand = String(form.get("brand") ?? "").trim();
    const modelName = String(form.get("model") ?? "").trim();
    const variant = String(form.get("variant") ?? "").trim() || "Linha";
    if (!brand || !modelName)
      return fail(400, { message: "Informe marca e modelo." });
    const yearFrom = Number(form.get("year_from"));
    if (!Number.isInteger(yearFrom) || yearFrom <= 1900) {
      return fail(400, { message: "Ano inicial inválido." });
    }
    const yearToValue = String(form.get("year_to") ?? "").trim();
    let yearTo: number | null = null;
    if (yearToValue) {
      const parsedYearTo = Number(yearToValue);
      if (!Number.isInteger(parsedYearTo) || parsedYearTo < yearFrom) {
        return fail(400, { message: "Ano final inválido." });
      }
      yearTo = parsedYearTo;
    }
    try {
      // The picker resolves (model, year) → template, so every new template
      // must hang off a motorcycle_models row; without one the catalog
      // selection trigger and the visibility constraint both reject it.
      // Upsert keeps repeated saves idempotent without touching is_visible.
      const [model] = await locals.db<Array<{ id: string }>>`
        insert into motorcycle_models ${locals.db({
          brand,
          model_name: modelName,
          variant,
          display_name:
            variant === "Linha" ? modelName : `${modelName} ${variant}`,
          engine_cc: Number(form.get("engine_cc") ?? 1),
          country_code: String(form.get("country_code") ?? "BR"),
          is_visible: false,
        })}
        on conflict (brand, model_name, variant, country_code) do update set
          updated_at = now()
        returning id
      `;
      // New templates stay invisible until a manual source exists — the same
      // rule the seeded catalogue follows (no source, no picker entry).
      await locals.db`
        insert into motorcycle_templates ${locals.db({
          brand,
          model: modelName,
          year_from: yearFrom,
          year_to: yearTo,
          variant,
          engine_cc: Number(form.get("engine_cc") ?? 1),
          country_code: String(form.get("country_code") ?? "BR"),
          model_id: model.id,
          is_catalog_visible: false,
        })}`;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};
