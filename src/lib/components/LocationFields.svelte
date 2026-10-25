<script lang="ts">
  import { t } from "$lib/i18n/store";
  export let id = "location";
  export let latitude = "";
  export let longitude = "";
  let busy = false;
  let message = "";
  function locate() {
    message = "";
    if (!navigator.geolocation) {
      message = $t("nearby.unavailable");
      return;
    }
    busy = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude.toFixed(6);
        longitude = position.coords.longitude.toFixed(6);
        busy = false;
      },
      () => {
        busy = false;
        message = $t("nearby.denied");
      },
      { timeout: 15000, maximumAge: 60000 },
    );
  }
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <div class="field-group">
    <label class="field-label" for={`${id}-latitude`}
      >{$t("nearby.latitude")}</label
    >
    <input
      class="field"
      id={`${id}-latitude`}
      name="latitude"
      type="number"
      min="-90"
      max="90"
      step="any"
      value={latitude}
      on:input={(event) => (latitude = event.currentTarget.value)}
    />
  </div>
  <div class="field-group">
    <label class="field-label" for={`${id}-longitude`}
      >{$t("nearby.longitude")}</label
    >
    <input
      class="field"
      id={`${id}-longitude`}
      name="longitude"
      type="number"
      min="-180"
      max="180"
      step="any"
      value={longitude}
      on:input={(event) => (longitude = event.currentTarget.value)}
    />
  </div>
</div>
<button
  class="button-secondary justify-self-start"
  type="button"
  disabled={busy}
  on:click={locate}
  >{busy ? $t("nearby.locating") : $t("nearby.useLocation")}</button
>
{#if message}<p class="text-sm text-danger" role="alert">{message}</p>{/if}
