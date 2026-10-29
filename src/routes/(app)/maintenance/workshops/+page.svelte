<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { format, locale } from "$lib/i18n/store";
  import { workshopMessages } from "$lib/i18n/workshop-comparison";
  import PageHeader from "$components/app/PageHeader.svelte";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { Workshop } from "$components/icons";
  import type { ActionData, PageData } from "./$types";

  export let data: PageData;
  export let form: ActionData;
  let recordId = "";
  let laborAmount = "";
  let city = "";
  let state = "";
  let consent = false;
  let busy = false;
  let confirmDialog: ConfirmDialog;
  $: text = workshopMessages($locale);
  $: selected = data.records.find((record) => record.id === recordId);
  $: services = [
    ...new Set(data.records.map((record) => record.maintenance_type)),
  ];
  $: if (form && "values" in form && form.values) {
    recordId = form.values.recordId;
    laborAmount = form.values.laborAmount;
    city = form.values.city;
    state = form.values.state;
    consent = false;
  }

  /** Labor is a text input (inputmode="decimal"): show the rider's own
   *  separator. The server accepts "50,25" and "50.25". */
  function laborValue(cents: number) {
    const value = (cents / 100).toFixed(2);
    return $locale === "en" ? value : value.replace(".", ",");
  }

  function review(contribution: PageData["contributions"][number]) {
    recordId = contribution.record_id;
    laborAmount = laborValue(contribution.labor_cents);
    city = contribution.city_name;
    state = contribution.state_code;
    consent = false;
    document
      .getElementById("workshop-contribute")
      ?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("workshop-labor")?.focus({ preventScroll: true });
  }

  const enhanceContribute: SubmitFunction = () => {
    busy = true;
    return async ({ result, update }) => {
      busy = false;
      consent = false;
      if (result.type === "success") showToast(text.saved);
      await update({ reset: false });
    };
  };

  const enhanceWithdraw: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(text.withdrawConfirm);
    if (!ok) {
      cancel();
      return;
    }
    busy = true;
    return async ({ result, update }) => {
      busy = false;
      if (result.type === "success") showToast(text.withdrawn);
      await update();
    };
  };
</script>

<svelte:head><title>{text.title} · Moto Track</title></svelte:head>

<div class="grid gap-6">
  <PageHeader title={text.title} description={text.subtitle}>
    <svelte:fragment slot="actions"
      ><a class="button-secondary min-h-11" href="/maintenance">{text.back}</a
      ></svelte:fragment
    >
  </PageHeader>

  <ConfirmDialog bind:this={confirmDialog} confirmLabel={text.withdraw} />

  <div class="panel grid gap-2 p-5 text-sm text-[var(--muted)]">
    <p>{text.privacy}</p>
    <p>{text.method}</p>
  </div>
  {#if data.loadError}
    <p
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
    >
      {text.loadError}
    </p>
  {/if}
  {#if form && "message" in form}
    <p
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
    >
      {form.message}
    </p>
  {/if}

  <section class="panel grid gap-4 p-5" aria-labelledby="workshop-search-title">
    <h2 class="display text-2xl" id="workshop-search-title">
      {text.searchTitle}
    </h2>
    <form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="field-group">
        <label class="field-label" for="workshop-search-service"
          >{text.service}</label
        >
        <input
          class="field"
          id="workshop-search-service"
          name="service"
          list="workshop-services"
          value={data.filters.service}
          minlength="2"
          maxlength="120"
          required
          aria-describedby="workshop-service-help"
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="workshop-search-city">{text.city}</label
        >
        <input
          class="field"
          id="workshop-search-city"
          name="city"
          value={data.filters.city}
          minlength="2"
          maxlength="120"
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="workshop-search-state"
          >{text.state}</label
        >
        <select
          class="field"
          id="workshop-search-state"
          name="state"
          value={data.filters.state}
          required
        >
          <option value="">{text.chooseState}</option>
          {#each data.states as uf (uf)}<option value={uf}>{uf}</option>{/each}
        </select>
      </div>
      <button
        class="button-primary min-h-11 self-end"
        type="submit"
        disabled={data.loadError}>{text.search}</button
      >
    </form>
    <datalist id="workshop-services">
      {#each services as service (service)}<option value={service}
        ></option>{/each}
    </datalist>
    <p class="text-sm text-[var(--muted)]" id="workshop-service-help">
      {text.serviceHelp}
    </p>
    {#if !data.loadError}
      {#if !data.requested}
        <p class="text-sm text-[var(--muted)]">{text.start}</p>
      {:else if !data.validSearch}
        <p class="text-sm text-[var(--danger)]" role="alert">
          {text.invalidSearch}
        </p>
      {:else if !data.summaries.length}
        <div role="status">
          <EmptyState
            compact
            icon={Workshop}
            title={text.noComparisonTitle}
            description={text.insufficient}
          />
        </div>
      {:else}
        <div class="data-table sm:overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead
              class="border-b border-[var(--line)] bg-[var(--accent-wash)] text-[var(--muted)]"
            >
              <tr>
                <th class="p-3 font-semibold">{text.workshop}</th>
                <th class="p-3 font-semibold">{text.average}</th>
                <th class="p-3 font-semibold">{text.accounts}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.summaries as summary, index (index)}
                <tr class="border-b border-[var(--line)]">
                  <td
                    class="break-words p-3 font-semibold"
                    data-label={text.workshop}>{summary.workshop}</td
                  >
                  <td
                    class="numeric whitespace-nowrap p-3"
                    data-label={text.average}
                    >{$format.money(summary.averageLaborCents)}</td
                  >
                  <td class="numeric p-3" data-label={text.accounts}
                    >{$format.number(summary.accounts)}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </section>

  <section
    class="panel grid gap-4 p-5"
    id="workshop-contribute"
    aria-labelledby="workshop-contribute-title"
  >
    <h2 class="display text-2xl" id="workshop-contribute-title">
      {text.participateTitle}
    </h2>
    {#if data.records.length}
      <p class="text-sm text-[var(--muted)]">{text.participateHelp}</p>
      <form
        class="grid gap-4"
        method="POST"
        action="?/contribute"
        use:enhance={enhanceContribute}
      >
        <div class="field-group">
          <label class="field-label" for="workshop-record">{text.record}</label>
          <select
            class="field"
            id="workshop-record"
            name="record_id"
            bind:value={recordId}
            required
            on:change={() => {
              consent = false;
              laborAmount = "";
            }}
          >
            <option value="">{text.chooseRecord}</option>
            {#each data.records as record (record.id)}<option value={record.id}
                >{$format.date(record.date)} · {record.maintenance_type} · {record.workshop}</option
              >{/each}
          </select>
        </div>
        {#if selected}<p class="text-sm">
            {text.total}:
            <strong class="numeric">{$format.money(selected.cost_cents)}</strong
            >
          </p>{/if}
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="field-group">
            <label class="field-label" for="workshop-labor">{text.labor}</label>
            <input
              class="field"
              id="workshop-labor"
              name="labor_amount"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              pattern={"\\d{1,5}([.,]\\d{1,2})?"}
              value={laborAmount}
              on:input={(event) => {
                laborAmount = event.currentTarget.value;
                consent = false;
              }}
              required
              aria-describedby="workshop-labor-help"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="workshop-city">{text.city}</label>
            <input
              class="field"
              id="workshop-city"
              name="city"
              bind:value={city}
              minlength="2"
              maxlength="120"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="workshop-state">{text.state}</label>
            <select
              class="field"
              id="workshop-state"
              name="state"
              bind:value={state}
              required
            >
              <option value="">{text.chooseState}</option>
              {#each data.states as uf (uf)}<option value={uf}>{uf}</option
                >{/each}
            </select>
          </div>
        </div>
        <p class="text-sm text-[var(--muted)]" id="workshop-labor-help">
          {text.laborHelp}
        </p>
        <label class="flex items-start gap-3 text-sm" for="workshop-consent"
          ><input
            class="mt-1 shrink-0"
            id="workshop-consent"
            type="checkbox"
            name="consent"
            bind:checked={consent}
            required
          /><span>{text.consent}</span></label
        >
        <button
          class="button-primary min-h-11 justify-self-start"
          type="submit"
          disabled={busy || data.loadError}>{text.save}</button
        >
      </form>
    {:else}
      <EmptyState
        compact
        icon={Workshop}
        title={text.noRecordsTitle}
        description={text.noRecords}
      >
        {#snippet action()}
          <a class="button-primary min-h-11" href="/maintenance?new=1"
            >{text.logService}</a
          >
        {/snippet}
      </EmptyState>
    {/if}
  </section>

  <section class="panel grid gap-4 p-5" aria-labelledby="workshop-own-title">
    <h2 class="display text-2xl" id="workshop-own-title">{text.ownTitle}</h2>
    {#each data.contributions as contribution (contribution.record_id)}
      <div
        class="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[1fr_auto]"
      >
        <div class="min-w-0">
          <h3 class="break-words font-semibold">
            {contribution.workshop_name} · {contribution.source_service}
          </h3>
          <p class="text-sm">
            {contribution.city_name}/{contribution.state_code} · {$format.date(
              contribution.serviced_on,
            )} ·
            <span class="numeric"
              >{$format.money(contribution.labor_cents)}</span
            >
          </p>
          {#if contribution.current}
            <StatusBadge class="mt-2" tone="ok">{text.active}</StatusBadge>
          {:else}
            <p class="mt-1 text-sm text-[var(--warning)]">{text.changed}</p>
          {/if}
        </div>
        <div class="flex flex-wrap items-start gap-2">
          <button
            class="button-secondary min-h-11"
            type="button"
            on:click={() => review(contribution)}
            disabled={!data.records.some(
              (record) => record.id === contribution.record_id,
            )}>{text.edit}</button
          >
          <form method="POST" action="?/withdraw" use:enhance={enhanceWithdraw}>
            <input
              type="hidden"
              name="record_id"
              value={contribution.record_id}
            /><button
              class="button-danger min-h-11"
              type="submit"
              disabled={busy}>{text.withdraw}</button
            >
          </form>
        </div>
      </div>
    {:else}
      <EmptyState compact icon={Workshop} title={text.noContributions} />
    {/each}
  </section>
</div>
