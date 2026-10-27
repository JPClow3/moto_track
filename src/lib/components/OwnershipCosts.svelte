<script lang="ts">
  import { enhance } from "$app/forms";
  import { format, t } from "$lib/i18n/store";
  import type { ownershipSummary } from "$server/domain/ownership-report";
  let {
    motorcycles = [],
  }: { motorcycles?: ReturnType<typeof ownershipSummary>[] } = $props();

  /** User toggles stick per motorcycle; unset → default open when !ready. */
  let openByMotorcycleId = $state<Record<string, boolean>>({});

  function setupOpen(motorcycle: { id: string; ready: boolean }) {
    return openByMotorcycleId[motorcycle.id] ?? !motorcycle.ready;
  }

  function onSetupToggle(id: string, event: ToggleEvent) {
    const details = event.currentTarget as HTMLDetailsElement;
    openByMotorcycleId[id] = details.open;
  }
</script>

<section class="grid gap-4" aria-labelledby="ownership-heading">
  <h2 class="display text-2xl" id="ownership-heading">
    {$t("ownership.heading")}
  </h2>
  <p class="text-sm text-[var(--muted)]">{$t("ownership.help")}</p>
  {#if motorcycles.length === 0}
    <p class="text-sm text-[var(--muted)]">{$t("ownership.empty")}</p>
  {:else}
    <div class="grid gap-4 lg:grid-cols-2">
      {#each motorcycles as motorcycle (motorcycle.id)}
        <article class="panel grid content-start gap-4 p-5">
          <h3 class="display text-xl">{motorcycle.name}</h3>
          {#if motorcycle.ready}
            <p class="display text-3xl">
              {motorcycle.costPerKmCents === null
                ? "—"
                : `${$format.money(motorcycle.costPerKmCents)}/km`}
            </p>
            {#if motorcycle.costPerKmCents === null}
              <p class="text-sm text-[var(--muted)]">
                {$t("ownership.noDistance")}
              </p>
            {/if}
            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-[var(--muted)]">{$t("ownership.total")}</dt>
                <dd>{$format.money(motorcycle.totalCents)}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">{$t("ownership.distance")}</dt>
                <dd>
                  {$format.distance(Math.max(0, motorcycle.distanceKm ?? 0))}
                </dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">{$t("ownership.fuel")}</dt>
                <dd>{$format.money(Number(motorcycle.fuel_cents))}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">
                  {$t("ownership.maintenance")}
                </dt>
                <dd>{$format.money(Number(motorcycle.maintenance_cents))}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">{$t("ownership.tires")}</dt>
                <dd>{$format.money(Number(motorcycle.tire_cents))}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">{$t("ownership.fees")}</dt>
                <dd>{$format.money(Number(motorcycle.fee_cents))}</dd>
              </div>
            </dl>
          {:else}
            <p class="text-sm text-[var(--muted)]">
              {$t("ownership.missing")}
            </p>
          {/if}
          <details
            open={setupOpen(motorcycle)}
            ontoggle={(event) => onSetupToggle(motorcycle.id, event)}
          >
            <summary class="cursor-pointer text-sm font-semibold"
              >{$t("ownership.setup")}</summary
            >
            <form
              class="mt-4 grid gap-3"
              method="POST"
              action="?/saveOwnershipBasis"
              use:enhance
            >
              <input type="hidden" name="motorcycle_id" value={motorcycle.id} />
              <label class="field-group" for={`purchase-date-${motorcycle.id}`}
                ><span class="field-label">{$t("ownership.date")}</span><input
                  class="field"
                  id={`purchase-date-${motorcycle.id}`}
                  name="purchase_date"
                  type="date"
                  value={motorcycle.purchase_date ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                /></label
              >
              <label class="field-group" for={`purchase-km-${motorcycle.id}`}
                ><span class="field-label">{$t("ownership.mileage")}</span
                ><input
                  class="field"
                  id={`purchase-km-${motorcycle.id}`}
                  name="purchase_odometer_km"
                  type="number"
                  min="0"
                  max={motorcycle.current_odometer_km}
                  step="1"
                  value={motorcycle.purchase_odometer_km ?? ""}
                  required
                /></label
              >
              <label class="field-group" for={`purchase-price-${motorcycle.id}`}
                ><span class="field-label">{$t("ownership.price")}</span><input
                  class="field"
                  id={`purchase-price-${motorcycle.id}`}
                  name="purchase_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={motorcycle.purchase_price_cents === null
                    ? ""
                    : Number(motorcycle.purchase_price_cents) / 100}
                  required
                /></label
              >
              <button class="button-primary justify-self-start" type="submit"
                >{$t("common.save")}</button
              >
            </form>
          </details>
        </article>
      {/each}
    </div>
  {/if}
</section>
