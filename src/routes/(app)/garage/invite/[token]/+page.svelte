<script lang="ts">
  import { enhance } from "$app/forms";
  import { t } from "$lib/i18n/store";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  export let data;
  export let form;
</script>

<svelte:head><title>{$t("sharing.invite")} · Moto Track</title></svelte:head>
<section class="panel mx-auto grid max-w-xl gap-4 p-6">
  <h1 class="display text-3xl">{$t("sharing.invite")}</h1>
  <p class="text-sm text-[var(--muted)]">{$t("sharing.scope")}</p>
  <p class="flex flex-wrap items-center gap-2 text-sm">
    <span class="font-semibold text-[var(--fg-soft)]"
      >{$t("sharing.permission")}</span
    >
    <StatusBadge tone="info"
      >{$t(
        `sharing.${data.role}` as
          "sharing.viewer" | "sharing.contributor" | "sharing.workshop",
      )}</StatusBadge
    >
  </p>
  {#if form?.message}<p
      class="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
    >
      {form.message}
    </p>{/if}
  {#if data.matchesEmail}
    {#if !data.verified}
      <p class="text-sm text-[var(--muted)]">{$t("sharing.verifiedEmail")}</p>
      <form method="POST" action="?/sendVerification" use:enhance>
        <button class="button-secondary" type="submit"
          >{$t("sharing.sendVerification")}</button
        >
      </form>
      {#if form?.verificationSent}<p
          class="text-sm text-[var(--success)]"
          role="status"
        >
          {$t("sharing.codeSent")}
        </p>{/if}
      <form method="POST" action="?/verifyEmail" use:enhance class="grid gap-3">
        <label class="field-group" for="verify-code"
          ><span class="field-label">{$t("sharing.verificationCode")}</span
          ><input
            id="verify-code"
            class="field"
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern={"[0-9]{4,10}"}
            maxlength="10"
            required
          /></label
        >
        <button class="button-secondary" type="submit"
          >{$t("sharing.verifyEmail")}</button
        >
      </form>
    {/if}
    <form method="POST" action="?/accept" use:enhance>
      <button disabled={!data.verified} class="button-primary" type="submit"
        >{$t("sharing.accept")}</button
      >
    </form>
  {:else}<p
      class="rounded-md border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm"
      role="alert"
    >
      {$t("sharing.wrongEmail")}
    </p>{/if}
</section>
