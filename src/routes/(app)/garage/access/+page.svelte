<script lang="ts">
  import { enhance } from "$app/forms";
  import { format, t } from "$lib/i18n/store";
  import PageHeader from "$components/app/PageHeader.svelte";
  import type { GarageRole } from "$server/domain/garage-access";
  export let data;
  export let form;
  let busy = false;
  const roleName = (role: GarageRole) => $t(`sharing.${role}`);
</script>

<svelte:head><title>{$t("sharing.heading")} · Moto Track</title></svelte:head>
<div class="grid gap-6">
  <PageHeader title={$t("sharing.heading")} description={$t("sharing.scope")}>
    <svelte:fragment slot="actions"
      ><a class="button-secondary" href="/garage">{$t("nav.garage")}</a
      ></svelte:fragment
    >
  </PageHeader>
  {#if form?.message}<p class="panel p-4 text-danger" role="alert">
      {form.message}
    </p>{/if}
  {#if form?.ok}<p class="panel p-4" role="status">
      {$t("common.actionSuccess")}
    </p>{/if}
  <section class="panel grid gap-4 p-5" aria-labelledby="sharing-invite">
    <h2 class="display text-2xl" id="sharing-invite">{$t("sharing.invite")}</h2>
    <p class="text-sm text-[var(--muted)]">{$t("sharing.rolesHelp")}</p>
    <form
      class="grid gap-3 sm:grid-cols-3"
      method="POST"
      action="?/invite"
      use:enhance={() => {
        busy = true;
        return async ({ update }) => {
          busy = false;
          await update();
        };
      }}
    >
      <label class="field-group" for="sharing-email"
        ><span class="field-label">{$t("sharing.email")}</span><input
          class="field"
          id="sharing-email"
          name="email"
          type="email"
          maxlength="254"
          required
        /></label
      >
      <label class="field-group" for="sharing-role"
        ><span class="field-label">{$t("sharing.permission")}</span><select
          class="field"
          id="sharing-role"
          name="role"
          ><option value="viewer">{$t("sharing.viewer")}</option><option
            value="contributor">{$t("sharing.contributor")}</option
          ><option value="workshop">{$t("sharing.workshop")}</option></select
        ></label
      >
      <button class="button-primary self-end" type="submit" disabled={busy}
        >{$t("sharing.generate")}</button
      >
    </form>
    {#if form?.inviteUrl}
      <label class="field-group" for="sharing-url"
        ><span class="field-label">{$t("sharing.inviteUrl")}</span><input
          class="field"
          id="sharing-url"
          readonly
          value={form.inviteUrl}
          on:focus={(event) => event.currentTarget.select()}
        /></label
      >
      <p class="text-sm text-[var(--muted)]" role="status">
        {$t("sharing.linkHelp")}
      </p>
    {/if}
  </section>
  <section class="panel grid gap-4 p-5" aria-labelledby="sharing-members">
    <h2 class="display text-2xl" id="sharing-members">
      {$t("sharing.members")}
    </h2>
    {#each data.members as member}
      <form
        class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
        method="POST"
        action="?/revokeMember"
        use:enhance
      >
        <p class="min-w-0 break-all text-sm">
          {member.email} · {roleName(member.role)}
        </p>
        <input type="hidden" name="id" value={member.id} /><button
          class="button-secondary"
          type="submit">{$t("sharing.revoke")}</button
        >
      </form>
    {:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noMembers")}
      </p>{/each}
    {#each data.invitations as invitation}
      <form
        class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
        method="POST"
        action="?/revokeInvitation"
        use:enhance
      >
        <p class="min-w-0 break-all text-sm">
          {invitation.invited_email} · {roleName(invitation.role)} · {$format.date(
            invitation.expires_at,
          )}
        </p>
        <input type="hidden" name="id" value={invitation.id} /><button
          class="button-secondary"
          type="submit">{$t("sharing.cancelInvite")}</button
        >
      </form>
    {/each}
  </section>
  <section class="panel grid gap-4 p-5" aria-labelledby="sharing-received">
    <h2 class="display text-2xl" id="sharing-received">
      {$t("sharing.received")}
    </h2>
    {#each data.received as membership}
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
      >
        <a
          class="min-w-0 break-all font-semibold underline"
          href={`/garage/shared/${membership.id}`}
          >{membership.email} · {roleName(membership.role)}</a
        >
        <form method="POST" action="?/leave" use:enhance>
          <input type="hidden" name="id" value={membership.id} /><button
            class="button-secondary"
            type="submit">{$t("sharing.leave")}</button
          >
        </form>
      </div>
    {:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noReceived")}
      </p>{/each}
  </section>
  <section class="panel grid gap-3 p-5" aria-labelledby="sharing-activity">
    <h2 class="display text-2xl" id="sharing-activity">
      {$t("sharing.activity")}
    </h2>
    {#each data.activity as event}<p class="break-all text-sm">
        {$format.date(event.created_at)} · {event.email ??
          $t("sharing.deletedAccount")} · {event.record_table === "fuel_records"
          ? $t("nav.fuel")
          : $t("nav.maintenance")}
      </p>{:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noActivity")}
      </p>{/each}
  </section>
</div>
