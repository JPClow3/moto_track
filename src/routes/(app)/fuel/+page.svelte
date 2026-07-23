<script lang="ts">
  import { enhance } from "$app/forms";
  import { locale } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import {
    queueOfflineFuelSubmission,
    requestOfflineFuelSync,
  } from "$lib/utils/offline-fuel";
  export let data;
  export let form;

  // Currency stays BRL in every locale — that is what Stripe charges. Only the
  // separators and symbol placement follow the reader. See $lib/i18n.
  const brl = (cents: number) => formatMoney($locale, cents);
  const price = (millicents: number) => formatPreciseMoney($locale, millicents);
  $: ocr = form?.ocr;
  $: defaults = data.preferences[0] ?? {};

  let offlineMessage = "";

  function handleCreateRecord({
    formData,
    cancel,
  }: {
    formData: FormData;
    cancel: () => void;
  }) {
    offlineMessage = "";
    if (navigator.onLine) {
      void requestOfflineFuelSync();
      return;
    }
    cancel();
    void queueOfflineFuelSubmission(formData)
      .then(() => {
        offlineMessage =
          "Sem conexão: abastecimento guardado na fila offline e será enviado ao reconectar.";
      })
      .catch((error) => {
        offlineMessage =
          error instanceof Error
            ? error.message
            : "Não foi possível guardar o abastecimento offline.";
      });
  }
</script>

<section class="grid gap-6">
  <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>Combustível
      </p>
      <h1 class="display text-4xl">Abastecimentos</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        Registro completo com OCR de comprovante, importação CSV, postos,
        combustíveis, padrões e repetir último.
      </p>
    </div>
    <a class="button-secondary" href="/fuel/export.csv">Exportar CSV</a>
  </div>

  {#if data.errorMessage || form?.message || offlineMessage}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
    >
      {data.errorMessage || form?.message || offlineMessage}
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-4">
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">Gasto total</p>
      <strong class="text-2xl">{brl(data.summary.totalSpend)}</strong>
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">Litros</p>
      <strong class="text-2xl">{data.summary.totalLiters.toFixed(2)}</strong>
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">Média</p>
      <strong class="text-2xl"
        >{data.summary.averageConsumption ?? "—"} km/l</strong
      >
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">Custo/km</p>
      <strong class="text-2xl"
        >{data.summary.costPerKm
          ? brl(data.summary.costPerKm * 100)
          : "—"}</strong
      >
    </article>
  </div>

  {#if form?.ocr}
    <div class="panel p-4">
      <h2 class="font-semibold">OCR encontrado</h2>
      <p class="mt-2 text-sm text-[var(--muted)]">
        Litros: {form.ocr.liters ?? "—"} · Total: {form.ocr.total_price
          ? brl(form.ocr.total_price * 100)
          : "—"} · Preço/l:
        {form.ocr.price_per_liter
          ? price(form.ocr.price_per_liter * 100000)
          : "—"}
      </p>
      <p class="mt-2 text-sm text-[var(--muted)]">
        Os valores foram colocados no novo abastecimento abaixo para revisão.
      </p>
    </div>
  {/if}

  {#if form?.previewRows}
    <div class="panel p-4">
      <h2 class="font-semibold">Prévia de importação</h2>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead
            ><tr
              ><th>Linha</th><th>Data</th><th>Km</th><th>Litros</th><th
                >Total</th
              ><th>Status</th></tr
            ></thead
          >
          <tbody>
            {#each form.previewRows as row}
              <tr class="border-t border-[var(--line)]">
                <td class="py-2">{row.row}</td><td>{row.data.date}</td><td
                  >{row.data.odometer_km}</td
                ><td>{row.data.liters}</td><td
                  >{brl(row.data.total_price_cents)}</td
                >
                <td>{row.errors.length ? row.errors.join(" ") : "Válida"}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <form
        class="mt-4 flex gap-3"
        method="POST"
        action="?/importConfirm"
        use:enhance
      >
        <input type="hidden" name="rows_json" value={form.validRowsJson} />
        <select class="field max-w-xs" name="motorcycle_id">
          <option value="">Sem moto</option>
          {#each data.motorcycles as moto}<option value={moto.id}
              >{moto.name}</option
            >{/each}
        </select>
        <button class="button-primary" type="submit"
          >Importar linhas válidas</button
        >
      </form>
    </div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead
            class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"
          >
            <tr
              ><th class="px-4 py-3">Data</th><th>Km</th><th>Litros</th><th
                >Total</th
              ><th>Preço/l</th><th>Posto</th><th>Ações</th></tr
            >
          </thead>
          <tbody>
            {#each data.rows as row}
              <tr class="border-b border-[var(--line)]">
                <td class="px-4 py-3">{row.date}</td>
                <td>{row.odometer_km}</td>
                <td>{Number(row.liters).toFixed(3)}</td>
                <td>{brl(row.total_price_cents)}</td>
                <td>{price(row.price_per_liter_millicents)}</td>
                <td>{row.station_name || "—"}</td>
                <td>
                  <form method="POST" action="?/deleteRecord" use:enhance>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      class="button-danger min-h-8 px-3 py-1 text-xs"
                      type="submit">Excluir</button
                    >
                  </form>
                </td>
              </tr>
            {:else}
              <tr
                ><td
                  colspan="7"
                  class="px-4 py-12 text-center text-[var(--muted)]"
                  >Sem abastecimentos ainda.</td
                ></tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid gap-4">
      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createRecord"
        enctype="multipart/form-data"
        use:enhance={({ formData, cancel }) =>
          handleCreateRecord({ formData, cancel })}
      >
        <h2 class="display text-xl">Novo abastecimento</h2>
        <select class="field" name="motorcycle_id"
          ><option value="">Moto</option>{#each data.motorcycles as moto}<option
              value={moto.id}
              selected={defaults.motorcycle_id === moto.id}>{moto.name}</option
            >{/each}</select
        >
        <input
          class="field"
          type="date"
          name="date"
          value={ocr?.date ?? ""}
          required
        />
        <input
          class="field"
          type="number"
          name="odometer_km"
          placeholder="Odômetro"
          required
        />
        <input
          class="field"
          type="number"
          step="0.001"
          name="liters"
          placeholder="Litros"
          value={ocr?.liters ?? ""}
          required
        />
        <input
          class="field"
          type="number"
          step="0.01"
          name="total_price"
          placeholder="Valor total"
          value={ocr?.total_price ?? ""}
          required
        />
        <input
          class="field"
          type="number"
          step="0.001"
          name="price_per_liter"
          placeholder="Preço por litro opcional"
          value={ocr?.price_per_liter ??
            (defaults.price_per_liter_millicents
              ? defaults.price_per_liter_millicents / 100000
              : "")}
        />
        <select class="field" name="station_id"
          ><option value="">Posto cadastrado</option
          >{#each data.stations as station}<option
              value={station.id}
              selected={defaults.station_id === station.id}
              >{station.name}</option
            >{/each}</select
        >
        <select class="field" name="fuel_grade_id"
          ><option value="">Combustível cadastrado</option
          >{#each data.grades as grade}<option
              value={grade.id}
              selected={defaults.fuel_grade_id === grade.id}
              >{grade.name}</option
            >{/each}</select
        >
        <input
          class="field"
          name="station_name"
          placeholder="Nome do posto"
          value={defaults.station_name ?? ""}
        />
        <input
          class="field"
          name="fuel_type"
          placeholder="Tipo"
          value={defaults.fuel_type ?? "gasoline"}
        />
        <label class="flex items-center gap-2 text-sm"
          ><input
            type="checkbox"
            name="tank_full"
            value="true"
            checked={defaults.tank_full ?? true}
          /> Tanque cheio</label
        >
        <textarea class="field" name="notes" placeholder="Observações"
        ></textarea>
        <input
          class="field"
          type="file"
          name="receipt_file"
          accept="image/*,.pdf,.txt"
        />
        <button class="button-primary" type="submit">Salvar</button>
      </form>

      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/repeatLast"
        use:enhance
      >
        <h2 class="display text-xl">Repetir último</h2>
        <input class="field" type="date" name="date" required />
        <input
          class="field"
          type="number"
          name="odometer_km"
          placeholder="Novo odômetro"
          required
        />
        <input
          class="field"
          type="number"
          step="0.001"
          name="liters"
          placeholder="Litros"
          required
        />
        <input
          class="field"
          type="number"
          step="0.01"
          name="total_price"
          placeholder="Valor total"
          required
        />
        <button class="button-secondary" type="submit">Repetir dados</button>
      </form>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/ocrScan"
      enctype="multipart/form-data"
      use:enhance
    >
      <h2 class="display text-xl">OCR de comprovante</h2>
      <input
        class="field"
        type="file"
        name="receipt_file"
        accept="image/*,.pdf,.txt"
        required
      />
      <button class="button-secondary" type="submit">Escanear</button>
    </form>

    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/importPreview"
      enctype="multipart/form-data"
      use:enhance
    >
      <h2 class="display text-xl">Importar CSV</h2>
      <p class="text-sm text-[var(--muted)]">
        Cabeçalhos: date, odometer_km, liters, total_price, price_per_liter,
        station_name, fuel_type, tank_full, notes.
      </p>
      <input
        class="field"
        type="file"
        name="csv_file"
        accept=".csv,text/csv"
        required
      />
      <button class="button-secondary" type="submit">Pré-visualizar</button>
    </form>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="panel p-4">
      <h2 class="display text-xl">Postos</h2>
      <form
        class="mt-3 grid gap-3"
        method="POST"
        action="?/saveStation"
        use:enhance
      >
        <input class="field" name="name" placeholder="Nome" required />
        <input class="field" name="brand" placeholder="Bandeira" />
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field" name="city" placeholder="Cidade" /><input
            class="field"
            name="state"
            placeholder="UF"
          />
        </div>
        <textarea class="field" name="notes" placeholder="Observações"
        ></textarea>
        <button class="button-secondary" type="submit">Salvar posto</button>
      </form>
      <div class="mt-4 grid gap-2">
        {#each data.stations as station}<div
            class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
          >
            <span>{station.name}</span>
            <form method="POST" action="?/deleteStation" use:enhance>
              <input type="hidden" name="id" value={station.id} /><button
                class="text-danger">Excluir</button
              >
            </form>
          </div>{/each}
      </div>
    </div>

    <div class="panel p-4">
      <h2 class="display text-xl">Combustíveis</h2>
      <form
        class="mt-3 grid gap-3"
        method="POST"
        action="?/saveGrade"
        use:enhance
      >
        <input class="field" name="name" placeholder="Nome" required />
        <input
          class="field"
          name="fuel_type"
          placeholder="Tipo"
          value="gasoline"
        />
        <div class="grid gap-3 sm:grid-cols-3">
          <input
            class="field"
            name="octane_rating"
            placeholder="Octanas"
          /><input
            class="field"
            name="ethanol_percentage"
            placeholder="% etanol"
          /><input
            class="field"
            name="default_price_per_liter"
            placeholder="Preço padrão"
          />
        </div>
        <textarea class="field" name="notes" placeholder="Observações"
        ></textarea>
        <button class="button-secondary" type="submit"
          >Salvar combustível</button
        >
      </form>
      <div class="mt-4 grid gap-2">
        {#each data.grades as grade}<div
            class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
          >
            <span>{grade.name}</span>
            <form method="POST" action="?/deleteGrade" use:enhance>
              <input type="hidden" name="id" value={grade.id} /><button
                class="text-danger">Excluir</button
              >
            </form>
          </div>{/each}
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/saveDefaults"
      use:enhance
    >
      <h2 class="display text-xl">Padrões</h2>
      <select class="field" name="motorcycle_id"
        ><option value="">Moto</option>{#each data.motorcycles as moto}<option
            value={moto.id}>{moto.name}</option
          >{/each}</select
      >
      <select class="field" name="station_id"
        ><option value="">Posto</option>{#each data.stations as station}<option
            value={station.id}>{station.name}</option
          >{/each}</select
      >
      <select class="field" name="fuel_grade_id"
        ><option value="">Combustível</option
        >{#each data.grades as grade}<option value={grade.id}
            >{grade.name}</option
          >{/each}</select
      >
      <input class="field" name="station_name" placeholder="Posto avulso" />
      <input class="field" name="fuel_type" value="gasoline" />
      <input
        class="field"
        name="price_per_liter"
        placeholder="Preço por litro"
      />
      <label class="flex items-center gap-2 text-sm"
        ><input type="checkbox" name="tank_full" value="true" checked /> Tanque cheio
        por padrão</label
      >
      <button class="button-secondary" type="submit">Salvar padrões</button>
    </form>

    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/saveReviewSettings"
      use:enhance
    >
      <h2 class="display text-xl">Sugestão de revisão</h2>
      <select class="field" name="motorcycle_id" required
        ><option value="">Moto</option>{#each data.motorcycles as moto}<option
            value={moto.id}>{moto.name}</option
          >{/each}</select
      >
      <input
        class="field"
        type="number"
        min="1"
        name="fillups_interval"
        value="10"
      />
      <label class="flex items-center gap-2 text-sm"
        ><input type="checkbox" name="is_active" value="true" checked /> Ativar sugestão
        automática</label
      >
      <button class="button-secondary" type="submit">Salvar revisão</button>
    </form>
  </div>
</section>
