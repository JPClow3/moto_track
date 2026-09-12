<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import CircleGauge from "lucide-svelte/icons/circle-gauge";
  import Download from "lucide-svelte/icons/download";
  import BookOpen from "lucide-svelte/icons/book-open";
  import Edit from "lucide-svelte/icons/edit-2";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import BikeContextBar from "$lib/components/app/BikeContextBar.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) =>
    Number(value).toLocaleString($locale ?? "pt-BR");

  type LifeEstimate = { projectedChangeKm: number; remainingKm: number } | null;
  type TireRow = Record<string, unknown> & {
    id: string;
    life_estimate?: LifeEstimate;
    current_km?: number | null;
    motorcycle_name?: string | null;
    motorcycle_id?: string;
    position?: string;
    brand_model?: string;
    installed_at?: string;
    installed_odometer_km?: number | string | null;
    wear_percent?: number | string | null;
    estimated_change_km?: number | string | null;
    cost_cents?: number | null;
    is_active?: boolean;
  };

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: activeTires = (data.activeTires ?? []) as TireRow[];
  $: historyTires = (data.rows ?? []) as TireRow[];

  let selectedMotorcycleId = data.motorcycles[0]?.id
    ? String(data.motorcycles[0].id)
    : "";
  $: currentMotorcycle =
    data.motorcycles.find(
      (m: Record<string, unknown>) =>
        String(m.id) === String(selectedMotorcycleId),
    ) ?? data.motorcycles[0];

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  let actionMenu: ActionMenu;
  let pressureSheet: RecordSheet;
  let installSheet: RecordSheet;
  let editSheet: RecordSheet;
  let catalogSheet: RecordSheet;
  let editingTire: TireRow | null = null;

  const tireChoices: ActionChoice[] = [
    {
      id: "tires-pressure",
      label: $t("authenticatedUx.logPressure") || "Aferir calibragem",
      description:
        $t("authenticatedUx.logPressureDesc") || "Pressão atual dos pneus",
      recommended: true,
    },
    {
      id: "tires-install",
      label: $t("authenticatedUx.installTire") || "Instalar ou trocar pneu",
      description:
        $t("authenticatedUx.installTireDesc") ||
        "Novo pneu dianteiro ou traseiro",
    },
  ];

  function handleActionSelect(event: CustomEvent<string>) {
    actionMenu.close();
    if (event.detail === "tires-pressure") {
      pressureSheet.open();
    } else if (event.detail === "tires-install") {
      installSheet.open();
    }
  }

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
    return String(position ?? "—");
  }

  function wearColor(wearPercent: number) {
    if (wearPercent >= 80) return "var(--danger)";
    if (wearPercent >= 60) return "var(--warning)";
    return "var(--accent)";
  }

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    statusRole = result.type === "success" ? "status" : "alert";
    statusMessage =
      result.type === "success"
        ? $t("common.actionSuccess")
        : String(result.data?.message ?? $t("error.serverBody"));
  };

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      if (result.type === "success") {
        pressureSheet?.close();
        installSheet?.close();
        editSheet?.close();
        catalogSheet?.close();
      }
      await update();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
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
    frontTire
      ? {
          label: `${$t("tires.positionFront")} · ${frontTire.brand_model || ""}`,
          value: `${Number(frontTire.wear_percent ?? 0)}% ${$t("tires.wearLabel")}`,
          hint: frontTire.life_estimate
            ? $t("tires.remainingKm", {
                count: km(frontTire.life_estimate.remainingKm),
              })
            : undefined,
        }
      : {
          label: $t("tires.positionFront"),
          value: $t("common.empty"),
          hint: $t("tires.activeEmptyHint"),
        },
    rearTire
      ? {
          label: `${$t("tires.positionRear")} · ${rearTire.brand_model || ""}`,
          value: `${Number(rearTire.wear_percent ?? 0)}% ${$t("tires.wearLabel")}`,
          hint: rearTire.life_estimate
            ? $t("tires.remainingKm", {
                count: km(rearTire.life_estimate.remainingKm),
              })
            : undefined,
        }
      : {
          label: $t("tires.positionRear"),
          value: $t("common.empty"),
          hint: $t("tires.activeEmptyHint"),
        },
    {
      label: $t("nav.tires"),
      value: `${activeTires.length} ${$t("garage.active")}`,
      hint: `${historyTires.length} total`,
    },
  ] as Signal[];
</script>

<svelte:head><title>{$t("tires.pageTitle")} · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    eyebrow={$t("nav.tires")}
    title={$t("tires.pageTitle")}
    description={$t("tires.pageSubtitle")}
  >
    <svelte:fragment slot="actions">
      <PageAction
        label={$t("authenticatedUx.add")}
        ariaLabel={$t("authenticatedUx.add")}
        on:click={() => actionMenu?.open()}
      />
    </svelte:fragment>
    <svelte:fragment slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        <a
          class="focus-ring flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--line)]"
          href="/tires/export.csv"
        >
          <Download size={14} aria-hidden="true" />
          <span>{$t("common.exportCsv")}</span>
        </a>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--line)]"
          on:click={() => catalogSheet?.open()}
        >
          <BookOpen size={14} aria-hidden="true" />
          <span>{$t("tires.catalogHeading")}</span>
        </button>
      </PageOverflowMenu>
    </svelte:fragment>
  </PageHeader>

  <ActionMenu
    bind:this={actionMenu}
    title={$t("nav.tires")}
    closeLabel={$t("authenticatedUx.close")}
    choices={tireChoices}
    on:select={handleActionSelect}
  />

  <BikeContextBar
    name={currentMotorcycle
      ? String(currentMotorcycle.name)
      : $t("maintenance.bikeFallback")}
    model={currentMotorcycle
      ? `${currentMotorcycle.brand || ""} ${currentMotorcycle.model || ""}`.trim()
      : ""}
    odometerKm={currentMotorcycle?.current_odometer_km ?? null}
  >
    <svelte:fragment slot="selection">
      {#if data.motorcycles.length > 1}
        <div class="flex items-center gap-2">
          <label for="tires-bike-select" class="sr-only">
            {$t("authenticatedUx.selectBike")}
          </label>
          <select
            id="tires-bike-select"
            class="field px-2 py-1 text-xs"
            bind:value={selectedMotorcycleId}
            aria-label={$t("authenticatedUx.selectBike")}
          >
            {#each data.motorcycles as moto (moto.id)}
              <option value={moto.id}>{moto.name}</option>
            {/each}
          </select>
        </div>
      {/if}
    </svelte:fragment>
  </BikeContextBar>

  <SignalStrip {signals} />

  {#if !hasMotorcycles}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <span class="text-[var(--accent)]">{$t("tires.noMotorcyclesHint")}</span>
      <a class="button-secondary min-h-11 shrink-0" href="/garage"
        >{$t("maintenance.goToGarage")}</a
      >
    </div>
  {/if}

  {#if data.errorMessage || form?.message}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {data.errorMessage || form?.message}
    </div>
  {/if}

  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
  {/if}

  <ConfirmDialog bind:this={confirmDialog} confirmLabel={$t("common.delete")} />

  <!-- ACTIVE TIRES STATUS CARDS -->
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <h2 class="display text-2xl">{$t("tires.activeHeading")}</h2>
      <button
        type="button"
        class="button-secondary min-h-9 px-3 py-1 text-xs"
        on:click={() => installSheet?.open()}
        disabled={!hasMotorcycles || formBusy}
      >
        {$t("tires.installAction")}
      </button>
    </div>

    {#if activeTires.length === 0}
      <div
        class="rounded border border-dashed border-[var(--line)] p-8 text-center"
      >
        <CircleGauge
          size={28}
          class="mx-auto text-[var(--muted)]"
          aria-hidden="true"
        />
        <p class="mt-3 text-sm text-[var(--muted)]">
          {$t("tires.activeEmptyHint")}
        </p>
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each activeTires as tire (tire.id)}
          {@const wear = Number(tire.wear_percent ?? 0)}
          {@const estimate = tire.life_estimate}
          <article class="panel grid gap-3 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span
                  class="label-tech inline-block rounded border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                  >{positionLabel(tire.position)}</span
                >
                <h3 class="display mt-1 truncate text-xl">
                  {String(tire.brand_model ?? "—")}
                </h3>
                <p class="text-sm text-[var(--muted)]">
                  {String(tire.motorcycle_name ?? "—")}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="button-secondary min-h-9 px-2 py-1 text-xs"
                  on:click={() => openEditTire(tire)}
                  title={$t("common.edit")}
                >
                  <Edit size={14} aria-hidden="true" />
                </button>
                <form method="POST" use:enhance={enhanceDelete}>
                  <input type="hidden" name="_intent" value="delete" />
                  <input type="hidden" name="id" value={String(tire.id)} />
                  <button
                    class="button-danger min-h-9 px-2 py-1 text-xs"
                    type="submit"
                    disabled={formBusy}
                    title={$t("common.delete")}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>

            <div>
              <div
                class="flex items-center justify-between text-xs text-[var(--muted)]"
              >
                <span>{$t("tires.wearLabel")}</span>
                <span>{wear}%</span>
              </div>
              <div
                class="mt-1 h-2 overflow-hidden rounded-full bg-[var(--line)]"
                role="img"
                aria-label={`${$t("tires.wearLabel")}: ${wear}%`}
              >
                <div
                  class="h-full rounded-full transition-all"
                  style={`width:${Math.min(Math.max(wear, 0), 100)}%;background:${wearColor(wear)}`}
                ></div>
              </div>
            </div>

            <p class="text-sm font-semibold">
              {#if estimate}
                <span style={`color:${wearColor(wear)}`}
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

            <dl
              class="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)] sm:grid-cols-4"
            >
              <div>
                <dt class="label-tech text-[10px]">
                  {$t("tires.installedAtLabel")}
                </dt>
                <dd class="text-[var(--fg)]">{String(tire.installed_at)}</dd>
              </div>
              <div>
                <dt class="label-tech text-[10px]">
                  {$t("tires.installedKmLabel")}
                </dt>
                <dd class="text-[var(--fg)]">
                  {tire.installed_odometer_km == null
                    ? "—"
                    : km(Number(tire.installed_odometer_km))}
                </dd>
              </div>
              <div>
                <dt class="label-tech text-[10px]">{$t("tires.costLabel")}</dt>
                <dd class="text-[var(--fg)]">
                  {brl(Number(tire.cost_cents ?? 0))}
                </dd>
              </div>
              <div>
                <dt class="label-tech text-[10px]">
                  {$t("garage.currentOdometer")}
                </dt>
                <dd class="text-[var(--fg)]">
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
  </div>

  <!-- PRESSURE SUMMARY STRIP -->
  <div class="panel p-5">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="display text-xl font-bold">{$t("tires.pressureHeading")}</h3>
        <p class="text-xs text-[var(--muted)]">
          {$t("tires.pressureFormTitle")}
        </p>
      </div>
      <button
        type="button"
        class="button-secondary min-h-9 px-3 py-1 text-xs"
        on:click={() => pressureSheet?.open()}
        disabled={!hasMotorcycles || formBusy}
      >
        {$t("authenticatedUx.logPressure")}
      </button>
    </div>

    <ul class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {#each (data.pressures ?? []).slice(0, 4) as pressure (pressure.id)}
        <li
          class="flex items-center justify-between gap-2 rounded border border-[var(--line)] p-3 text-sm"
        >
          <div class="min-w-0">
            <p class="text-xs font-medium text-[var(--muted)]">
              {pressure.motorcycles?.name ?? "—"} · {pressure.date}
            </p>
            <p class="mt-0.5 text-base font-bold">
              {pressure.psi_front}/{pressure.psi_rear}
              <span class="text-xs font-normal text-[var(--muted)]">PSI</span>
            </p>
          </div>
          <form
            method="POST"
            action="?/deletePressure"
            use:enhance={enhanceDelete}
          >
            <input type="hidden" name="id" value={String(pressure.id)} />
            <button
              class="button-danger min-h-8 px-2 py-1 text-xs"
              disabled={formBusy}
              title={$t("common.delete")}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </form>
        </li>
      {:else}
        <li class="text-sm text-[var(--muted)] sm:col-span-2">
          {$t("tires.pressureEmpty")}
        </li>
      {/each}
    </ul>
  </div>

  <!-- HISTORY TABLE -->
  <div class="panel overflow-hidden">
    <div
      class="border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-2.5"
    >
      <span class="label-tech text-[var(--accent)]">
        {$t("tires.historyHeading")} ({historyTires.length})
      </span>
    </div>
    <div class="tire-table-scroll overflow-x-auto">
      <table class="tire-table w-full text-left text-sm">
        <thead
          class="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] text-xs uppercase text-[var(--muted)]"
        >
          <tr>
            <th class="px-4 py-3">{$t("tires.dateLabel")}</th>
            <th class="px-4 py-3">{$t("tires.positionLabel")}</th>
            <th class="px-4 py-3">{$t("tires.brandModelLabel")}</th>
            <th class="px-4 py-3">{$t("tires.motorcycleLabel")}</th>
            <th class="px-4 py-3">{$t("tires.wearPercentLabel")}</th>
            <th class="px-4 py-3">{$t("tires.costLabel")}</th>
            <th class="px-4 py-3">{$t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {#each historyTires as tire (tire.id)}
            <tr class="row-hover border-b border-[var(--line)]">
              <td class="px-4 py-3" data-label={$t("tires.dateLabel")}
                >{String(tire.installed_at)}</td
              >
              <td class="px-4 py-3" data-label={$t("tires.positionLabel")}
                >{positionLabel(tire.position)}</td
              >
              <td class="px-4 py-3" data-label={$t("tires.brandModelLabel")}
                >{String(tire.brand_model ?? "—")}</td
              >
              <td class="px-4 py-3" data-label={$t("tires.motorcycleLabel")}
                >{String(tire.motorcycle_name ?? "—")}</td
              >
              <td class="px-4 py-3" data-label={$t("tires.wearPercentLabel")}
                >{tire.wear_percent == null
                  ? "—"
                  : `${Number(tire.wear_percent)}%`}</td
              >
              <td class="px-4 py-3" data-label={$t("tires.costLabel")}
                >{brl(Number(tire.cost_cents ?? 0))}</td
              >
              <td class="px-4 py-3" data-label={$t("common.actions")}>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="button-secondary min-h-8 px-2 py-1 text-xs"
                    on:click={() => openEditTire(tire)}
                    title={$t("common.edit")}
                  >
                    <Edit size={12} aria-hidden="true" />
                  </button>
                  <form method="POST" use:enhance={enhanceDelete}>
                    <input type="hidden" name="_intent" value="delete" />
                    <input type="hidden" name="id" value={String(tire.id)} />
                    <button
                      class="button-danger min-h-8 px-2 py-1 text-xs"
                      type="submit"
                      disabled={formBusy}
                      title={$t("common.delete")}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td
                colspan="7"
                class="px-4 py-12 text-center text-[var(--muted)]"
              >
                {$t("tires.historyEmpty")}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- INSTALL TIRE RECORD SHEET -->
  <RecordSheet
    bind:this={installSheet}
    title={$t("tires.installFormTitle")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/installTire"
      use:enhance={enhanceWithStatus}
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
            type="number"
            step="0.01"
            min="0"
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

      <button
        class="button-primary min-h-11 w-full"
        type="submit"
        disabled={!hasMotorcycles || formBusy}
      >
        {$t("tires.installAction")}
      </button>
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
      use:enhance={enhanceWithStatus}
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
            type="number"
            step="0.5"
            min="0"
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
            type="number"
            step="0.5"
            min="0"
            name="psi_rear"
            required
          />
        </div>
      </div>

      <button
        class="button-primary min-h-11 w-full"
        type="submit"
        disabled={!hasMotorcycles || formBusy}
      >
        {$t("tires.pressureAction")}
      </button>
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
        use:enhance={enhanceWithStatus}
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
              type="number"
              step="0.01"
              name="cost_cents"
              value={Number(editingTire.cost_cents ?? 0) / 100}
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

        <button
          class="button-primary min-h-11 w-full"
          type="submit"
          disabled={formBusy}
        >
          {$t("common.saveChanges")}
        </button>
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
        use:enhance={enhanceWithStatus}
      >
        <h3 class="font-bold">{$t("tires.catalogFormTitle")}</h3>
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
              type="number"
              step="0.01"
              min="0"
              name="price"
            />
          </div>
        </div>
        <button
          class="button-primary min-h-11 w-full"
          type="submit"
          disabled={formBusy}
        >
          {$t("common.save")}
        </button>
      </form>

      <div class="border-t border-[var(--line)] pt-4">
        <h3 class="mb-3 font-bold">{$t("tires.catalogHeading")}</h3>
        <ul class="grid gap-2">
          {#each data.products ?? [] as product (product.id)}
            <li
              class="flex items-center justify-between gap-3 rounded border border-[var(--line)] p-3 text-sm"
            >
              <span class="min-w-0 break-words">
                <strong>{product.manufacturer}</strong>
                {product.model_name}
                <span class="block text-xs text-[var(--muted)]">
                  {product.tire_type || "—"} · {brl(
                    Number(product.price_cents ?? 0),
                  )}
                </span>
              </span>
              <form
                method="POST"
                action="?/deleteProduct"
                use:enhance={enhanceDelete}
              >
                <input type="hidden" name="id" value={String(product.id)} />
                <button
                  class="button-danger min-h-8 px-2 py-1 text-xs"
                  disabled={formBusy}
                  title={$t("common.delete")}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </form>
            </li>
          {:else}
            <li class="text-sm text-[var(--muted)]">
              {$t("common.empty")}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </RecordSheet>
</section>
