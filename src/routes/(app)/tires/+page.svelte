<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { CircleGauge } from "lucide-svelte";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) =>
    Number(value).toLocaleString($locale ?? "pt-BR");

  type LifeEstimate = { projectedChangeKm: number; remainingKm: number } | null;
  type TireRow = Record<string, unknown> & {
    life_estimate?: LifeEstimate;
    current_km?: number | null;
    motorcycle_name?: string | null;
  };

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: activeTires = (data.activeTires ?? []) as TireRow[];
  $: historyTires = (data.rows ?? []) as TireRow[];

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  function positionLabel(position: unknown) {
    const value = String(position ?? "").toLowerCase();
    if (value === "dianteiro" || value === "front")
      return $t("tires.positionFront");
    if (value === "traseiro" || value === "rear")
      return $t("tires.positionRear");
    return String(position ?? "—");
  }

  // Wear below 60% is healthy, up to 85% is a planning hint, past that the
  // swap stops being a someday item — the bar colour carries that urgency.
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
</script>

<svelte:head><title>{$t("tires.pageTitle")} · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>{$t("nav.tires")}
      </p>
      <h1 class="display text-4xl">{$t("tires.pageTitle")}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        {$t("tires.pageSubtitle")}
      </p>
    </div>
    <a class="button-secondary" href="/tires/export.csv"
      >{$t("common.exportCsv")}</a
    >
  </div>

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

  <div class="grid gap-3">
    <h2 class="display text-2xl">{$t("tires.activeHeading")}</h2>
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
              <form method="POST" use:enhance={enhanceDelete} class="shrink-0">
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={String(tire.id)} />
                <button
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  type="submit"
                  disabled={formBusy}>{$t("common.delete")}</button
                >
              </form>
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

  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel relative grid gap-3 overflow-hidden p-5"
      method="POST"
      use:enhance={enhanceWithStatus}
    >
      <div class="corner-slashes" aria-hidden="true"></div>
      <input type="hidden" name="_intent" value="create" />
      <h2 class="display relative text-xl">{$t("tires.installFormTitle")}</h2>
      <div class="relative grid gap-3">
        <label class="field-label" for="tire-install-motorcycle"
          >{$t("tires.motorcycleLabel")}</label
        >
        <select
          class="field"
          id="tire-install-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          {#each data.motorcycles as moto (moto.id)}
            <option value={moto.id}>{moto.name}</option>
          {/each}
        </select>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-install-date"
              >{$t("tires.dateLabel")}</label
            >
            <input
              class="field"
              id="tire-install-date"
              type="date"
              name="installed_at"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-install-position"
              >{$t("tires.positionLabel")}</label
            >
            <select
              class="field"
              id="tire-install-position"
              name="position"
              required
            >
              <option value="dianteiro">{$t("tires.positionFront")}</option>
              <option value="traseiro">{$t("tires.positionRear")}</option>
            </select>
          </div>
        </div>
        <label class="field-label" for="tire-install-brand"
          >{$t("tires.brandModelLabel")}</label
        >
        <input
          class="field"
          id="tire-install-brand"
          name="brand_model"
          required
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-install-km"
              >{$t("tires.installedKmLabel")}</label
            >
            <input
              class="field"
              id="tire-install-km"
              type="number"
              name="installed_odometer_km"
              min="0"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-install-cost"
              >{$t("tires.costLabel")}</label
            >
            <input
              class="field"
              id="tire-install-cost"
              type="number"
              step="0.01"
              min="0"
              name="cost_cents"
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-install-wear"
              >{$t("tires.wearPercentLabel")}</label
            >
            <input
              class="field"
              id="tire-install-wear"
              type="number"
              min="0"
              max="100"
              name="wear_percent"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-install-change"
              >{$t("tires.estimatedChangeKmLabel")}</label
            >
            <input
              class="field"
              id="tire-install-change"
              type="number"
              min="0"
              name="estimated_change_km"
            />
          </div>
        </div>
        <label class="switch">
          <input type="checkbox" name="is_active" value="true" checked />
          <span class="switch-track" aria-hidden="true"></span>
          <span class="text-sm text-[var(--muted)]"
            >{$t("tires.isActiveLabel")}</span
          >
        </label>
      </div>
      <button
        class="button-primary relative"
        type="submit"
        disabled={!hasMotorcycles || formBusy}
        >{$t("tires.installAction")}</button
      >
    </form>

    <div class="panel grid gap-3 p-5">
      <form
        class="grid gap-3"
        method="POST"
        action="?/savePressure"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">{$t("tires.pressureFormTitle")}</h2>
        <label class="field-label" for="tire-pressure-motorcycle"
          >{$t("tires.motorcycleLabel")}</label
        >
        <select
          class="field"
          id="tire-pressure-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          {#each data.motorcycles as moto (moto.id)}
            <option value={moto.id}>{moto.name}</option>
          {/each}
        </select>
        <label class="field-label" for="tire-pressure-date"
          >{$t("tires.dateLabel")}</label
        >
        <input
          class="field"
          id="tire-pressure-date"
          type="date"
          name="date"
          required
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-pressure-front"
              >{$t("tires.psiFront")}</label
            >
            <input
              class="field"
              id="tire-pressure-front"
              type="number"
              step="0.5"
              min="0"
              name="psi_front"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-pressure-rear"
              >{$t("tires.psiRear")}</label
            >
            <input
              class="field"
              id="tire-pressure-rear"
              type="number"
              step="0.5"
              min="0"
              name="psi_rear"
              required
            />
          </div>
        </div>
        <button
          class="button-secondary"
          type="submit"
          disabled={!hasMotorcycles || formBusy}
          >{$t("tires.pressureFormTitle")}</button
        >
      </form>

      <div class="border-t border-[var(--line)] pt-3">
        <h3 class="font-bold">{$t("tires.pressureHeading")}</h3>
        <ul class="mt-2 grid gap-2">
          {#each data.pressures.slice(0, 8) as pressure (pressure.id)}
            <li class="flex items-center justify-between gap-3 text-sm">
              <span class="min-w-0 break-words"
                >{pressure.motorcycles?.name ?? "—"} · {pressure.date} ·
                <strong>{pressure.psi_front}/{pressure.psi_rear}</strong>
                PSI</span
              >
              <form
                method="POST"
                action="?/deletePressure"
                use:enhance={enhanceDelete}
              >
                <input type="hidden" name="id" value={String(pressure.id)} />
                <button
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  disabled={formBusy}>{$t("common.delete")}</button
                >
              </form>
            </li>
          {:else}
            <li class="text-sm text-[var(--muted)]">
              {$t("tires.pressureEmpty")}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>

  <div class="panel overflow-hidden">
    <h2 class="display px-4 pt-4 text-xl">{$t("tires.historyHeading")}</h2>
    <div class="tire-table-scroll mt-3 overflow-x-auto">
      <table class="tire-table w-full text-left text-sm">
        <thead
          class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"
        >
          <tr>
            <th class="px-4 py-3">{$t("tires.dateLabel")}</th>
            <th>{$t("tires.positionLabel")}</th>
            <th>{$t("tires.brandModelLabel")}</th>
            <th>{$t("tires.motorcycleLabel")}</th>
            <th>{$t("tires.wearPercentLabel")}</th>
            <th>{$t("tires.costLabel")}</th>
            <th>{$t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {#each historyTires as tire (tire.id)}
            <tr class="border-b border-[var(--line)]">
              <td class="px-4 py-3" data-label={$t("tires.dateLabel")}
                >{String(tire.installed_at)}</td
              >
              <td data-label={$t("tires.positionLabel")}
                >{positionLabel(tire.position)}</td
              >
              <td data-label={$t("tires.brandModelLabel")}
                >{String(tire.brand_model ?? "—")}</td
              >
              <td data-label={$t("tires.motorcycleLabel")}
                >{String(tire.motorcycle_name ?? "—")}</td
              >
              <td data-label={$t("tires.wearPercentLabel")}
                >{tire.wear_percent == null
                  ? "—"
                  : `${Number(tire.wear_percent)}%`}</td
              >
              <td data-label={$t("tires.costLabel")}
                >{brl(Number(tire.cost_cents ?? 0))}</td
              >
              <td class="tire-actions" data-label={$t("common.actions")}>
                <form method="POST" use:enhance={enhanceDelete}>
                  <input type="hidden" name="_intent" value="delete" />
                  <input type="hidden" name="id" value={String(tire.id)} />
                  <button
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    type="submit"
                    disabled={formBusy}>{$t("common.delete")}</button
                  >
                </form>
              </td>
            </tr>
            <tr class="border-b border-[var(--line)]">
              <td colspan="7" class="px-4 pb-3">
                <details>
                  <summary
                    class="focus-ring flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                    >{$t("tires.editRecord")}</summary
                  >
                  <form
                    class="mt-2 grid gap-3 md:grid-cols-3"
                    method="POST"
                    use:enhance={enhanceWithStatus}
                  >
                    <input type="hidden" name="_intent" value="update" />
                    <input type="hidden" name="id" value={String(tire.id)} />
                    <input
                      type="hidden"
                      name="motorcycle_id"
                      value={String(tire.motorcycle_id ?? "")}
                    />
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-date`}
                        >{$t("tires.dateLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-date`}
                        type="date"
                        name="installed_at"
                        value={String(tire.installed_at ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`edit-${tire.id}-position`}
                        >{$t("tires.positionLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-position`}
                        name="position"
                        value={String(tire.position ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-brand`}
                        >{$t("tires.brandModelLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-brand`}
                        name="brand_model"
                        value={String(tire.brand_model ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-km`}
                        >{$t("tires.installedKmLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-km`}
                        type="number"
                        name="installed_odometer_km"
                        value={String(tire.installed_odometer_km ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-cost`}
                        >{$t("tires.costLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-cost`}
                        type="number"
                        step="0.01"
                        name="cost_cents"
                        value={Number(tire.cost_cents ?? 0) / 100}
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-wear`}
                        >{$t("tires.wearPercentLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-wear`}
                        type="number"
                        min="0"
                        max="100"
                        name="wear_percent"
                        value={String(tire.wear_percent ?? "")}
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${tire.id}-change`}
                        >{$t("tires.estimatedChangeKmLabel")}</label
                      >
                      <input
                        class="field"
                        id={`edit-${tire.id}-change`}
                        type="number"
                        name="estimated_change_km"
                        value={String(tire.estimated_change_km ?? "")}
                      />
                    </div>
                    <label class="switch items-end">
                      <input
                        type="checkbox"
                        name="is_active"
                        value="true"
                        checked={tire.is_active === true}
                      />
                      <span class="switch-track" aria-hidden="true"></span>
                      <span class="text-sm text-[var(--muted)]"
                        >{$t("tires.isActiveLabel")}</span
                      >
                    </label>
                    <div class="flex items-end">
                      <button
                        class="button-primary"
                        type="submit"
                        disabled={formBusy}>{$t("common.saveChanges")}</button
                      >
                    </div>
                  </form>
                </details>
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

  <details class="panel p-5">
    <summary class="display cursor-pointer text-xl"
      >{$t("tires.catalogHeading")}</summary
    >
    <div class="mt-4 grid gap-6 lg:grid-cols-2">
      <form
        class="grid gap-3"
        method="POST"
        action="?/saveProduct"
        use:enhance={enhanceWithStatus}
      >
        <h3 class="font-bold">{$t("tires.catalogFormTitle")}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-product-manufacturer"
              >{$t("tires.manufacturerLabel")}</label
            >
            <input
              class="field"
              id="tire-product-manufacturer"
              name="manufacturer"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-product-model"
              >{$t("tires.modelLabel")}</label
            >
            <input
              class="field"
              id="tire-product-model"
              name="model_name"
              required
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="tire-product-type"
              >{$t("tires.tireTypeLabel")}</label
            >
            <input class="field" id="tire-product-type" name="tire_type" />
          </div>
          <div class="field-group">
            <label class="field-label" for="tire-product-price"
              >{$t("tires.priceLabel")}</label
            >
            <input
              class="field"
              id="tire-product-price"
              type="number"
              step="0.01"
              min="0"
              name="price"
            />
          </div>
        </div>
        <button
          class="button-secondary justify-self-start"
          type="submit"
          disabled={formBusy}>{$t("common.save")}</button
        >
      </form>

      <div class="grid gap-2">
        <h3 class="font-bold">{$t("tires.catalogHeading")}</h3>
        {#each data.products as product (product.id)}
          <div
            class="flex items-center justify-between gap-3 border-t border-[var(--line)] py-2 text-sm"
          >
            <span class="min-w-0 break-words"
              >{product.manufacturer}
              {product.model_name} ·
              {product.tire_type} ·
              {brl(Number(product.price_cents ?? 0))}</span
            >
            <form
              method="POST"
              action="?/deleteProduct"
              use:enhance={enhanceDelete}
            >
              <input type="hidden" name="id" value={String(product.id)} />
              <button
                class="button-danger min-h-11 px-3 py-1 text-xs"
                disabled={formBusy}>{$t("common.delete")}</button
              >
            </form>
          </div>
        {:else}
          <p class="text-sm text-[var(--muted)]">{$t("tires.catalogEmpty")}</p>
        {/each}
      </div>
    </div>
  </details>
</section>

<style>
  @media (max-width: 1279px) {
    .tire-table-scroll {
      overflow-x: visible;
    }

    .tire-table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .tire-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .tire-table tbody tr {
      display: block;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }

    .tire-table tbody tr td {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      padding: 0.75rem 1rem;
    }

    .tire-table tbody tr td::before {
      flex: 0 0 36%;
      min-width: 0;
      color: var(--muted);
      content: attr(data-label);
      font-family: "Barlow Condensed", Barlow, ui-sans-serif, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .tire-table tbody tr td > * {
      min-width: 0;
      max-width: 64%;
      overflow-wrap: anywhere;
    }

    .tire-table tbody tr td.tire-actions {
      display: block;
    }

    .tire-table tbody tr td.tire-actions::before {
      display: block;
      margin-bottom: 0.65rem;
    }
  }

  @media (min-width: 1280px) {
    .tire-table {
      min-width: 780px;
    }
  }
</style>
