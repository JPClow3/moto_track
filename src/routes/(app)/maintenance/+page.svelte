<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
</script>

<FeaturePage {...data} errorMessage={form?.message || data.errorMessage} />
<section class="mt-6 grid gap-6">
  <div class="grid gap-4 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePart"
      use:enhance
    >
      <h2 class="font-bold">Catálogo de peças</h2>
      <input class="field" name="name" placeholder="Peça" required /><input
        class="field"
        name="manufacturer"
        placeholder="Fabricante"
      /><input
        class="field"
        name="price"
        type="number"
        step=".01"
        placeholder="Preço"
      /><input
        class="field"
        name="stock_quantity"
        type="number"
        value="0"
      /><label
        ><input name="track_stock" type="checkbox" value="true" /> Controlar estoque</label
      ><button class="button-secondary">Salvar peça</button>
    </form>
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePlan"
      use:enhance
    >
      <h2 class="font-bold">Plano de manutenção</h2>
      <select class="field" name="motorcycle_id"
        >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
          >{/each}</select
      ><input
        class="field"
        name="maintenance_type"
        placeholder="Tipo"
        required
      /><input
        class="field"
        name="interval_km"
        type="number"
        placeholder="Intervalo km"
      /><input
        class="field"
        name="interval_days"
        type="number"
        placeholder="Intervalo dias"
      /><button class="button-secondary">Salvar plano</button>
    </form>
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Peças</h2>
    {#each data.parts as part}
      <article class="panel flex justify-between gap-3 p-4">
        <span
          >{part.name}
          {part.manufacturer ? `· ${part.manufacturer}` : ""} · {brl(
            part.price_cents ?? 0,
          )}
          {part.track_stock ? `· estoque ${part.stock_quantity}` : ""}</span
        >
        <form method="POST" action="?/deletePart" use:enhance>
          <input type="hidden" name="id" value={part.id} /><button
            class="button-danger">Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhuma peça no catálogo.</p>
    {/each}
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Planos</h2>
    {#each data.plans as plan}
      <article class="panel flex justify-between gap-3 p-4">
        <span
          >{plan.motorcycles?.name ?? "Moto"} · {plan.maintenance_type}
          {plan.interval_km ? `· ${plan.interval_km} km` : ""}
          {plan.interval_days ? `· ${plan.interval_days} dias` : ""}</span
        >
        <form method="POST" action="?/deletePlan" use:enhance>
          <input type="hidden" name="id" value={plan.id} /><button
            class="button-danger">Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhum plano ativo.</p>
    {/each}
  </div>

  <form
    class="panel grid gap-2 p-4"
    method="POST"
    action="?/uploadPhoto"
    enctype="multipart/form-data"
    use:enhance
  >
    <h2 class="font-bold">Foto da manutenção</h2>
    <select class="field" name="maintenance_record_id" required>
      <option value="">Registro</option>
      {#each data.rows as row}
        <option value={String(row.id)}
          >{String(row.date ?? "")} · {String(
            row.maintenance_type ?? "",
          )}</option
        >
      {/each}
    </select>
    <input class="field" name="caption" placeholder="Legenda" />
    <input class="field" name="photo" type="file" accept="image/*" required />
    <button class="button-secondary">Enviar foto</button>
  </form>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Fotos</h2>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.photos as photo}
        <article class="panel overflow-hidden">
          <img
            class="aspect-video w-full object-cover"
            src={`/maintenance/photos/${photo.id}`}
            alt={photo.caption || "Foto de manutenção"}
          />
          <div class="flex items-start justify-between gap-2 p-3">
            <div>
              <p class="text-sm font-medium">
                {photo.maintenance_records
                  ? `${photo.maintenance_records.date} · ${photo.maintenance_records.maintenance_type}`
                  : "Registro"}
              </p>
              {#if photo.caption}
                <p class="text-sm text-[var(--muted)]">{photo.caption}</p>
              {/if}
            </div>
            <form method="POST" action="?/deletePhoto" use:enhance>
              <input type="hidden" name="id" value={photo.id} /><button
                class="button-danger min-h-8 px-3 py-1 text-xs">Excluir</button
              >
            </form>
          </div>
        </article>
      {:else}
        <p class="text-sm text-[var(--muted)]">Nenhuma foto enviada.</p>
      {/each}
    </div>
  </div>
</section>
