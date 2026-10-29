<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t } from "$lib/i18n/store";
  import { showToast } from "$components/ui/toast";
  export let motorcycleId: string;
  export let currentKm: number;
  let busy = false;
  let reading: number | null = null;
  let message = "";
  const scan: SubmitFunction = () => {
    busy = true;
    reading = null;
    message = "";
    return async ({ result }) => {
      busy = false;
      if (result.type === "success" && result.data?.odometerScan) {
        reading = Number((result.data.odometerScan as { km: number }).km);
      } else {
        message =
          result.type === "failure"
            ? String(result.data?.message ?? $t("odometerScan.failed"))
            : $t("odometerScan.failed");
      }
    };
  };
  const save: SubmitFunction = () => {
    busy = true;
    message = "";
    return async ({ result, update }) => {
      busy = false;
      if (result.type === "success") {
        reading = null;
        showToast($t("common.actionSuccess"));
      } else
        message =
          result.type === "failure"
            ? String(result.data?.message ?? $t("odometerScan.failed"))
            : $t("odometerScan.failed");
      await update();
    };
  };
</script>

<details class="mt-3 rounded border border-[var(--line)] p-3">
  <summary class="cursor-pointer text-sm font-semibold"
    >{$t("odometerScan.heading")}</summary
  >
  <p class="mt-3 text-xs text-[var(--muted)]">{$t("odometerScan.help")}</p>
  <form
    class="mt-3 grid gap-3"
    method="POST"
    action="?/scanOdometer"
    enctype="multipart/form-data"
    use:enhance={scan}
  >
    <input type="hidden" name="motorcycle_id" value={motorcycleId} />
    <label class="grid gap-1 text-sm" for={`odometer-photo-${motorcycleId}`}
      >{$t("odometerScan.photo")}
      <input
        class="field w-full"
        id={`odometer-photo-${motorcycleId}`}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        required
      />
    </label>
    <button class="button-secondary min-h-11" type="submit" disabled={busy}
      >{busy ? $t("odometerScan.reading") : $t("odometerScan.scan")}</button
    >
  </form>
  {#if reading !== null}
    <form
      class="mt-3 grid gap-3"
      method="POST"
      action="?/updateOdometer"
      use:enhance={save}
    >
      <input type="hidden" name="motorcycle_id" value={motorcycleId} />
      <label class="grid gap-1 text-sm" for={`odometer-reading-${motorcycleId}`}
        >{$t("odometerScan.review")}
        <input
          class="field"
          id={`odometer-reading-${motorcycleId}`}
          type="number"
          inputmode="numeric"
          name="odometer_override_km"
          min="0"
          max="2147483647"
          step="1"
          value={reading}
          required
        />
      </label>
      {#if reading < currentKm}<p
          class="text-xs text-[var(--warning)]"
          role="status"
        >
          {$t("odometerScan.lower")}
        </p>{/if}
      <button class="button-primary min-h-11" type="submit" disabled={busy}
        >{$t("odometerScan.confirm")}</button
      >
    </form>
  {/if}
  {#if message}<p class="mt-3 text-sm text-[var(--danger)]" role="alert">
      {message}
    </p>{/if}
</details>
