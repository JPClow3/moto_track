<script lang="ts">
  import { enhance } from "$app/forms";
  import { afterNavigate, replaceState } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import Download from "lucide-svelte/icons/download";
  import BookOpen from "lucide-svelte/icons/book-open";
  import Gauge from "lucide-svelte/icons/gauge";
  import Edit from "lucide-svelte/icons/edit-2";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import { locale, t, format } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge, {
    type StatusTone,
  } from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { Motorcycle, Tire } from "$components/icons";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) =>
    Number(value).toLocaleString($locale ?? "pt-BR");

  /** Money fields are text inputs (inputmode="decimal"), so prefill them in
   *  the rider's own decimal separator; the server accepts both. */
  const decimalValue = (cents: unknown) => {
    if (cents === null || cents === undefined || cents === "") return "";
    const value = (Number(cents) / 100).toFixed(2);
    return $locale === "en" ? value : value.replace(".", ",");
  };

  type LifeEstimate = { projectedChangeKm: number; remainingKm: number } | null;
  type TireRow = Record<string, unknown> & {
    id: string;
    life_estimate?: LifeEstimate;
    estimated_change_date?: string | null;
    current_km?: number | null;
    motorcycle_name?: string | null;
    motorcycle_id?: string;
    position?: string;
    brand_model?: string;
    installed_at?: string;
    installed_odometer_km?: number | string | null;
    wear_percent?: number | string | null;
    wear_odometer_km?: number | null;
    wear_observed_at?: string | null;
    estimated_change_km?: number | string | null;
    cost_cents?: number | null;
    is_active?: boolean;
  };

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: activeTires = ((data.activeTires ?? []) as TireRow[]).filter((tire) =>
    onActiveBike(tire.motorcycle_id, selectedMotorcycleId, scopeToActive),
  );
  $: historyTires = ((data.rows ?? []) as TireRow[]).filter((tire) =>
    onActiveBike(tire.motorcycle_id, selectedMotorcycleId, scopeToActive),
  );
  $: pressures = (data.pressures ?? []).filter(
    (pressure: Record<string, unknown>) =>
      onActiveBike(pressure.motorcycle_id, selectedMotorcycleId, scopeToActive),
  );
  $: hasTireData = historyTires.length > 0;

  // The shell's bike switcher is the page's only bike context: with more
  // than one bike, tires and pressures follow the active bike.
  $: selectedMotorcycleId = String(
    data.activeMotorcycleId ?? data.motorcycles[0]?.id ?? "",
  );
  $: scopeToActive = data.motorcycles.length > 1;
  const onActiveBike = (
    motorcycleId: unknown,
    active: string,
    scoped: boolean,
  ) => !scoped || String(motorcycleId ?? "") === active;

  let formBusy = false;
  let errorMessage = "";
  let confirmDialog: ConfirmDialog;

  let pressureSheet: RecordSheet;
  let installSheet: RecordSheet;
  let editSheet: RecordSheet;
  let catalogSheet: RecordSheet;
  let editingTire: TireRow | null = null;

  // Quick-log deep link, mirroring /maintenance?new=1 and /fuel?new=1:
  // /tires?new=1 opens the install sheet, then drops the param so a reload or
  // back navigation does not reopen it.
  afterNavigate(({ to }) => {
    if (!to?.url || to.url.searchParams.get("new") !== "1") return;
    if (data.motorcycles.length > 0) installSheet?.open();
    const url = new URL(to.url);
    url.searchParams.delete("new");
    // The router only accepts shallow routing once hydration has settled.
    setTimeout(() => {
      try {
        replaceState(url, {});
      } catch {
        window.history.replaceState(window.history.state, "", url);
      }
    }, 0);
  });

  function openEditTire(tire: TireRow) {
    editingTire = tire;
    editSheet.open();
  }

  function positionLabel(position: unknown) {
    const value = String(position ?? "").toLowerCase();
    if (value === "dianteiro" || value === "front")
      return $t("tires.positionFront");
    if (value === "traseiro" || value === "rear")
      return $t("tires.positionRear");
    return String(position ?? "");
  }

  // Red only once a tire actually needs replacing; healthy wear is green.
  function wearTone(wearPercent: number): StatusTone {
    if (wearPercent >= 80) return "overdue";
    if (wearPercent >= 60) return "due";
    return "ok";
  }

  function wearToneColor(tone: StatusTone) {
    if (tone === "overdue") return "var(--accent)";
    if (tone === "due") return "var(--warning)";
    return "var(--success)";
  }

  function wearToneLabel(tone: StatusTone) {
    if (tone === "overdue") return $t("serviceUx.wearCritical");
    if (tone === "due") return $t("serviceUx.wearSoon");
    return $t("serviceUx.wearOk");
  }

  function tireSignal(label: string, tire: TireRow | undefined): Signal {
    if (!tire)
      return {
        label,
        value: $t("serviceUx.tireNotRecorded"),
      };
    const wear = Number(tire.wear_percent ?? 0);
    return {
      label: tire.brand_model ? `${label} · ${tire.brand_model}` : label,
      value: `${wear}%`,
      hint: tire.life_estimate
        ? `${$t("tires.wearLabel")} · ${$t("tires.remainingKm", {
            count: km(tire.life_estimate.remainingKm),
          })}`
        : $t("tires.wearLabel"),
    };
  }

  function successMessage(result: { data?: Record<string, unknown> }) {
    return result.data?.wearObservationSaved === true
      ? $t("tires.wearObservationSaved")
      : "";
  }

  function enhanceWithToast(message: () => string): SubmitFunction {
    return () => {
      formBusy = true;
      errorMessage = "";
      return async ({ result, update }) => {
        formBusy = false;
        if (result.type === "success") {
          showToast(successMessage(result) || message());
          pressureSheet?.close();
          installSheet?.close();
          editSheet?.close();
        } else if (result.type === "failure") {
          errorMessage = String(result.data?.message ?? $t("error.serverBody"));
        } else if (result.type === "error") {
          errorMessage = $t("error.serverBody");
        }
        await update();
      };
    };
  }

  // Delete lives in the edit sheet, so a successful delete closes it.
  const enhanceDeleteTire: SubmitFunction = async (input) => {
    const finish = await enhanceDelete(input);
    if (!finish) return;
    return async (output) => {
      await finish(output);
      if (output.result.type === "success") editSheet?.close();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        showToast($t("serviceUx.deleted"));
      } else if (result.type === "failure") {
        errorMessage = String(result.data?.message ?? $t("error.serverBody"));
      } else if (result.type === "error") {
        errorMessage = $t("error.serverBody");
      }
      await update();
    };
  };

  $: frontTire = activeTires.find(
    (t) =>
      String(t.position).toLowerCase().includes("diant") ||
      String(t.position).toLowerCase().includes("front"),
  );
  $: rearTire = activeTires.find(
    (t) =>
      String(t.position).toLowerCase().includes("tras") ||
      String(t.position).toLowerCase().includes("rear"),
  );

  $: signals = [
    tireSignal($t("tires.positionFront"), frontTire),
    tireSignal($t("tires.positionRear"), rearTire),
    {
      label: $t("tires.activeHeading"),
      value:
        activeTires.length === 1
          ? $t("serviceUx.tireActiveOne")
          : $t("serviceUx.tireActiveOther", { count: activeTires.length }),
      hint:
        historyTires.length === 1
          ? $t("serviceUx.tireInstallsOne")
          : $t("serviceUx.tireInstallsOther", { count: historyTires.length }),
    },
  ] as Signal[];

  const overflowItemClass =
    "focus-ring flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]";
</script>

<svelte:head><title>{$t("tires.pageTitle")} · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    title={$t("tires.pageTitle")}
    description={$t("tires.pageSubtitle")}
  >
    <svelte:fragment slot="actions">
      {#if hasMotorcycles}
        <PageAction
          label={$t("tires.installAction")}
          ariaLabel={$t("tires.installAction")}
          on:click={() => installSheet?.open()}
        />
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        {#if hasMotorcycles}
          <button
            type="button"
            class={overflowItemClass}
            on:click={() => pressureSheet?.open()}
          >
            <Gauge size={16} aria-hidden="true" />
            <span>{$t("authenticatedUx.logPressure")}</span>
          </button>
        {/if}
        <button
          type="button"
          class={overflowItemClass}
          on:click={() => catalogSheet?.open()}
        >
          <BookOpen size={16} aria-hidden="true" />
          <span>{$t("tires.catalogHeading")}</span>
        </button>
        <a class={overflowItemClass} href="/tires/export.csv">
          <Download size={16} aria-hidden="true" />
          <span>{$t("common.exportCsv")}</span>
        </a>
      </PageOverflowMenu>
    </svelte:fragment>
  </PageHeader>

  {#if data.errorMessage || form?.message || errorMessage}
    <div
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {errorMessage || form?.message || data.errorMessage}
    </div>
  {/if}

  <ConfirmDialog bind:this={confirmDialog} confirmLabel={$t("common.delete")} />

  {#if !hasMotorcycles}
    <EmptyState
      icon={Motorcycle}
      title={$t("serviceUx.noMotorcyclesTitle")}
      description={$t("tires.noMotorcyclesHint")}
    >
      {#snippet action()}
        <a class="button-primary min-h-11" href="/garage"
          >{$t("maintenance.goToGarage")}</a
        >
      {/snippet}
    </EmptyState>
  {:else if !hasTireData}
    <EmptyState
      icon={Tire}
      title={$t("serviceUx.tiresEmptyTitle")}
      description={$t("tires.activeEmptyHint")}
    >
      {#snippet action()}
        <button
          type="button"
          class="button-primary min-h-11"
          on:click={() => installSheet?.open()}
          disabled={formBusy}
        >
          {$t("tires.installAction")}
        </button>
      {/snippet}
    </EmptyState>
  {:else}
    {#if activeTires.length > 0}
      <SignalStrip {signals} />
    {/if}

    <!-- ACTIVE TIRES STATUS CARDS -->
    <section class="grid gap-3" aria-labelledby="tires-active-heading">
      <h2 id="tires-active-heading" class="display text-2xl">
        {$t("tires.activeHeading")}
      </h2>

      {#if activeTires.length === 0}
        <EmptyState
          compact
          icon={Tire}
          title={$t("serviceUx.noActiveTires")}
          description={$t("tires.activeEmptyHint")}
        />
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          {#each activeTires as tire (tire.id)}
            {@const wear = Number(tire.wear_percent ?? 0)}
            {@const tone = wearTone(wear)}
            {@const estimate = tire.life_estimate}
            <article class="panel grid gap-3 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <span
                    class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--panel-sunken)] text-[var(--muted)]"
                    aria-hidden="true"
                  >
                    <Tire size={20} />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm text-[var(--muted)]">
                      {positionLabel(tire.position)}
                      {#if tire.motorcycle_name}
                        · {String(tire.motorcycle_name)}
                      {/if}
                    </p>
                    <h3 class="display truncate text-xl">
                      {String(tire.brand_model ?? "")}
                    </h3>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="button-secondary min-h-11 px-3 py-1"
                    on:click={() => openEditTire(tire)}
                    aria-label={`${$t("common.edit")} ${String(tire.brand_model ?? "")}`}
                    title={$t("common.edit")}
                  >
                    <Edit size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <div
                  class="flex items-center justify-between gap-2 text-sm text-[var(--muted)]"
                >
                  <span>{$t("tires.wearLabel")} · {wear}%</span>
                  <StatusBadge {tone}>{wearToneLabel(tone)}</StatusBadge>
                </div>
                <div
                  class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]"
                  role="img"
                  aria-label={`${$t("tires.wearLabel")}: ${wear}%`}
                >
                  <div
                    class="h-full rounded-full transition-all"
                    style={`width:${Math.min(Math.max(wear, 0), 100)}%;background:${wearToneColor(tone)}`}
                  ></div>
                </div>
              </div>

              <p class="text-sm font-semibold">
                {#if estimate}
                  <span
                    class={tone === "overdue"
                      ? "text-[var(--accent)]"
                      : "text-[var(--fg)]"}
                    >{$t("tires.remainingKm", {
                      count: km(estimate.remainingKm),
                    })}</span
                  >
                {:else}
                  <span class="text-[var(--muted)]"
                    >{$t("tires.lifeUnknown")}</span
                  >
                {/if}
              </p>

              {#if tire.estimated_change_date}
                <p class="text-sm text-[var(--muted)]">
                  {$t("forecast.tireDate")}: {$format.date(
                    tire.estimated_change_date,
                  )}
                </p>
              {/if}

              <p class="text-xs text-[var(--muted)]">
                {#if tire.wear_odometer_km != null}
                  {$t("tires.wearObservedAt")}:
                  {#if tire.wear_observed_at}
                    {$format.date(tire.wear_observed_at, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                      timeZoneName: "short",
                    })} ·
                  {/if}
                  {$format.distance(tire.wear_odometer_km)}
                {:else}
                  {$t("tires.wearObservationUnknown")}
                {/if}
              </p>
              <details class="border-t border-[var(--line)] pt-2">
                <summary
                  class="focus-ring flex min-h-11 cursor-pointer items-center text-sm font-semibold"
                >
                  {$t("tires.recordWearObservation")}
                </summary>
                <form
                  class="mt-2 grid gap-3"
                  method="POST"
                  action="?/recordWearObservation"
                  use:enhance={enhanceWithToast(() =>
                    $t("tires.wearObservationSaved"),
                  )}
                >
                  <input type="hidden" name="id" value={tire.id} />
                  <p class="text-sm text-[var(--muted)]">
                    {$t("tires.wearObservationHelp")}
                  </p>
                  <div class="field-group">
                    <label class="field-label" for={`wear-${tire.id}`}>
                      {$t("tires.wearPercentLabel")}
                    </label>
                    <input
                      class="field"
                      id={`wear-${tire.id}`}
                      name="wear_percent"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      max="100"
                      step="1"
                      value={tire.wear_percent ?? 0}
                      required
                    />
                  </div>
                  <button
                    class="button-secondary min-h-11 justify-self-start"
                    type="submit"
                    disabled={formBusy}
                  >
                    {$t("tires.recordWearObservation")}
                  </button>
                </form>
              </details>

              <dl
                class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--line)] pt-3 text-sm sm:grid-cols-4"
              >
                <div>
                  <dt class="label-tech text-[var(--muted)]">
                    {$t("tires.installedAtLabel")}
                  </dt>
                  <dd>
                    {tire.installed_at ? $format.date(tire.installed_at) : "—"}
                  </dd>
                </div>
                <div>
                  <dt class="label-tech text-[var(--muted)]">
                    {$t("tires.installedKmLabel")}
                  </dt>
                  <dd class="numeric">
                    {tire.installed_odometer_km == null
                      ? "—"
                      : `${km(Number(tire.installed_odometer_km))} km`}
                  </dd>
                </div>
                <div>
                  <dt class="label-tech text-[var(--muted)]">
                    {$t("tires.costLabel")}
                  </dt>
                  <dd class="numeric">
                    {brl(Number(tire.cost_cents ?? 0))}
                  </dd>
                </div>
                <div>
                  <dt class="label-tech text-[var(--muted)]">
                    {$t("garage.currentOdometer")}
                  </dt>
                  <dd class="numeric">
                    {tire.current_km == null
                      ? "—"
                      : `${km(Number(tire.current_km))} km`}
                  </dd>
                </div>
              </dl>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if hasMotorcycles && (hasTireData || pressures.length > 0)}
    <!-- PRESSURE SUMMARY -->
    <section class="panel p-5" aria-labelledby="tires-pressure-heading">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tires-pressure-heading" class="display text-xl">
          {$t("tires.pressureHeading")}
        </h2>
        <button
          type="button"
          class="button-secondary min-h-11"
          on:click={() => pressureSheet?.open()}
          disabled={formBusy}
        >
          {$t("authenticatedUx.logPressure")}
        </button>
      </div>

      {#if pressures.length === 0}
        <p class="mt-3 text-sm text-[var(--muted)]">
          {$t("tires.pressureEmpty")}
        </p>
      {:else}
        <ul class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {#each pressures.slice(0, 4) as pressure (pressure.id)}
            <li
              class="flex items-center justify-between gap-2 rounded border border-[var(--line)] p-3 text-sm"
            >
              <div class="min-w-0">
                <p class="text-xs text-[var(--muted)]">
                  {#if pressure.motorcycles?.name}{pressure.motorcycles.name} ·
                  {/if}{pressure.date
                    ? $format.date(String(pressure.date))
                    : ""}
                </p>
                <p class="numeric mt-0.5 text-base font-bold">
                  {$format.number(Number(pressure.psi_front))}/{$format.number(
                    Number(pressure.psi_rear),
                  )}
                  <span class="text-xs font-normal text-[var(--muted)]"
                    >PSI</span
                  >
                </p>
              </div>
              <form
                method="POST"
                action="?/deletePressure"
                use:enhance={enhanceDelete}
              >
                <input type="hidden" name="id" value={String(pressure.id)} />
                <button
                  class="button-danger min-h-11 px-3 py-1"
                  disabled={formBusy}
                  aria-label={$t("common.delete")}
                  title={$t("common.delete")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if hasMotorcycles && hasTireData}
    <!-- HISTORY TABLE -->
    <section
      class="panel overflow-hidden"
      aria-labelledby="tires-history-heading"
    >
      <div class="border-b border-[var(--line)] px-4 py-3">
        <h2 id="tires-history-heading" class="text-base font-semibold">
          {$t("tires.historyHeading")}
          <span class="numeric font-normal text-[var(--muted)]"
            >({historyTires.length})</span
          >
        </h2>
      </div>
      <div class="data-table sm:overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-[var(--line)] bg-[var(--accent-wash)] text-sm text-[var(--muted)]"
          >
            <tr>
              <th class="px-4 py-3 font-semibold">{$t("tires.dateLabel")}</th>
              <th class="px-4 py-3 font-semibold"
                >{$t("tires.positionLabel")}</th
              >
              <th class="px-4 py-3 font-semibold"
                >{$t("tires.brandModelLabel")}</th
              >
              <th class="px-4 py-3 font-semibold"
                >{$t("tires.motorcycleLabel")}</th
              >
              <th class="px-4 py-3 font-semibold"
                >{$t("tires.wearPercentLabel")}</th
              >
              <th class="px-4 py-3 font-semibold">{$t("tires.costLabel")}</th>
              <th class="px-4 py-3 font-semibold">{$t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each historyTires as tire (tire.id)}
              <tr class="row-hover border-b border-[var(--line)]">
                <td class="px-4 py-3" data-label={$t("tires.dateLabel")}
                  >{tire.installed_at
                    ? $format.date(tire.installed_at)
                    : ""}</td
                >
                <td class="px-4 py-3" data-label={$t("tires.positionLabel")}
                  >{positionLabel(tire.position)}</td
                >
                <td class="px-4 py-3" data-label={$t("tires.brandModelLabel")}
                  >{String(tire.brand_model ?? "")}</td
                >
                <td class="px-4 py-3" data-label={$t("tires.motorcycleLabel")}
                  >{String(tire.motorcycle_name ?? "")}</td
                >
                <td
                  class="numeric px-4 py-3"
                  data-label={$t("tires.wearPercentLabel")}
                  >{tire.wear_percent == null
                    ? "—"
                    : `${Number(tire.wear_percent)}%`}</td
                >
                <td class="numeric px-4 py-3" data-label={$t("tires.costLabel")}
                  >{brl(Number(tire.cost_cents ?? 0))}</td
                >
                <td class="px-4 py-3" data-label={$t("common.actions")}>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="button-secondary min-h-11 px-3 py-1"
                      on:click={() => openEditTire(tire)}
                      aria-label={`${$t("common.edit")} ${String(tire.brand_model ?? "")}`}
                      title={$t("common.edit")}
                    >
                      <Edit size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <!-- INSTALL TIRE RECORD SHEET -->
  <RecordSheet
    bind:this={installSheet}
    title={$t("authenticatedUx.installTire")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/installTire"
      use:enhance={enhanceWithToast(() => $t("serviceUx.tireSaved"))}
    >
      <input type="hidden" name="_intent" value="create" />
      <div class="field-group">
        <label class="field-label" for="sheet-install-motorcycle">
          {$t("tires.motorcycleLabel")}
        </label>
        <select
          class="field"
          id="sheet-install-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          {#each data.motorcycles as moto (moto.id)}
            <option
              value={moto.id}
              selected={String(moto.id) === String(selectedMotorcycleId)}
            >
              {moto.name}
            </option>
          {/each}
        </select>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="sheet-install-date">
            {$t("tires.dateLabel")}
          </label>
          <input
            class="field"
            id="sheet-install-date"
            type="date"
            name="installed_at"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="sheet-install-position">
            {$t("tires.positionLabel")}
          </label>
          <select
            class="field"
            id="sheet-install-position"
            name="position"
            required
          >
            <option value="dianteiro">{$t("tires.positionFront")}</option>
            <option value="traseiro">{$t("tires.positionRear")}</option>
          </select>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="sheet-install-brand">
          {$t("tires.brandModelLabel")}
        </label>
        <input
          class="field"
          id="sheet-install-brand"
          name="brand_model"
          required
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="sheet-install-km">
            {$t("tires.installedKmLabel")}
          </label>
          <input
            class="field"
            id="sheet-install-km"
            type="number"
            inputmode="numeric"
            name="installed_odometer_km"
            min="0"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="sheet-install-cost">
            {$t("tires.costLabel")}
          </label>
          <input
            class="field"
            id="sheet-install-cost"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            name="cost_cents"
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="sheet-install-wear">
            {$t("tires.wearPercentLabel")}
          </label>
          <input
            class="field"
            id="sheet-install-wear"
            type="number"
            inputmode="numeric"
            min="0"
            max="100"
            name="wear_percent"
          />
          <p class="field-help">{$t("tires.wearOptionalHint")}</p>
        </div>
        <div class="field-group">
          <label class="field-label" for="sheet-install-change">
            {$t("tires.estimatedChangeKmLabel")}
          </label>
          <input
            class="field"
            id="sheet-install-change"
            type="number"
            inputmode="numeric"
            min="0"
            name="estimated_change_km"
          />
          <p class="field-help">{$t("tires.changeOptionalHint")}</p>
        </div>
      </div>

      <label class="switch">
        <input type="checkbox" name="is_active" value="true" checked />
        <span class="switch-track" aria-hidden="true"></span>
        <span class="text-sm text-[var(--muted)]"
          >{$t("tires.isActiveLabel")}</span
        >
      </label>

      <div class="sheet-actions">
        <button
          class="button-primary min-h-11 w-full"
          type="submit"
          disabled={!hasMotorcycles || formBusy}
        >
          {$t("tires.installAction")}
        </button>
      </div>
    </form>
  </RecordSheet>

  <!-- LOG PRESSURE RECORD SHEET -->
  <RecordSheet
    bind:this={pressureSheet}
    title={$t("tires.pressureFormTitle")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/savePressure"
      use:enhance={enhanceWithToast(() => $t("serviceUx.pressureSaved"))}
    >
      <div class="field-group">
        <label class="field-label" for="sheet-pressure-motorcycle">
          {$t("tires.motorcycleLabel")}
        </label>
        <select
          class="field"
          id="sheet-pressure-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          {#each data.motorcycles as moto (moto.id)}
            <option
              value={moto.id}
              selected={String(moto.id) === String(selectedMotorcycleId)}
            >
              {moto.name}
            </option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="sheet-pressure-date">
          {$t("tires.dateLabel")}
        </label>
        <input
          class="field"
          id="sheet-pressure-date"
          type="date"
          name="date"
          required
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="sheet-pressure-front">
            {$t("tires.psiFront")}
          </label>
          <input
            class="field"
            id="sheet-pressure-front"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            name="psi_front"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="sheet-pressure-rear">
            {$t("tires.psiRear")}
          </label>
          <input
            class="field"
            id="sheet-pressure-rear"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            name="psi_rear"
            required
          />
        </div>
      </div>

      <div class="sheet-actions">
        <button
          class="button-primary min-h-11 w-full"
          type="submit"
          disabled={!hasMotorcycles || formBusy}
        >
          {$t("tires.pressureAction")}
        </button>
      </div>
    </form>
  </RecordSheet>

  <!-- EDIT TIRE RECORD SHEET -->
  <RecordSheet
    bind:this={editSheet}
    title={$t("tires.editRecord")}
    closeLabel={$t("authenticatedUx.close")}
  >
    {#if editingTire}
      <form
        class="grid gap-4"
        method="POST"
        action="?/installTire"
        use:enhance={enhanceWithToast(() => $t("common.actionSuccess"))}
      >
        <input type="hidden" name="_intent" value="update" />
        <input type="hidden" name="id" value={String(editingTire.id)} />
        <input
          type="hidden"
          name="motorcycle_id"
          value={String(editingTire.motorcycle_id ?? selectedMotorcycleId)}
        />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="sheet-edit-date">
              {$t("tires.dateLabel")}
            </label>
            <input
              class="field"
              id="sheet-edit-date"
              type="date"
              name="installed_at"
              value={String(editingTire.installed_at ?? "")}
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="sheet-edit-position">
              {$t("tires.positionLabel")}
            </label>
            <select
              class="field"
              id="sheet-edit-position"
              name="position"
              required
            >
              <option
                value="dianteiro"
                selected={String(editingTire.position ?? "") === "dianteiro"}
              >
                {$t("tires.positionFront")}
              </option>
              <option
                value="traseiro"
                selected={String(editingTire.position ?? "") === "traseiro"}
              >
                {$t("tires.positionRear")}
              </option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="sheet-edit-brand">
            {$t("tires.brandModelLabel")}
          </label>
          <input
            class="field"
            id="sheet-edit-brand"
            name="brand_model"
            value={String(editingTire.brand_model ?? "")}
            required
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="sheet-edit-km">
              {$t("tires.installedKmLabel")}
            </label>
            <input
              class="field"
              id="sheet-edit-km"
              type="number"
              inputmode="numeric"
              min="0"
              name="installed_odometer_km"
              value={String(editingTire.installed_odometer_km ?? "")}
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="sheet-edit-cost">
              {$t("tires.costLabel")}
            </label>
            <input
              class="field"
              id="sheet-edit-cost"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              name="cost_cents"
              value={decimalValue(editingTire.cost_cents)}
            />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="sheet-edit-wear">
              {$t("tires.wearPercentLabel")}
            </label>
            <input
              class="field"
              id="sheet-edit-wear"
              type="number"
              inputmode="numeric"
              min="0"
              max="100"
              name="wear_percent"
              value={String(editingTire.wear_percent ?? "")}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="sheet-edit-change">
              {$t("tires.estimatedChangeKmLabel")}
            </label>
            <input
              class="field"
              id="sheet-edit-change"
              type="number"
              inputmode="numeric"
              min="0"
              name="estimated_change_km"
              value={String(editingTire.estimated_change_km ?? "")}
            />
          </div>
        </div>

        <label class="switch">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            checked={editingTire.is_active === true}
          />
          <span class="switch-track" aria-hidden="true"></span>
          <span class="text-sm text-[var(--muted)]"
            >{$t("tires.isActiveLabel")}</span
          >
        </label>

        <div class="sheet-actions">
          <button
            class="button-danger mr-auto min-h-11"
            type="submit"
            form="tire-delete-form"
            disabled={formBusy}
          >
            {$t("common.delete")}
          </button>
          <button
            class="button-primary min-h-11"
            type="submit"
            disabled={formBusy}
          >
            {$t("common.saveChanges")}
          </button>
        </div>
      </form>
      <form
        id="tire-delete-form"
        method="POST"
        action="?/deleteTire"
        use:enhance={enhanceDeleteTire}
      >
        <input type="hidden" name="_intent" value="delete" />
        <input type="hidden" name="id" value={String(editingTire.id)} />
      </form>
    {/if}
  </RecordSheet>

  <!-- TIRE CATALOG RECORD SHEET -->
  <RecordSheet
    bind:this={catalogSheet}
    title={$t("tires.catalogHeading")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <div class="grid gap-6">
      <form
        class="grid gap-3"
        method="POST"
        action="?/saveProduct"
        use:enhance={enhanceWithToast(() => $t("serviceUx.productSaved"))}
      >
        <h3 class="font-semibold">{$t("tires.catalogFormTitle")}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="sheet-product-manufacturer">
              {$t("tires.manufacturerLabel")}
            </label>
            <input
              class="field"
              id="sheet-product-manufacturer"
              name="manufacturer"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="sheet-product-model">
              {$t("tires.modelLabel")}
            </label>
            <input
              class="field"
              id="sheet-product-model"
              name="model_name"
              required
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="sheet-product-type">
              {$t("tires.tireTypeLabel")}
            </label>
            <input class="field" id="sheet-product-type" name="tire_type" />
          </div>
          <div class="field-group">
            <label class="field-label" for="sheet-product-price">
              {$t("tires.priceLabel")}
            </label>
            <input
              class="field"
              id="sheet-product-price"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              name="price"
            />
          </div>
        </div>
        <div class="sheet-actions">
          <button
            class="button-primary min-h-11 w-full"
            type="submit"
            disabled={formBusy}
          >
            {$t("common.save")}
          </button>
        </div>
      </form>

      <div class="border-t border-[var(--line)] pt-4">
        <h3 class="mb-3 font-semibold">{$t("tires.catalogHeading")}</h3>
        <ul class="grid gap-2">
          {#each data.products ?? [] as product (product.id)}
            <li
              class="flex items-center justify-between gap-3 rounded border border-[var(--line)] p-3 text-sm"
            >
              <span class="min-w-0 break-words">
                <strong>{product.manufacturer}</strong>
                {product.model_name}
                <span class="block text-xs text-[var(--muted)]">
                  {#if product.tire_type}{product.tire_type} ·
                  {/if}{brl(Number(product.price_cents ?? 0))}
                </span>
              </span>
              <form
                method="POST"
                action="?/deleteProduct"
                use:enhance={enhanceDelete}
              >
                <input type="hidden" name="id" value={String(product.id)} />
                <button
                  class="button-danger min-h-11 px-3 py-1"
                  disabled={formBusy}
                  aria-label={`${$t("common.delete")} ${String(product.model_name ?? "")}`}
                  title={$t("common.delete")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </form>
            </li>
          {:else}
            <li class="text-sm text-[var(--muted)]">
              {$t("tires.catalogEmpty")}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </RecordSheet>
</section>
