<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { format, t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import PageHeader from "$components/app/PageHeader.svelte";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import Users from "lucide-svelte/icons/users";
  import Copy from "lucide-svelte/icons/copy";
  import type { GarageRole } from "$server/domain/garage-access";
  export let data;
  export let form;
  let busy = false;
  let pendingId = "";
  let confirmDialog: ConfirmDialog;
  const roleName = (role: GarageRole) => $t(`sharing.${role}`);

  $: hasPeople = data.members.length > 0 || data.invitations.length > 0;
  $: nothingShared =
    !hasPeople && !data.received.length && !data.activity.length;

  const inviteEnhance: SubmitFunction = () => {
    busy = true;
    return async ({ result, update }) => {
      busy = false;
      await update();
      if (result.type === "success") showToast($t("garageUx.inviteCreated"));
    };
  };

  // Row actions: optional confirmation, then a toast on success. Cancelling a
  // pending invite is cheap to redo, so it skips the dialog.
  function rowAction(
    id: string,
    success: MessageKey,
    confirmKey?: MessageKey,
  ): SubmitFunction {
    return async ({ cancel }) => {
      if (confirmKey && !(await confirmDialog.ask($t(confirmKey)))) {
        cancel();
        return;
      }
      pendingId = id;
      return async ({ result, update }) => {
        pendingId = "";
        await update();
        if (result.type === "success") showToast($t(success));
      };
    };
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast($t("garageUx.linkCopied"));
    } catch {
      (
        document.getElementById("sharing-url") as HTMLInputElement | null
      )?.select();
    }
  }

  const thClass = "label-tech px-4 py-2 font-semibold text-[var(--muted)]";
  const tdClass = "px-4 py-3 align-middle";
</script>

<svelte:head><title>{$t("sharing.heading")} · Moto Track</title></svelte:head>
<div class="grid gap-6">
  <PageHeader title={$t("sharing.heading")} description={$t("sharing.scope")}>
    <svelte:fragment slot="actions"
      ><a class="button-secondary" href="/garage">{$t("nav.garage")}</a
      ></svelte:fragment
    >
  </PageHeader>

  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.confirm")}
  />

  {#if form?.message}<p
      class="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
      role="alert"
    >
      {form.message}
    </p>{/if}

  <!-- The one thing people come here to do leads the page. -->
  <section class="panel grid gap-4 p-5 sm:p-6" aria-labelledby="sharing-invite">
    <div>
      <h2 class="display text-2xl" id="sharing-invite">
        {$t("sharing.invite")}
      </h2>
      <p class="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        {$t("sharing.rolesHelp")}
      </p>
    </div>
    <form
      class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
      method="POST"
      action="?/invite"
      use:enhance={inviteEnhance}
    >
      <div class="field-group">
        <label class="field-label" for="sharing-email"
          >{$t("sharing.email")}</label
        >
        <input
          class="field"
          id="sharing-email"
          name="email"
          type="email"
          inputmode="email"
          autocomplete="off"
          placeholder={$t("garageUx.emailPlaceholder")}
          maxlength="254"
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="sharing-role"
          >{$t("sharing.permission")}</label
        >
        <select class="field" id="sharing-role" name="role"
          ><option value="viewer">{$t("sharing.viewer")}</option><option
            value="contributor">{$t("sharing.contributor")}</option
          ><option value="workshop">{$t("sharing.workshop")}</option></select
        >
      </div>
      <button class="button-primary" type="submit" disabled={busy}
        >{$t("sharing.generate")}</button
      >
    </form>
    {#if form?.inviteUrl}
      <div
        class="grid gap-2 rounded-md border border-[var(--line)] bg-[var(--panel-sunken)] p-4"
      >
        <label class="field-label" for="sharing-url"
          >{$t("sharing.inviteUrl")}</label
        >
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            class="field numeric min-w-0 flex-1"
            id="sharing-url"
            readonly
            value={form.inviteUrl}
            on:focus={(event) => event.currentTarget.select()}
          />
          <button
            class="button-secondary shrink-0"
            type="button"
            on:click={() => copyInvite(String(form?.inviteUrl ?? ""))}
          >
            <Copy size={16} aria-hidden="true" />
            {$t("garageUx.copyLink")}
          </button>
        </div>
        <p class="text-sm text-[var(--muted)]" role="status">
          {$t("sharing.linkHelp")}
        </p>
      </div>
    {/if}
  </section>

  {#if nothingShared}
    <EmptyState
      compact
      icon={Users}
      title={$t("garageUx.nothingSharedTitle")}
      description={$t("garageUx.nothingSharedDescription")}
    />
  {/if}

  {#if hasPeople}
    <section class="panel overflow-hidden" aria-labelledby="sharing-members">
      <h2 class="display px-5 pb-3 pt-5 text-xl" id="sharing-members">
        {$t("sharing.members")}
      </h2>
      <div class="data-table">
        <table class="w-full text-left text-sm">
          <thead class="border-y border-[var(--line)] bg-[var(--panel-sunken)]">
            <tr>
              <th class={thClass} scope="col">{$t("garageUx.person")}</th>
              <th class={thClass} scope="col">{$t("sharing.permission")}</th>
              <th class={thClass} scope="col">{$t("garageUx.status")}</th>
              <th class="{thClass} text-right" scope="col"
                ><span class="sr-only">{$t("common.actions")}</span></th
              >
            </tr>
          </thead>
          <tbody>
            {#each data.members as member (member.id)}
              <tr class="border-b border-[var(--line)] last:border-b-0">
                <td
                  class="{tdClass} break-all"
                  data-label={$t("garageUx.person")}>{member.email}</td
                >
                <td class={tdClass} data-label={$t("sharing.permission")}
                  >{roleName(member.role)}</td
                >
                <td class={tdClass} data-label={$t("garageUx.status")}
                  ><StatusBadge tone="ok"
                    >{$t("garageUx.activeAccess")}</StatusBadge
                  ></td
                >
                <td class="{tdClass} text-right">
                  <form
                    method="POST"
                    action="?/revokeMember"
                    use:enhance={rowAction(
                      member.id,
                      "garageUx.accessRevoked",
                      "garageUx.revokeConfirm",
                    )}
                  >
                    <input type="hidden" name="id" value={member.id} /><button
                      class="button-danger"
                      type="submit"
                      disabled={pendingId === member.id}
                      >{$t("sharing.revoke")}</button
                    >
                  </form>
                </td>
              </tr>
            {/each}
            {#each data.invitations as invitation (invitation.id)}
              <tr class="border-b border-[var(--line)] last:border-b-0">
                <td
                  class="{tdClass} break-all"
                  data-label={$t("garageUx.person")}
                  >{invitation.invited_email}</td
                >
                <td class={tdClass} data-label={$t("sharing.permission")}
                  >{roleName(invitation.role)}</td
                >
                <td class={tdClass} data-label={$t("garageUx.status")}>
                  <span
                    class="inline-flex flex-col items-end gap-1 sm:items-start"
                  >
                    <StatusBadge tone="info"
                      >{$t("garageUx.pendingInvite")}</StatusBadge
                    >
                    <span class="text-xs text-[var(--muted)]"
                      >{$t("garageUx.expiresOn", {
                        date: $format.date(invitation.expires_at),
                      })}</span
                    >
                  </span>
                </td>
                <td class="{tdClass} text-right">
                  <form
                    method="POST"
                    action="?/revokeInvitation"
                    use:enhance={rowAction(
                      invitation.id,
                      "garageUx.inviteCancelled",
                    )}
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={invitation.id}
                    /><button
                      class="button-secondary"
                      type="submit"
                      disabled={pendingId === invitation.id}
                      >{$t("sharing.cancelInvite")}</button
                    >
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if data.received.length}
    <section class="panel grid gap-1 p-5" aria-labelledby="sharing-received">
      <h2 class="display mb-2 text-xl" id="sharing-received">
        {$t("sharing.received")}
      </h2>
      {#each data.received as membership (membership.id)}
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-3"
        >
          <a
            class="focus-ring min-w-0 break-all rounded font-semibold text-[var(--fg)] underline underline-offset-4 hover:text-[var(--fg-hover)]"
            href={`/garage/shared/${membership.id}`}
            >{membership.email}
            <span class="font-normal text-[var(--muted)]"
              >· {roleName(membership.role)}</span
            ></a
          >
          <form
            method="POST"
            action="?/leave"
            use:enhance={rowAction(
              membership.id,
              "garageUx.leftGarage",
              "garageUx.leaveConfirm",
            )}
          >
            <input type="hidden" name="id" value={membership.id} /><button
              class="button-danger"
              type="submit"
              disabled={pendingId === membership.id}
              >{$t("sharing.leave")}</button
            >
          </form>
        </div>
      {/each}
    </section>
  {/if}

  {#if data.activity.length}
    <section class="panel overflow-hidden" aria-labelledby="sharing-activity">
      <h2 class="display px-5 pb-3 pt-5 text-xl" id="sharing-activity">
        {$t("sharing.activity")}
      </h2>
      <div class="data-table">
        <table class="w-full text-left text-sm">
          <thead class="border-y border-[var(--line)] bg-[var(--panel-sunken)]">
            <tr>
              <th class={thClass} scope="col">{$t("garageUx.date")}</th>
              <th class={thClass} scope="col">{$t("garageUx.person")}</th>
              <th class={thClass} scope="col">{$t("garageUx.recordType")}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.activity as event (event.id)}
              <tr class="border-b border-[var(--line)] last:border-b-0">
                <td class="{tdClass} numeric" data-label={$t("garageUx.date")}
                  >{$format.date(event.created_at)}</td
                >
                <td
                  class="{tdClass} break-all"
                  data-label={$t("garageUx.person")}
                  >{event.email ?? $t("sharing.deletedAccount")}</td
                >
                <td class={tdClass} data-label={$t("garageUx.recordType")}
                  >{event.record_table === "fuel_records"
                    ? $t("nav.fuel")
                    : $t("nav.maintenance")}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>
