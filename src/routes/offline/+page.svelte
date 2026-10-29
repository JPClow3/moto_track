<script lang="ts">
  import { calendarDay } from "$lib/utils/calendar-day";
  import { onMount } from "svelte";
  import { locale, t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import {
    discardOfflineFuelSubmission,
    offlineDraftHasMissingAttachment,
    offlineDraftScope,
    offlineFuelExport,
    readOfflineFuelSubmissions,
    requestOfflineFuelSync,
    reviewOfflineFuelSubmission,
    type OfflineFuelSubmission,
    type OfflineFuelStatus,
  } from "$lib/utils/offline-fuel";

  export let data;

  let online = false;
  let drafts: OfflineFuelSubmission[] = [];
  let feedback = "";
  let failed = false;
  let busy = false;
  const DECIMAL_PATTERN = "[0-9]+([.,][0-9]{3})*([.,][0-9]+)?";
  const statusKeys: Record<OfflineFuelStatus, MessageKey> = {
    authentication: "offline.statusAuthentication",
    conflict: "offline.statusConflict",
    network: "offline.statusNetwork",
    invalid: "offline.statusInvalid",
    "unknown-owner": "offline.unknownHelp",
    "other-owner": "offline.otherHelp",
    "file-missing": "offline.missingAttachment",
  };

  async function refresh() {
    try {
      drafts = await readOfflineFuelSubmissions();
    } catch {
      failed = true;
      feedback = $t("offline.draftsUnavailable");
    }
  }

  function download(entries: OfflineFuelSubmission[]) {
    const url = URL.createObjectURL(
      new Blob([offlineFuelExport(entries)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `moto-track-local-drafts-${calendarDay()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function discard(id: string) {
    if (!window.confirm($t("offline.discardConfirm"))) return;
    try {
      await discardOfflineFuelSubmission(id);
      await refresh();
    } catch {
      failed = true;
      feedback = $t("offline.draftsUnavailable");
    }
  }

  async function review(event: SubmitEvent, draft: OfflineFuelSubmission) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    busy = true;
    failed = false;
    feedback = "";
    try {
      await reviewOfflineFuelSubmission(
        draft.id,
        form,
        data.user?.id,
        form.get("review_consent") === "true",
        $locale,
      );
      feedback = $t("offline.reviewed");
      await refresh();
      if (online) await requestOfflineFuelSync(true);
    } catch (cause) {
      failed = true;
      feedback =
        cause instanceof Error ? cause.message : $t("offline.queueFailed");
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    const update = () => (online = navigator.onLine);
    update();
    void refresh();
    const syncStatus = (event: MessageEvent) => {
      if (event.data?.type !== "FUEL_SYNC_STATUS") return;
      failed = event.data.status !== "sent";
      feedback =
        event.data.status === "sent"
          ? $t("offline.sent")
          : $t(
              Object.hasOwn(statusKeys, event.data.status)
                ? statusKeys[event.data.status as OfflineFuelStatus]
                : "offline.statusInvalid",
            );
      void refresh();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", refresh);
    navigator.serviceWorker?.addEventListener("message", syncStatus);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", refresh);
      navigator.serviceWorker?.removeEventListener("message", syncStatus);
    };
  });
</script>

<svelte:head><title>{$t("offline.title")} - Moto Track</title></svelte:head>

<section class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <h1 class="display text-4xl">{$t("offline.title")}</h1>
  <p class="mt-4 text-[var(--muted)]" role="status" aria-live="polite">
    {$t("offline.body")}
  </p>
  <p class="mt-3 text-sm text-[var(--muted)]">
    {$t("offline.queuedFuel")}
  </p>
  <div class="mt-8 flex flex-wrap gap-3">
    <button
      class="button-primary"
      type="button"
      onclick={() => location.reload()}
    >
      {$t(online ? "offline.retryNow" : "common.retry")}
    </button>
    <a class="button-secondary" href="/">{$t("offline.home")}</a>
  </div>

  <section
    class="panel mt-10 space-y-5 p-5"
    aria-labelledby="local-drafts-title"
  >
    <h2 id="local-drafts-title" class="display text-2xl">
      {$t("offline.draftsTitle")}
    </h2>
    <p class="text-sm text-[var(--muted)]">{$t("offline.draftsHelp")}</p>
    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="button-secondary"
        onclick={() => void refresh()}>{$t("offline.refreshDrafts")}</button
      >
      <button
        type="button"
        class="button-secondary"
        disabled={!drafts.length}
        onclick={() => download(drafts)}>{$t("offline.exportAll")}</button
      >
      {#if !data.user && drafts.length}<a
          class="button-secondary"
          href="/auth?redirectTo=%2Foffline">{$t("common.signIn")}</a
        >{/if}
      {#if data.user}<button
          type="button"
          class="button-primary"
          disabled={!online ||
            !drafts.some(
              (draft) => offlineDraftScope(draft, data.user?.id) === "current",
            )}
          onclick={() =>
            void requestOfflineFuelSync(true).catch(() => {
              failed = true;
              feedback = $t("offline.statusNetwork");
            })}>{$t("offline.sync")}</button
        >{/if}
    </div>
    {#if feedback}<p
        role={failed ? "alert" : "status"}
        class={failed
          ? "rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
          : "rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm"}
      >
        {feedback}
      </p>{/if}
    {#if !drafts.length}<p class="text-sm text-[var(--muted)]">
        {$t("offline.noDrafts")}
      </p>{/if}
    {#each drafts as draft (draft.id)}
      {@const scope = offlineDraftScope(draft, data.user?.id)}
      <article
        class="rounded border border-[var(--line)] p-4"
        data-draft-id={draft.id}
      >
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-semibold">
            {draft.values?.date || $t("common.empty")}
          </h3>
          <StatusBadge
            tone={scope === "current"
              ? "info"
              : scope === "unknown"
                ? "due"
                : "neutral"}
          >
            {$t(
              scope === "current"
                ? "offline.currentDraft"
                : scope === "unknown"
                  ? "offline.unknownDraft"
                  : "offline.otherDraft",
            )}
          </StatusBadge>
        </div>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t(
            offlineDraftHasMissingAttachment(draft)
              ? "offline.missingAttachment"
              : draft.status && Object.hasOwn(statusKeys, draft.status)
                ? statusKeys[draft.status]
                : scope === "unknown"
                  ? "offline.unknownHelp"
                  : scope === "other"
                    ? "offline.otherHelp"
                    : "offline.pending",
          )}
        </p>
        {#if scope !== "other"}
          <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt class="text-[var(--muted)]">{$t("fuel.odometerLabel")}</dt>
            <dd class="numeric">{draft.values?.odometer_km || "–"} km</dd>
            <dt class="text-[var(--muted)]">{$t("fuel.litersLabel")}</dt>
            <dd class="numeric">{draft.values?.liters || "–"} L</dd>
            <dt class="text-[var(--muted)]">{$t("fuel.totalPriceLabel")}</dt>
            <dd class="numeric">{draft.values?.total_price || "–"} BRL</dd>
            <dt class="text-[var(--muted)]">{$t("fuel.stationNameLabel")}</dt>
            <dd class="break-words">{draft.values?.station_name || "–"}</dd>
          </dl>
        {/if}
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="button-secondary"
            onclick={() => download([draft])}
            >{$t("offline.exportDraft")}</button
          >
          <button
            type="button"
            class="button-danger"
            onclick={() => void discard(draft.id)}
            >{$t("offline.discard")}</button
          >
        </div>
        {#if scope === "unknown" && !offlineDraftHasMissingAttachment(draft)}
          {#if data.user}
            <details class="mt-4">
              <summary class="cursor-pointer font-medium"
                >{$t("offline.review")}</summary
              >
              <p class="my-3 text-sm font-medium">
                {$t("offline.reviewAccount", {
                  account: data.user.email || data.user.id,
                })}
              </p>
              <p class="mb-3 text-sm text-[var(--muted)]">
                {$t("offline.recoveredRelationships")}
              </p>
              <form
                class="grid gap-3 sm:grid-cols-2"
                onsubmit={(event) => void review(event, draft)}
              >
                <label class="field-group text-sm"
                  >{$t("fuel.motorcycleLabel")}<select
                    name="motorcycle_id"
                    class="field"
                    ><option value="">{$t("offline.noMotorcycle")}</option
                    >{#each data.motorcycles as motorcycle}<option
                        value={motorcycle.id}>{motorcycle.name}</option
                      >{/each}</select
                  ></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.dateLabel")}<input
                    name="date"
                    type="date"
                    class="field"
                    value={draft.values?.date || ""}
                    required
                  /></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.odometerLabel")} (km)<input
                    name="odometer_km"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    step="1"
                    class="field"
                    value={draft.values?.odometer_km || ""}
                    required
                  /></label
                >
                <!-- Decimal drafts keep the rider's own notation ("4,59");
                     the server parses a comma or a dot. -->
                <label class="field-group text-sm"
                  >{$t("fuel.litersLabel")}<input
                    name="liters"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    pattern={DECIMAL_PATTERN}
                    title={$t("fuelUx.decimalHint")}
                    placeholder={$t("fuelUx.litersPlaceholder")}
                    class="field"
                    value={draft.values?.liters || ""}
                    required
                  /></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.totalPriceLabel")} (BRL)<input
                    name="total_price"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    pattern={DECIMAL_PATTERN}
                    title={$t("fuelUx.decimalHint")}
                    placeholder={$t("fuelUx.moneyPlaceholder")}
                    class="field"
                    value={draft.values?.total_price || ""}
                    required
                  /></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.pricePerLiterLabel")}<input
                    name="price_per_liter"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    pattern={DECIMAL_PATTERN}
                    title={$t("fuelUx.decimalHint")}
                    placeholder={$t("fuelUx.pricePerLiterPlaceholder")}
                    class="field"
                    value={draft.values?.price_per_liter || ""}
                  /></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.stationNameLabel")}<input
                    name="station_name"
                    class="field"
                    value={draft.values?.station_name || ""}
                  /></label
                >
                <label class="field-group text-sm"
                  >{$t("fuel.fuelTypeLabel")}<select
                    name="fuel_type"
                    class="field"
                    value={draft.values?.fuel_type || "gasoline"}
                    ><option value="gasoline">{$t("fuel.typeGasoline")}</option
                    ><option value="ethanol">{$t("fuel.typeEthanol")}</option
                    ><option value="flex">{$t("fuel.typeFlex")}</option><option
                      value="diesel">{$t("fuel.typeDiesel")}</option
                    ><option value="gnv">{$t("fuel.typeGnv")}</option></select
                  ></label
                >
                <label class="field-group text-sm sm:col-span-2"
                  >{$t("fuel.notesLabel")}<textarea
                    name="notes"
                    class="field"
                    value={draft.values?.notes || ""}
                  ></textarea></label
                >
                <label class="flex items-center gap-2 sm:col-span-2"
                  ><input
                    type="checkbox"
                    name="tank_full"
                    value="true"
                    checked={draft.values?.tank_full === "true"}
                  />{$t("fuel.tankFullLabel")}</label
                >
                <label class="flex items-start gap-2 text-sm sm:col-span-2"
                  ><input
                    type="checkbox"
                    name="review_consent"
                    value="true"
                    required
                  />{$t("offline.reviewConsent")}</label
                >
                <button
                  type="submit"
                  class="button-primary sm:col-span-2"
                  disabled={busy}>{$t("offline.review")}</button
                >
              </form>
            </details>
          {:else}<a
              class="button-secondary mt-3"
              href="/auth?redirectTo=%2Foffline">{$t("common.signIn")}</a
            >{/if}
        {/if}
      </article>
    {/each}
  </section>
</section>
