<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/store";

  let online = false;

  onMount(() => {
    const update = () => (online = navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  });
</script>

<section class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <h1 class="display text-4xl">{$t("offline.title")}</h1>
  <p class="mt-4 text-[var(--muted)]" role="status" aria-live="polite">
    {$t("offline.body")}
  </p>
  <p class="mt-3 text-sm text-[var(--muted)]">
    Abastecimentos guardados offline serão enviados quando a conexão voltar.
  </p>
  <div class="mt-8 flex flex-wrap gap-3">
    <button
      class="button-primary"
      type="button"
      onclick={() => location.reload()}
    >
      Tentar novamente{online ? " agora" : ""}
    </button>
    <a class="button-secondary" href="/">Voltar ao início</a>
  </div>
</section>
