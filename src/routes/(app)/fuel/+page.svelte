<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import {
    queueOfflineFuelSubmission,
    requestOfflineFuelSync,
  } from "$lib/utils/offline-fuel";
  import { privateFileUrl } from "$lib/utils/private-file-url";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  export let data;
  export let form;

  // Currency stays BRL in every locale — that is what Stripe charges. Only the
  // separators and symbol placement follow the reader. See $lib/i18n.
  const brl = (cents: number) => formatMoney($locale, cents);
  const price = (millicents: number) => formatPreciseMoney($locale, millicents);
  $: ocr = form?.ocr;
  $: defaults = data.preferences[0] ?? {};

  let offlineMessage = "";
  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    if (result.type === "success") {
      statusRole = "status";
      statusMessage = "Operação concluída.";
    } else {
      statusRole = "alert";
      statusMessage = String(
        result.data?.message ?? "Não foi possível concluir.",
      );
    }
  };

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(
      "Excluir este registro? Esta ação não pode ser desfeita.",
    );
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const handleCreateRecord: SubmitFunction = ({ formData, cancel }) => {
    offlineMessage = "";
    formBusy = true;
    statusMessage = "";
    if (navigator.onLine) {
      void requestOfflineFuelSync().catch(() => undefined);
      return async ({ result, update }) => {
        formBusy = false;
        finishStatus(result);
        await update();
      };
    }
    cancel();
    void queueOfflineFuelSubmission(formData)
      .then(() => {
        formBusy = false;
        statusRole = "status";
        offlineMessage =
          "Sem conexão: abastecimento guardado na fila offline e será enviado ao reconectar.";
      })
      .catch((error) => {
        formBusy = false;
        statusRole = "alert";
        offlineMessage =
          error instanceof Error
            ? error.message
            : "Não foi possível guardar o abastecimento offline.";
      });
  };
</script>

<section class="grid gap-6" aria-busy={formBusy}>
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

  {#if data.errorMessage || form?.message}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {data.errorMessage || form?.message}
    </div>
  {/if}

  {#if offlineMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {offlineMessage}
    </p>
  {/if}

  {#if statusMessage && !offlineMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
  {/if}

  <ConfirmDialog bind:this={confirmDialog} confirmLabel="Excluir" />

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
      <div class="fuel-table-scroll mt-3 overflow-x-auto">
        <table class="fuel-table w-full text-left text-sm">
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
                <td class="py-2" data-label="Linha">{row.row}</td><td
                  data-label="Data">{row.data.date}</td
                ><td data-label="Km">{row.data.odometer_km}</td><td
                  data-label="Litros">{row.data.liters}</td
                ><td data-label="Total">{brl(row.data.total_price_cents)}</td>
                <td data-label="Status"
                  >{row.errors.length ? row.errors.join(" ") : "Válida"}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <form
        class="mt-4 flex flex-wrap items-end gap-3"
        method="POST"
        action="?/importConfirm"
        use:enhance={enhanceWithStatus}
      >
        <input type="hidden" name="rows_json" value={form.validRowsJson} />
        <label class="field-label" for="fuel-import-motorcycle">Moto</label>
        <select
          class="field max-w-xs"
          id="fuel-import-motorcycle"
          name="motorcycle_id"
        >
          <option value="">Sem moto</option>
          {#each data.motorcycles as moto}<option value={moto.id}
              >{moto.name}</option
            >{/each}
        </select>
        <button class="button-primary" type="submit" disabled={formBusy}
          >Importar linhas válidas</button
        >
      </form>
    </div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <div class="panel overflow-hidden">
      <div class="fuel-table-scroll overflow-x-auto">
        <table class="fuel-table w-full text-left text-sm">
          <thead
            class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"
          >
            <tr
              ><th class="px-4 py-3">Data</th><th>Km</th><th>Litros</th><th
                >Total</th
              ><th>Preço/l</th><th>Posto</th><th>Comprovante</th><th>Ações</th
              ></tr
            >
          </thead>
          <tbody>
            {#each data.rows as row}
              <tr class="border-b border-[var(--line)]">
                <td class="px-4 py-3" data-label="Data">{row.date}</td>
                <td data-label="Km">{row.odometer_km}</td>
                <td data-label="Litros">{Number(row.liters).toFixed(3)}</td>
                <td data-label="Total">{brl(row.total_price_cents)}</td>
                <td data-label="Preço/l"
                  >{price(row.price_per_liter_millicents)}</td
                >
                <td data-label="Posto">{row.station_name || "—"}</td>
                <td data-label="Comprovante">
                  {#if row.receipt_file_key}
                    <a
                      class="text-[var(--accent)] underline-offset-2 hover:underline"
                      href={privateFileUrl(String(row.receipt_file_key))}
                      target="_blank"
                      rel="noopener noreferrer">Abrir</a
                    >
                  {:else}
                    —
                  {/if}
                </td>
                <td class="fuel-actions" data-label="Ações">
                  <form
                    method="POST"
                    action="?/deleteRecord"
                    use:enhance={enhanceDelete}
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      class="button-danger min-h-11 px-3 py-1 text-xs"
                      type="submit"
                      disabled={formBusy}>Excluir</button
                    >
                  </form>
                </td>
              </tr>
            {:else}
              <tr
                ><td
                  colspan="8"
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
        use:enhance={handleCreateRecord}
      >
        <h2 class="display text-xl">Novo abastecimento</h2>
        <label class="field-label" for="fuel-motorcycle">Moto</label>
        <select class="field" id="fuel-motorcycle" name="motorcycle_id"
          ><option value="">Moto</option>{#each data.motorcycles as moto}<option
              value={moto.id}
              selected={defaults.motorcycle_id === moto.id}>{moto.name}</option
            >{/each}</select
        >
        <label class="field-label" for="fuel-date">Data</label>
        <input
          class="field"
          id="fuel-date"
          type="date"
          name="date"
          value={ocr?.date ?? ""}
          required
        />
        <label class="field-label" for="fuel-odometer">Odômetro</label>
        <input
          class="field"
          id="fuel-odometer"
          type="number"
          name="odometer_km"
          placeholder="Odômetro"
          required
        />
        <label class="field-label" for="fuel-liters">Litros</label>
        <input
          class="field"
          id="fuel-liters"
          type="number"
          step="0.001"
          name="liters"
          placeholder="Litros"
          value={ocr?.liters ?? ""}
          required
        />
        <label class="field-label" for="fuel-total-price">Valor total</label>
        <input
          class="field"
          id="fuel-total-price"
          type="number"
          step="0.01"
          name="total_price"
          placeholder="Valor total"
          value={ocr?.total_price ?? ""}
          required
        />
        <label class="field-label" for="fuel-price-per-liter"
          >Preço por litro (opcional)</label
        >
        <input
          class="field"
          id="fuel-price-per-liter"
          type="number"
          step="0.001"
          name="price_per_liter"
          placeholder="Preço por litro opcional"
          value={ocr?.price_per_liter ??
            (defaults.price_per_liter_millicents
              ? defaults.price_per_liter_millicents / 100000
              : "")}
        />
        <label class="field-label" for="fuel-station">Posto cadastrado</label>
        <select class="field" id="fuel-station" name="station_id"
          ><option value="">Posto cadastrado</option
          >{#each data.stations as station}<option
              value={station.id}
              selected={defaults.station_id === station.id}
              >{station.name}</option
            >{/each}</select
        >
        <label class="field-label" for="fuel-grade"
          >Combustível cadastrado</label
        >
        <select class="field" id="fuel-grade" name="fuel_grade_id"
          ><option value="">Combustível cadastrado</option
          >{#each data.grades as grade}<option
              value={grade.id}
              selected={defaults.fuel_grade_id === grade.id}
              >{grade.name}</option
            >{/each}</select
        >
        <label class="field-label" for="fuel-station-name">Nome do posto</label>
        <input
          class="field"
          id="fuel-station-name"
          name="station_name"
          placeholder="Nome do posto"
          value={defaults.station_name ?? ""}
        />
        <label class="field-label" for="fuel-type">Tipo</label>
        <input
          class="field"
          id="fuel-type"
          name="fuel_type"
          placeholder="Tipo"
          value={defaults.fuel_type ?? "gasoline"}
        />
        <label class="flex items-center gap-2 text-sm" for="fuel-tank-full"
          ><input
            id="fuel-tank-full"
            type="checkbox"
            name="tank_full"
            value="true"
            checked={defaults.tank_full ?? true}
          /> Tanque cheio</label
        >
        <label class="field-label" for="fuel-notes">Observações</label>
        <textarea
          class="field"
          id="fuel-notes"
          name="notes"
          placeholder="Observações"
        ></textarea>
        <label class="field-label" for="fuel-receipt">Comprovante</label>
        <input
          class="field"
          id="fuel-receipt"
          type="file"
          name="receipt_file"
          accept="image/*,.pdf,.txt"
        />
        <button class="button-primary" type="submit" disabled={formBusy}
          >Salvar</button
        >
      </form>

      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/repeatLast"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">Repetir último</h2>
        <label class="field-label" for="fuel-repeat-date">Data</label>
        <input
          class="field"
          id="fuel-repeat-date"
          type="date"
          name="date"
          required
        />
        <label class="field-label" for="fuel-repeat-odometer"
          >Novo odômetro</label
        >
        <input
          class="field"
          id="fuel-repeat-odometer"
          type="number"
          name="odometer_km"
          placeholder="Novo odômetro"
          required
        />
        <label class="field-label" for="fuel-repeat-liters">Litros</label>
        <input
          class="field"
          id="fuel-repeat-liters"
          type="number"
          step="0.001"
          name="liters"
          placeholder="Litros"
          required
        />
        <label class="field-label" for="fuel-repeat-total">Valor total</label>
        <input
          class="field"
          id="fuel-repeat-total"
          type="number"
          step="0.01"
          name="total_price"
          placeholder="Valor total"
          required
        />
        <button class="button-secondary" type="submit" disabled={formBusy}
          >Repetir dados</button
        >
      </form>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/ocrScan"
      enctype="multipart/form-data"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="display text-xl">OCR de comprovante</h2>
      <label class="field-label" for="fuel-ocr-file">Comprovante</label>
      <input
        class="field"
        id="fuel-ocr-file"
        type="file"
        name="receipt_file"
        accept="image/*,.pdf,.txt"
        required
      />
      <button class="button-secondary" type="submit" disabled={formBusy}
        >Escanear</button
      >
    </form>

    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/importPreview"
      enctype="multipart/form-data"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="display text-xl">Importar CSV</h2>
      <p class="text-sm text-[var(--muted)]" id="fuel-csv-help">
        Cabeçalhos: date, odometer_km, liters, total_price, price_per_liter,
        station_name, fuel_type, tank_full, notes.
      </p>
      <label class="field-label" for="fuel-csv-file">Arquivo CSV</label>
      <input
        class="field"
        id="fuel-csv-file"
        type="file"
        name="csv_file"
        accept=".csv,text/csv"
        aria-describedby="fuel-csv-help"
        required
      />
      <button class="button-secondary" type="submit" disabled={formBusy}
        >Pré-visualizar</button
      >
    </form>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="panel p-4">
      <h2 class="display text-xl">Postos</h2>
      <form
        class="mt-3 grid gap-3"
        method="POST"
        action="?/saveStation"
        use:enhance={enhanceWithStatus}
      >
        <label class="field-label" for="station-name">Nome</label>
        <input
          class="field"
          id="station-name"
          name="name"
          placeholder="Nome"
          required
        />
        <label class="field-label" for="station-brand">Bandeira</label>
        <input
          class="field"
          id="station-brand"
          name="brand"
          placeholder="Bandeira"
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="station-city">Cidade</label>
            <input
              class="field"
              id="station-city"
              name="city"
              placeholder="Cidade"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="station-state">UF</label>
            <input
              class="field"
              id="station-state"
              name="state"
              placeholder="UF"
            />
          </div>
        </div>
        <label class="field-label" for="station-notes">Observações</label>
        <textarea
          class="field"
          id="station-notes"
          name="notes"
          placeholder="Observações"
        ></textarea>
        <button class="button-secondary" type="submit" disabled={formBusy}
          >Salvar posto</button
        >
      </form>
      <div class="mt-4 grid gap-2">
        {#each data.stations as station}<div
            class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
          >
            <span>{station.name}</span>
            <form
              method="POST"
              action="?/deleteStation"
              use:enhance={enhanceDelete}
            >
              <input type="hidden" name="id" value={station.id} /><button
                class="button-danger min-h-11 px-3 py-2 text-sm"
                disabled={formBusy}>Excluir</button
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
        use:enhance={enhanceWithStatus}
      >
        <label class="field-label" for="grade-name">Nome</label>
        <input
          class="field"
          id="grade-name"
          name="name"
          placeholder="Nome"
          required
        />
        <label class="field-label" for="grade-type">Tipo</label>
        <input
          class="field"
          id="grade-type"
          name="fuel_type"
          placeholder="Tipo"
          value="gasoline"
        />
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="field-group">
            <label class="field-label" for="grade-octane">Octanas</label>
            <input
              class="field"
              id="grade-octane"
              name="octane_rating"
              placeholder="Octanas"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="grade-ethanol">% etanol</label>
            <input
              class="field"
              id="grade-ethanol"
              name="ethanol_percentage"
              placeholder="% etanol"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="grade-price">Preço padrão</label>
            <input
              class="field"
              id="grade-price"
              name="default_price_per_liter"
              placeholder="Preço padrão"
            />
          </div>
        </div>
        <label class="field-label" for="grade-notes">Observações</label>
        <textarea
          class="field"
          id="grade-notes"
          name="notes"
          placeholder="Observações"
        ></textarea>
        <button class="button-secondary" type="submit" disabled={formBusy}
          >Salvar combustível</button
        >
      </form>
      <div class="mt-4 grid gap-2">
        {#each data.grades as grade}<div
            class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
          >
            <span>{grade.name}</span>
            <form
              method="POST"
              action="?/deleteGrade"
              use:enhance={enhanceDelete}
            >
              <input type="hidden" name="id" value={grade.id} /><button
                class="button-danger min-h-11 px-3 py-2 text-sm"
                disabled={formBusy}>Excluir</button
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
      use:enhance={enhanceWithStatus}
    >
      <h2 class="display text-xl">Padrões</h2>
      <label class="field-label" for="defaults-motorcycle">Moto</label>
      <select class="field" id="defaults-motorcycle" name="motorcycle_id"
        ><option value="">Moto</option>{#each data.motorcycles as moto}<option
            value={moto.id}>{moto.name}</option
          >{/each}</select
      >
      <label class="field-label" for="defaults-station">Posto</label>
      <select class="field" id="defaults-station" name="station_id"
        ><option value="">Posto</option>{#each data.stations as station}<option
            value={station.id}>{station.name}</option
          >{/each}</select
      >
      <label class="field-label" for="defaults-grade">Combustível</label>
      <select class="field" id="defaults-grade" name="fuel_grade_id"
        ><option value="">Combustível</option
        >{#each data.grades as grade}<option value={grade.id}
            >{grade.name}</option
          >{/each}</select
      >
      <label class="field-label" for="defaults-station-name">Posto avulso</label
      >
      <input
        class="field"
        id="defaults-station-name"
        name="station_name"
        placeholder="Posto avulso"
      />
      <label class="field-label" for="defaults-fuel-type">Tipo</label>
      <input
        class="field"
        id="defaults-fuel-type"
        name="fuel_type"
        value="gasoline"
      />
      <label class="field-label" for="defaults-price">Preço por litro</label>
      <input
        class="field"
        id="defaults-price"
        name="price_per_liter"
        placeholder="Preço por litro"
      />
      <label class="flex items-center gap-2 text-sm" for="defaults-tank-full"
        ><input
          id="defaults-tank-full"
          type="checkbox"
          name="tank_full"
          value="true"
          checked
        /> Tanque cheio por padrão</label
      >
      <button class="button-secondary" type="submit" disabled={formBusy}
        >Salvar padrões</button
      >
    </form>

    <form
      class="panel grid gap-3 p-4"
      method="POST"
      action="?/saveReviewSettings"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="display text-xl">Sugestão de revisão</h2>
      <label class="field-label" for="review-motorcycle">Moto</label>
      <select class="field" id="review-motorcycle" name="motorcycle_id" required
        ><option value="">Moto</option>{#each data.motorcycles as moto}<option
            value={moto.id}>{moto.name}</option
          >{/each}</select
      >
      <label class="field-label" for="review-interval"
        >Abastecimentos entre revisões</label
      >
      <input
        class="field"
        id="review-interval"
        type="number"
        min="1"
        name="fillups_interval"
        value="10"
      />
      <label class="flex items-center gap-2 text-sm" for="review-active"
        ><input
          id="review-active"
          type="checkbox"
          name="is_active"
          value="true"
          checked
        /> Ativar sugestão automática</label
      >
      <button class="button-secondary" type="submit" disabled={formBusy}
        >Salvar revisão</button
      >
    </form>
  </div>
</section>

<style>
  @media (max-width: 1279px) {
    .fuel-table-scroll {
      overflow-x: visible;
    }

    .fuel-table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .fuel-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .fuel-table tbody {
      display: grid;
      gap: 0.75rem;
    }

    .fuel-table tbody tr {
      display: block;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }

    .fuel-table tbody tr td {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      border-bottom: 1px solid var(--line);
      padding: 0.75rem 1rem;
    }

    .fuel-table tbody tr td::before {
      flex: 0 0 36%;
      min-width: 0;
      color: var(--muted);
      content: attr(data-label);
      font-family: "Barlow Condensed", Barlow, ui-sans-serif, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .fuel-table tbody tr td > * {
      min-width: 0;
      max-width: 64%;
      overflow-wrap: anywhere;
    }

    .fuel-table tbody tr td:last-child {
      border-bottom: 0;
    }

    .fuel-table tbody tr td.fuel-actions {
      display: block;
    }

    .fuel-table tbody tr td.fuel-actions::before {
      display: block;
      margin-bottom: 0.65rem;
    }

    .fuel-table tbody tr td.fuel-actions > form {
      max-width: none;
    }
  }

  @media (min-width: 1280px) {
    .fuel-table {
      min-width: 820px;
    }
  }
</style>
