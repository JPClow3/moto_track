<script lang="ts">
  import { enhance } from "$app/forms";
  import { format, locale } from "$lib/i18n/store";
  import { workshopMessages } from "$lib/i18n/workshop-comparison";
  import PageHeader from "$components/app/PageHeader.svelte";
  import type { ActionData, PageData } from "./$types";

  export let data: PageData;
  export let form: ActionData;
  let recordId = "";
  let laborAmount = "";
  let city = "";
  let state = "";
  let consent = false;
  let busy = false;
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

  function review(contribution: PageData["contributions"][number]) {
    recordId = contribution.record_id;
    laborAmount = (contribution.labor_cents / 100).toFixed(2);
    city = contribution.city_name;
    state = contribution.state_code;
    consent = false;
    document
      .getElementById("workshop-contribute")
      ?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("workshop-labor")?.focus({ preventScroll: true });
  }
</script>

<svelte:head><title>{text.title} · Moto Track</title></svelte:head>

<div class="grid gap-6">
  <PageHeader title={text.title} description={text.subtitle}>
    <svelte:fragment slot="actions"
      ><a class="button-secondary" href="/maintenance">{text.back}</a
      ></svelte:fragment
    >
  </PageHeader>
  <div class="panel grid gap-2 p-5 text-sm text-[var(--muted)]">
    <p>{text.privacy}</p>
    <p>{text.method}</p>
  </div>
  {#if data.loadError}<p class="panel p-4 text-danger" role="alert">
      {text.loadError}
    </p>{/if}
  {#if form && "message" in form}<p class="panel p-4 text-danger" role="alert">
      {form.message}
    </p>{/if}
  {#if form && "saved" in form}<p class="panel p-4" role="status">
      {text.saved}
    </p>{/if}
  {#if form && "withdrawn" in form}<p class="panel p-4" role="status">
      {text.withdrawn}
    </p>{/if}

  <section class="panel grid gap-4 p-5" aria-labelledby="workshop-search-title">
    <h2 class="display text-2xl" id="workshop-search-title">
      {text.searchTitle}
    </h2>
    <form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label class="field-group" for="workshop-search-service"
        ><span class="field-label">{text.service}</span><input
          class="field"
          id="workshop-search-service"
          name="service"
          list="workshop-services"
          value={data.filters.service}
          minlength="2"
          maxlength="120"
          required
          aria-describedby="workshop-service-help"
        /></label
      >
      <label class="field-group" for="workshop-search-city"
        ><span class="field-label">{text.city}</span><input
          class="field"
          id="workshop-search-city"
          name="city"
          value={data.filters.city}
          minlength="2"
          maxlength="120"
          required
        /></label
      >
      <label class="field-group" for="workshop-search-state"
        ><span class="field-label">{text.state}</span><select
          class="field"
          id="workshop-search-state"
          name="state"
          value={data.filters.state}
          required
          ><option value="">{text.chooseState}</option
          >{#each data.states as uf}<option value={uf}>{uf}</option
            >{/each}</select
        ></label
      >
      <button
        class="button-primary self-end"
        type="submit"
        disabled={data.loadError}>{text.search}</button
      >
    </form>
    <datalist id="workshop-services"
      >{#each services as service}<option value={service}
        ></option>{/each}</datalist
    >
    <p class="text-sm text-[var(--muted)]" id="workshop-service-help">
      {text.serviceHelp}
    </p>
    {#if !data.loadError}
      {#if !data.requested}<p class="text-sm text-[var(--muted)]">
          {text.start}
        </p>
      {:else if !data.validSearch}<p class="text-sm text-danger" role="alert">
          {text.invalidSearch}
        </p>
      {:else if !data.summaries.length}<p
          class="rounded-xl border border-[var(--line)] p-4 text-sm"
          role="status"
        >
          {text.insufficient}
        </p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead
              ><tr class="border-b border-[var(--line)]"
                ><th class="p-3">{text.workshop}</th><th class="p-3"
                  >{text.average}</th
                ><th class="p-3">{text.accounts}</th></tr
              ></thead
            ><tbody
              >{#each data.summaries as summary}<tr
                  class="border-b border-[var(--line)]"
                  ><td class="break-words p-3 font-semibold"
                    >{summary.workshop}</td
                  ><td class="whitespace-nowrap p-3"
                    >{$format.money(summary.averageLaborCents)}</td
                  ><td class="p-3">{$format.number(summary.accounts)}</td></tr
                >{/each}</tbody
            >
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
    <p class="text-sm text-[var(--muted)]">{text.participateHelp}</p>
    {#if data.records.length}
      <form
        class="grid gap-4"
        method="POST"
        action="?/contribute"
        use:enhance={() => {
          busy = true;
          return async ({ update }) => {
            busy = false;
            consent = false;
            await update({ reset: false });
          };
        }}
      >
        <label class="field-group" for="workshop-record"
          ><span class="field-label">{text.record}</span><select
            class="field"
            id="workshop-record"
            name="record_id"
            bind:value={recordId}
            required
            on:change={() => {
              consent = false;
              laborAmount = "";
            }}
            ><option value="">{text.chooseRecord}</option
            >{#each data.records as record}<option value={record.id}
                >{$format.date(record.date)} · {record.maintenance_type} · {record.workshop}</option
              >{/each}</select
          ></label
        >
        {#if selected}<p class="text-sm">
            {text.total}: <strong>{$format.money(selected.cost_cents)}</strong>
          </p>{/if}
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="field-group" for="workshop-labor"
            ><span class="field-label">{text.labor}</span><input
              class="field"
              id="workshop-labor"
              name="labor_amount"
              type="number"
              inputmode="decimal"
              min="0.01"
              max={selected
                ? Math.min(selected.cost_cents / 100, 10000)
                : 10000}
              step="0.01"
              value={laborAmount}
              on:input={(event) => {
                laborAmount = event.currentTarget.value;
                consent = false;
              }}
              required
              aria-describedby="workshop-labor-help"
            /></label
          >
          <label class="field-group" for="workshop-city"
            ><span class="field-label">{text.city}</span><input
              class="field"
              id="workshop-city"
              name="city"
              bind:value={city}
              minlength="2"
              maxlength="120"
              required
            /></label
          >
          <label class="field-group" for="workshop-state"
            ><span class="field-label">{text.state}</span><select
              class="field"
              id="workshop-state"
              name="state"
              bind:value={state}
              required
              ><option value="">{text.chooseState}</option
              >{#each data.states as uf}<option value={uf}>{uf}</option
                >{/each}</select
            ></label
          >
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
          class="button-primary justify-self-start"
          type="submit"
          disabled={busy || data.loadError}>{text.save}</button
        >
      </form>
    {:else}<p class="text-sm text-[var(--muted)]">{text.noRecords}</p>{/if}
  </section>

  <section class="panel grid gap-4 p-5" aria-labelledby="workshop-own-title">
    <h2 class="display text-2xl" id="workshop-own-title">{text.ownTitle}</h2>
    {#each data.contributions as contribution}
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
            )} · {$format.money(contribution.labor_cents)}
          </p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            {contribution.current ? text.active : text.changed}
          </p>
        </div>
        <div class="flex flex-wrap items-start gap-2">
          <button
            class="button-secondary"
            type="button"
            on:click={() => review(contribution)}
            disabled={!data.records.some(
              (record) => record.id === contribution.record_id,
            )}>{text.edit}</button
          >
          <form method="POST" action="?/withdraw" use:enhance>
            <input
              type="hidden"
              name="record_id"
              value={contribution.record_id}
            /><button class="button-secondary" type="submit"
              >{text.withdraw}</button
            >
          </form>
        </div>
      </div>
    {:else}<p class="text-sm text-[var(--muted)]">
        {text.noContributions}
      </p>{/each}
  </section>
</div>
