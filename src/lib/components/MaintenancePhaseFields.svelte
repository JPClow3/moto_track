<script lang="ts">
  import { t, format } from "$lib/i18n/store";
  export let plans: Array<Record<string, unknown>> = [];
  export let planId = "";
  export let completedMilestone: number | string | null = null;
  export let fieldName = "completed_milestone";
  export let showPlanSelector = true;
  export let allowZero = false;
  $: selectedPlan = plans.find((p) => String(p.id) === planId);
  $: occurrenceOptions = (
    Array.isArray(selectedPlan?.occurrence_options)
      ? selectedPlan.occurrence_options
      : []
  ) as Array<{ ordinal: number; km: number | null; months: number | null }>;
</script>

{#if showPlanSelector}
  <label class="field-group">
    <span class="field-label">{$t("maintenance.optionalPlan")}</span>
    <select
      class="field"
      name="maintenance_plan_item_id"
      bind:value={planId}
      on:change={() => (completedMilestone = null)}
    >
      <option value="">{$t("maintenance.independentService")}</option>
      {#each plans.filter((p) => p.is_active !== false) as plan (String(plan.id))}
        <option value={String(plan.id)}>
          {String(plan.motorcycle_name ?? $t("maintenance.bikeFallback"))} · {String(
            plan.maintenance_type,
          )}
        </option>
      {/each}
    </select>
  </label>
{/if}
{#if selectedPlan?.is_relative_replacement}
  <input type="hidden" name={fieldName} value={completedMilestone ?? ""} />
  <p class="text-sm text-[var(--muted)]">
    {$t("maintenance.relativeReplacementDate")}
  </p>
{:else if selectedPlan?.is_phased_schedule}
  <label class="field-group">
    <span class="field-label"
      >{allowZero
        ? $t("maintenance.baselineServiceOccurrence")
        : $t("maintenance.completedReviewNumber")}</span
    >
    <select
      class="field"
      name={fieldName}
      bind:value={completedMilestone}
      required={!allowZero}
    >
      <option value="">{$t("maintenance.occurrenceUnknown")}</option>
      {#if allowZero}<option value={0}
          >{$t("maintenance.noPreviousService")}</option
        >{/if}
      {#each occurrenceOptions as option (option.ordinal)}
        <option value={option.ordinal}>
          {option.km !== null && option.months !== null
            ? $t("maintenance.occurrenceMilestone", {
                number: option.ordinal,
                km: $format.number(option.km),
                months: $format.number(option.months),
              })
            : option.km !== null
              ? $t("maintenance.occurrenceMileageOnly", {
                  number: option.ordinal,
                  km: $format.number(option.km),
                })
              : $t("maintenance.occurrenceCalendarOnly", {
                  number: option.ordinal,
                  months: $format.number(option.months ?? 0),
                })}
        </option>
      {/each}
    </select>
    <span class="field-help">
      {$t("maintenance.completedReviewHelp")}
    </span>
  </label>
{/if}
