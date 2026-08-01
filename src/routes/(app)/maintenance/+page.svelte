<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  type MarketplaceOffer = {
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    permalink: string;
    condition: "new" | "used" | "unknown";
  };
  type MarketplaceState = {
    query: string;
    offers: MarketplaceOffer[];
    mode?: "external-search" | "api";
    error?: string;
    fallbackUrl?: string;
  };
  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasRecords = data.rows.length > 0;
  $: marketplaceState = form?.marketplace as MarketplaceState | undefined;
  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.maintenance"),
    title: $t("maintenance.pageTitle"),
    subtitle: $t("maintenance.pageSubtitle"),
  };
  let pendingAction = "";
  let confirmDialog: ConfirmDialog;
  let marketplaceQuery = "";

  function seedMarketplaceQuery(value: string) {
    marketplaceQuery = value.trim().slice(0, 120);
    if (typeof document !== "undefined") {
      document.getElementById("marketplace-query")?.focus();
    }
  }

  function conditionLabel(condition: MarketplaceOffer["condition"]) {
    if (condition === "new") return $t("maintenance.marketplaceConditionNew");
    if (condition === "used") return $t("maintenance.marketplaceConditionUsed");
    return $t("maintenance.marketplaceConditionUnknown");
  }

  function marketplaceErrorLabel(code: string) {
    if (code === "credentials-required")
      return $t("maintenance.marketplaceCredentialHint");
    if (code === "invalid-query")
      return $t("maintenance.marketplaceInvalidQuery");
    if (code === "rate-limited")
      return $t("maintenance.marketplaceRateLimited");
    if (code === "timeout") return $t("maintenance.marketplaceTimeout");
    if (code === "malformed-response")
      return $t("maintenance.marketplaceMalformed");
    return $t("maintenance.marketplaceError");
  }

  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update }) => {
        try {
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }

  function enhanceDelete(action: string): SubmitFunction {
    return async ({ cancel }) => {
      const confirmed = await confirmDialog.ask(
        $t("maintenance.confirmDelete"),
      );
      if (!confirmed) {
        cancel();
        return;
      }

      pendingAction = action;
      return async ({ update }) => {
        try {
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }
</script>

<svelte:head
  ><title>{$t("maintenance.pageTitle")} · Moto Track</title></svelte:head
>
{#if !hasMotorcycles}
  <div
    class="border-[var(--accent)]/30 mb-6 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    role="status"
    aria-live="polite"
  >
    <span class="text-[var(--accent)]"
      >{$t("maintenance.noMotorcyclesHint")}</span
    >
    <a class="button-secondary min-h-11 shrink-0" href="/garage"
      >{$t("maintenance.goToGarage")}</a
    >
  </div>
{/if}
{#if form?.message || data.errorMessage}
  <div
    class="border-[var(--accent)]/30 mb-6 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    role="alert"
    aria-live="assertive"
  >
    <span class="text-[var(--accent)]"
      >{form?.message || data.errorMessage}</span
    >
    <a class="button-secondary min-h-11 shrink-0" href="/maintenance"
      >{$t("common.retry")}</a
    >
  </div>
{/if}
{#if form?.ok}
  <p
    class="border-[var(--success)]/30 bg-[var(--success)]/10 mb-6 rounded border p-3 text-sm text-[var(--success)]"
    role="status"
    aria-live="polite"
  >
    {$t("common.actionSuccess")}
  </p>
{/if}
<FeaturePage
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage=""
/>
<ConfirmDialog
  bind:this={confirmDialog}
  confirmLabel={$t("common.delete")}
  destructive
/>
<section class="mt-6 grid gap-6">
  <div class="grid gap-4 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePart"
      use:enhance={enhanceAction("part")}
      aria-busy={pendingAction === "part"}
    >
      <h2 class="font-bold">{$t("maintenance.partsFormTitle")}</h2>
      <input
        class="field"
        name="name"
        aria-label={$t("maintenance.partName")}
        placeholder={$t("maintenance.partName")}
        required
      /><input
        class="field"
        name="manufacturer"
        aria-label={$t("maintenance.manufacturer")}
        placeholder={$t("maintenance.manufacturer")}
      /><input
        class="field"
        name="price"
        type="number"
        step=".01"
        aria-label={$t("maintenance.price")}
        placeholder={$t("maintenance.price")}
      /><label class="grid gap-1 text-sm"
        >{$t("maintenance.stockQuantity")}<input
          class="field"
          name="stock_quantity"
          type="number"
          value="0"
          min="0"
        /></label
      ><label class="flex min-h-11 items-center gap-2"
        ><input name="track_stock" type="checkbox" value="true" />
        {$t("maintenance.trackStock")}</label
      ><button
        class="button-secondary min-h-11"
        disabled={pendingAction === "part"}
        type="submit">{$t("maintenance.savePart")}</button
      >
    </form>
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePlan"
      use:enhance={enhanceAction("plan")}
      aria-busy={pendingAction === "plan"}
    >
      <h2 class="font-bold">{$t("maintenance.planFormTitle")}</h2>
      <select
        class="field"
        name="motorcycle_id"
        aria-label={$t("maintenance.bikeFallback")}
        disabled={!hasMotorcycles}
        required
        ><option value=""
          >{hasMotorcycles
            ? $t("common.select")
            : $t("maintenance.noMotorcyclesSelect")}</option
        >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
          >{/each}</select
      ><input
        class="field"
        name="maintenance_type"
        aria-label={$t("maintenance.maintenanceType")}
        placeholder={$t("maintenance.maintenanceType")}
        required
      /><input
        class="field"
        name="interval_km"
        type="number"
        aria-label={$t("maintenance.intervalKm")}
        placeholder={$t("maintenance.intervalKm")}
      /><input
        class="field"
        name="interval_days"
        type="number"
        aria-label={$t("maintenance.intervalDays")}
        placeholder={$t("maintenance.intervalDays")}
      /><button
        class="button-secondary min-h-11"
        disabled={!hasMotorcycles || pendingAction === "plan"}
        type="submit">{$t("maintenance.savePlan")}</button
      >
      {#if !hasMotorcycles}<p class="text-xs text-[var(--muted)]">
          {$t("maintenance.noMotorcyclesHint")}
        </p>{/if}
    </form>
  </div>

  <section class="panel grid gap-3 p-4" aria-labelledby="marketplace-heading">
    <div class="grid gap-1">
      <h2 id="marketplace-heading" class="font-bold">
        {$t("maintenance.marketplaceHeading")}
      </h2>
      <p class="text-sm text-[var(--muted)]">
        {$t("maintenance.marketplaceHint")}
      </p>
    </div>
    <form
      class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      method="POST"
      action="?/searchMarketplace"
      use:enhance={enhanceAction("marketplace")}
      aria-busy={pendingAction === "marketplace"}
    >
      <label class="grid gap-1 text-sm" for="marketplace-query"
        >{$t("maintenance.marketplaceQuery")}
        <input
          id="marketplace-query"
          class="field"
          name="query"
          bind:value={marketplaceQuery}
          minlength="3"
          maxlength="120"
          autocomplete="off"
          required
        />
      </label>
      <button
        class="button-secondary min-h-11"
        disabled={pendingAction === "marketplace" ||
          marketplaceQuery.trim().length < 3}
        type="submit"
      >
        {$t("maintenance.marketplaceSearch")}
      </button>
    </form>
    {#if pendingAction === "marketplace"}
      <p class="text-sm text-[var(--muted)]" role="status" aria-live="polite">
        {$t("maintenance.marketplaceLoading")}
      </p>
    {:else if marketplaceState}
      {#if marketplaceState.mode === "external-search" && marketplaceState.fallbackUrl}
        <p class="text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {$t("maintenance.marketplaceExternalReady")}
        </p>
        <a
          class="button-primary min-h-11 justify-self-start"
          href={marketplaceState.fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {$t("maintenance.marketplaceOpenSearch")} ↗
        </a>
      {:else if marketplaceState.error}
        <p
          class="border-[var(--accent)]/30 rounded border bg-[var(--accent-soft)] p-3 text-sm"
          role={marketplaceState.error === "credentials-required"
            ? "status"
            : "alert"}
          aria-live="polite"
        >
          {marketplaceErrorLabel(marketplaceState.error)}
        </p>
      {:else if marketplaceState.offers.length === 0}
        <p class="text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {$t("maintenance.marketplaceNoResults")}
        </p>
      {:else}
        <p class="text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {$t("maintenance.marketplaceResultCount", {
            count: marketplaceState.offers.length,
          })}
        </p>
        <ul
          class="grid gap-3 sm:grid-cols-2"
          aria-label={$t("maintenance.marketplaceHeading")}
        >
          {#each marketplaceState.offers as offer (offer.id)}
            <li class="rounded border border-[var(--line)] p-3">
              <h3 class="break-words font-semibold">{offer.title}</h3>
              <p class="mt-1 text-xs text-[var(--muted)]">
                {$t("maintenance.marketplaceOfferId")}: {offer.id}
              </p>
              <dl class="mt-2 grid gap-1 text-sm">
                <div class="flex justify-between gap-3">
                  <dt class="text-[var(--muted)]">
                    {$t("maintenance.marketplacePrice")}
                  </dt>
                  <dd class="font-semibold">
                    {formatMoney($locale, offer.priceCents, offer.currency)}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-[var(--muted)]">
                    {$t("maintenance.marketplaceCondition")}
                  </dt>
                  <dd>{conditionLabel(offer.condition)}</dd>
                </div>
              </dl>
              <a
                class="mt-3 inline-block font-semibold text-brand underline-offset-4 hover:underline"
                href={offer.permalink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {$t("maintenance.marketplaceOpenOffer")} ↗
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      {#if marketplaceState.mode !== "external-search" && marketplaceState.fallbackUrl}
        <a
          class="button-secondary min-h-11 justify-self-start"
          href={marketplaceState.fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {$t("maintenance.marketplaceOpenSearch")} ↗
        </a>
      {/if}
    {/if}
  </section>

  <div class="grid gap-2">
    <h2 class="display text-2xl">{$t("maintenance.partsHeading")}</h2>
    {#each data.parts as part}
      <article
        class="panel flex min-w-0 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start"
      >
        <span class="min-w-0 break-words"
          >{part.name}
          {part.manufacturer ? `· ${part.manufacturer}` : ""} · {brl(
            Number(part.price_cents ?? 0),
          )}
          {part.track_stock
            ? `· ${$t("maintenance.stockSuffix")} ${part.stock_quantity}`
            : ""}</span
        >
        <button
          class="button-secondary min-h-11 shrink-0"
          type="button"
          on:click={() => seedMarketplaceQuery(String(part.name ?? ""))}
        >
          {$t("maintenance.marketplaceSeedPart")}
        </button>
        <form
          method="POST"
          action="?/deletePart"
          use:enhance={enhanceDelete(`delete-part:${part.id}`)}
          aria-busy={pendingAction === `delete-part:${part.id}`}
        >
          <input type="hidden" name="id" value={part.id} /><button
            class="button-danger min-h-11"
            disabled={pendingAction === `delete-part:${part.id}`}
            type="submit">{$t("common.delete")}</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">{$t("maintenance.noParts")}</p>
    {/each}
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">{$t("maintenance.plansHeading")}</h2>
    {#each data.plans as plan}
      <article
        class="panel flex min-w-0 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start"
      >
        <span class="min-w-0 flex-1 break-words"
          >{plan.motorcycles?.name ?? $t("maintenance.bikeFallback")} · {plan.maintenance_type}
          {plan.interval_km
            ? `· ${plan.interval_km} ${$t("maintenance.distanceUnit")}`
            : ""}
          {plan.interval_days
            ? `· ${plan.interval_days} ${$t("maintenance.daysUnit")}`
            : ""}
          {plan.next_due_km != null
            ? `· ${$t("maintenance.nextDueAt")} ${Number(plan.next_due_km).toLocaleString($locale)} ${$t("maintenance.distanceUnit")}`
            : ""}</span
        >
        <button
          class="button-secondary min-h-11 shrink-0"
          type="button"
          on:click={() =>
            seedMarketplaceQuery(
              `${String(plan.motorcycles?.name ?? "")} ${String(plan.maintenance_type ?? "")}`,
            )}
        >
          {$t("maintenance.marketplaceSeedPlan")}
        </button>
        <div class="text-sm text-[var(--muted)]">
          {#if plan.initial_history_status === "not_done"}
            <p class="text-[var(--accent)]">
              {$t("maintenance.historyNotDone")}
            </p>
          {:else if plan.initial_history_status === "unknown"}
            <p>{$t("maintenance.historyUnknown")}</p>
          {:else}
            <p>{$t("maintenance.historyConfirmed")}</p>
          {/if}
          {#if Number(plan.estimated_cost_cents ?? 0) > 0}
            <p>
              {$t("dashboard.estimate")}: {brl(
                Number(plan.estimated_cost_cents),
              )}
            </p>
          {/if}
          {#if plan.official_url}
            <a
              class="inline-block font-semibold text-brand underline-offset-4 hover:underline"
              href={String(plan.official_url)}
              target="_blank"
              rel="noreferrer"
              >{String(plan.document_version)} · {String(plan.page_reference)} ↗</a
            >
          {/if}
        </div>
        <form
          method="POST"
          action="?/deletePlan"
          use:enhance={enhanceDelete(`delete-plan:${plan.id}`)}
          aria-busy={pendingAction === `delete-plan:${plan.id}`}
        >
          <input type="hidden" name="id" value={plan.id} /><button
            class="button-danger min-h-11"
            disabled={pendingAction === `delete-plan:${plan.id}`}
            type="submit">{$t("common.delete")}</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">{$t("maintenance.noPlans")}</p>
    {/each}
  </div>

  <form
    class="panel grid gap-2 p-4"
    method="POST"
    action="?/uploadPhoto"
    enctype="multipart/form-data"
    use:enhance={enhanceAction("photo")}
    aria-busy={pendingAction === "photo"}
  >
    <h2 class="font-bold">{$t("maintenance.photoFormTitle")}</h2>
    <select
      class="field"
      name="maintenance_record_id"
      aria-label={$t("maintenance.recordSelect")}
      required
      disabled={!hasRecords}
    >
      <option value=""
        >{hasRecords
          ? $t("maintenance.recordSelect")
          : $t("maintenance.noRecordsSelect")}</option
      >
      {#each data.rows as row}
        <option value={String(row.id)}
          >{String(row.date ?? "")} · {String(
            row.maintenance_type ?? "",
          )}</option
        >
      {/each}
    </select>
    <input
      class="field"
      name="caption"
      aria-label={$t("maintenance.caption")}
      placeholder={$t("maintenance.caption")}
    />
    <input
      class="field"
      name="photo"
      aria-label={$t("maintenance.photoFormTitle")}
      type="file"
      accept="image/*"
      required
    />
    <button
      class="button-secondary min-h-11"
      disabled={!hasRecords || pendingAction === "photo"}
      type="submit">{$t("maintenance.sendPhoto")}</button
    >
    {#if !hasRecords}<p class="text-xs text-[var(--muted)]">
        {$t("maintenance.noRecordsHint")}
      </p>{/if}
  </form>

  <div class="grid gap-2">
    <h2 class="display text-2xl">{$t("maintenance.photosHeading")}</h2>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.photos as photo}
        <article class="panel overflow-hidden">
          <img
            class="aspect-video w-full object-cover"
            src={`/maintenance/photos/${photo.id}`}
            alt={String(photo.caption || $t("maintenance.photoAlt"))}
          />
          <div class="flex min-w-0 items-start justify-between gap-2 p-3">
            <div class="min-w-0 break-words">
              <p class="text-sm font-medium">
                {photo.maintenance_records
                  ? `${photo.maintenance_records.date} · ${photo.maintenance_records.maintenance_type}`
                  : $t("maintenance.recordFallback")}
              </p>
              {#if photo.caption}
                <p class="text-sm text-[var(--muted)]">{photo.caption}</p>
              {/if}
            </div>
            <form
              method="POST"
              action="?/deletePhoto"
              use:enhance={enhanceDelete(`delete-photo:${photo.id}`)}
              aria-busy={pendingAction === `delete-photo:${photo.id}`}
            >
              <input type="hidden" name="id" value={photo.id} /><button
                class="button-danger min-h-11 px-3 py-1 text-xs"
                disabled={pendingAction === `delete-photo:${photo.id}`}
                type="submit">{$t("common.delete")}</button
              >
            </form>
          </div>
        </article>
      {:else}
        <p class="text-sm text-[var(--muted)]">{$t("maintenance.noPhotos")}</p>
      {/each}
    </div>
  </div>
</section>
