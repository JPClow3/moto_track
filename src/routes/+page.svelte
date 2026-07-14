<svelte:head>
  <title>Moto Track</title>
  <meta name="description" content="Fuel, maintenance, tires, documents, expenses, and reminders for motorcycle owners." />
</svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr]">
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-signal">Fuel · Maintenance · Tires · Documents</p>
    <h1 class="mt-4 max-w-3xl text-5xl font-black leading-tight">Your motorcycle command center.</h1>
    <p class="mt-5 max-w-2xl text-lg text-[var(--muted)]">
      Track odometer history, costs, reminders, documents, professional work sessions, and buyer-ready reports in one place.
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <a class="button-primary" href="/auth">Entrar</a>
      <a class="button-secondary" href="/precos">Ver planos</a>
    </div>
  </div>
  <div class="panel grid gap-4 p-5">
    <div class="grid grid-cols-2 gap-4">
      <div class="rounded-md border border-[var(--line)] p-4">
        <p class="text-sm text-[var(--muted)]">Health score</p>
        <p class="mt-2 text-4xl font-black">87</p>
      </div>
      <div class="rounded-md border border-[var(--line)] p-4">
        <p class="text-sm text-[var(--muted)]">Cost/km</p>
        <p class="mt-2 text-4xl font-black">R$0,41</p>
      </div>
    </div>
    <div class="rounded-md bg-ink p-5 text-white">
      <p class="text-sm opacity-75">Next alert</p>
      <p class="mt-2 text-xl font-bold">Oil change in 340 km</p>
    </div>
  </div>
</section>
