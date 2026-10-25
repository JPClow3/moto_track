(() => {
  "use strict";
  const english = document.documentElement.lang === "en";
  const copy = english
    ? {
        title: "Local fill-up drafts",
        help: "Drafts stay in this browser. Export a copy before clearing local data. Reconnect and sign in to review or send them.",
        count: (count) => `${count} local draft(s)`,
        failed:
          "Could not read local drafts. Browser storage may be unavailable.",
        export: "Export all local drafts",
        discard: "Discard all local drafts",
        review: "Review drafts when online",
        confirm:
          "Discard all fill-up drafts from this browser? Export a copy first. Records already saved on the server will not be deleted.",
      }
    : {
        title: "Rascunhos locais de abastecimento",
        help: "Os rascunhos ficam neste navegador. Exporte uma cópia antes de limpar os dados locais. Reconecte e entre na sua conta para revisar ou enviar.",
        count: (count) => `${count} rascunho(s) local(is)`,
        failed:
          "Não foi possível ler os rascunhos locais. O armazenamento do navegador pode estar indisponível.",
        export: "Exportar todos os rascunhos locais",
        discard: "Descartar todos os rascunhos locais",
        review: "Revisar rascunhos quando online",
        confirm:
          "Descartar todos os rascunhos de abastecimento deste navegador? Exporte uma cópia antes. Registros já salvos no servidor não serão excluídos.",
      };
  const title = document.getElementById("drafts-title");
  const help = document.getElementById("drafts-help");
  const status = document.getElementById("drafts-status");
  const exportButton = document.getElementById("drafts-export");
  const discardButton = document.getElementById("drafts-discard");
  const review = document.getElementById("drafts-review");
  if (!title || !help || !status || !exportButton || !discardButton || !review)
    return;
  title.textContent = copy.title;
  help.textContent = copy.help;
  exportButton.textContent = copy.export;
  discardButton.textContent = copy.discard;
  review.textContent = copy.review;
  let drafts = [];
  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("moto-track-offline", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("fuel-submissions", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function refresh() {
    let db;
    try {
      db = await database();
      drafts = await new Promise((resolve, reject) => {
        const request = db
          .transaction("fuel-submissions", "readonly")
          .objectStore("fuel-submissions")
          .getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      status.textContent = copy.count(drafts.length);
      exportButton.disabled = !drafts.length;
      discardButton.disabled = !drafts.length;
    } catch {
      status.textContent = copy.failed;
    } finally {
      if (db) db.close();
    }
  }
  exportButton.addEventListener("click", () => {
    const content = JSON.stringify(
      {
        format: "moto-track-offline-fuel-v1",
        exportedAt: new Date().toISOString(),
        drafts,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `moto-track-local-drafts-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  discardButton.addEventListener("click", async () => {
    if (!window.confirm(copy.confirm)) return;
    let db;
    try {
      db = await database();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("fuel-submissions", "readwrite");
        transaction.objectStore("fuel-submissions").clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      await refresh();
    } catch {
      status.textContent = copy.failed;
    } finally {
      if (db) db.close();
    }
  });
  void refresh();
})();
