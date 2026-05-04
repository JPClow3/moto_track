/* Moto Track offline form outbox for flaky mobile networks. */
(function () {
  const DB_NAME = "moto-track-offline-db";
  const STORE_NAME = "offline-requests";
  const SYNC_TAG = "moto-track-offline-queue";
  const STATUS_URL = "/api/pwa/status/";
  const QUEUEABLE_STATUSES = new Set(["pending", "syncing", "login_required"]);

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onerror = (event) => reject(event.target.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  }

  async function addRecord(record) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(record);
    await txDone(tx);
  }

  async function updateRecord(record) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...record, updatedAt: Date.now() });
    await txDone(tx);
  }

  async function deleteRecord(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await txDone(tx);
  }

  async function getAllRecords() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  function ensureSubmissionToken(form) {
    let field = form.querySelector('input[name="client_submission_id"]');
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = "client_submission_id";
      form.appendChild(field);
    }
    if (!field.value) {
      field.value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    return field.value;
  }

  function recordFromForm(form) {
    ensureSubmissionToken(form);
    const data = new FormData(form);
    const fields = [];
    const files = [];
    for (const [name, value] of data.entries()) {
      if (value instanceof File) {
        if (value.name) {
          files.push({ name, file: value, filename: value.name, type: value.type });
        }
      } else {
        fields.push({ name, value: String(value) });
      }
    }
    const csrfField = fields.find((field) => field.name === "csrfmiddlewaretoken");
    const submissionField = fields.find((field) => field.name === "client_submission_id");
    const targetUrl = new URL(form.getAttribute("action") || window.location.href, window.location.origin);
    if (targetUrl.origin !== window.location.origin) {
      throw new Error("Offline queue only supports same-origin form submissions.");
    }
    return {
      action: form.dataset.offlineQueue || "form_submit",
      url: targetUrl.toString(),
      method: (form.getAttribute("method") || "POST").toUpperCase(),
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      csrfToken: csrfField ? csrfField.value : "",
      clientSubmissionId: submissionField ? submissionField.value : "",
      fields,
      files,
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function buildFormData(record, csrfToken) {
    const formData = new FormData();
    for (const field of record.fields || []) {
      formData.append(field.name, field.name === "csrfmiddlewaretoken" && csrfToken ? csrfToken : field.value);
    }
    for (const item of record.files || []) {
      formData.append(item.name, item.file, item.filename || item.file.name);
    }
    return formData;
  }

  async function fetchStatus() {
    try {
      const response = await fetch(STATUS_URL, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (response.ok) return response.json();
    } catch {
      return { authenticated: true, csrf_token: "" };
    }
    return { authenticated: false, csrf_token: "", login_url: "/accounts/login/" };
  }

  async function syncQueue() {
    const status = await fetchStatus();
    const records = await getAllRecords();
    if (!status.authenticated) {
      await Promise.all(records.map((record) => updateRecord({ ...record, status: "login_required" })));
      await refreshBanner();
      return;
    }

    for (const record of records.filter((item) => QUEUEABLE_STATUSES.has(item.status))) {
      try {
        await updateRecord({ ...record, status: "syncing" });
        const response = await fetch(record.url, {
          method: record.method,
          credentials: "same-origin",
          headers: {
            ...(record.headers || {}),
            "X-CSRFToken": status.csrf_token,
          },
          body: buildFormData(record, status.csrf_token),
        });
        const isLoginRedirect = response.url.includes("/accounts/login");
        const hasHxRedirect = response.headers.get("HX-Redirect");
        const isSuccess = (response.redirected && !isLoginRedirect) || (response.ok && hasHxRedirect);

        if (isSuccess) {
          await deleteRecord(record.id);
        } else if (response.ok && !isLoginRedirect) {
          // 200 OK without redirect or HX-Redirect — likely form re-render with validation errors
          await updateRecord({ ...record, status: "needs_review", retryCount: (record.retryCount || 0) + 1 });
        } else if ([400, 422].includes(response.status)) {
          await updateRecord({ ...record, status: "needs_review", retryCount: (record.retryCount || 0) + 1 });
        } else if ([401, 403].includes(response.status) || isLoginRedirect) {
          await updateRecord({ ...record, status: "login_required", retryCount: (record.retryCount || 0) + 1 });
        } else {
          await updateRecord({ ...record, status: "pending", retryCount: (record.retryCount || 0) + 1 });
        }
      } catch {
        await updateRecord({ ...record, status: "pending", retryCount: (record.retryCount || 0) + 1 });
      }
    }
    await refreshBanner();
  }

  async function registerSync() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      try {
        await registration.sync.register(SYNC_TAG);
      } catch {
        // foreground retry handles browsers without accepted background sync
      }
    }
    if (registration.active) {
      registration.active.postMessage({ type: "sync-offline-queue" });
    }
  }

  function showSnackbar(message) {
    if (typeof window.showClientSnackbar === "function") {
      window.showClientSnackbar(message);
    }
  }

  async function queueForm(form) {
    const record = recordFromForm(form);
    await addRecord(record);
    await registerSync();
    await refreshBanner();
    showSnackbar("Registro salvo offline. Sincronize quando a conexão voltar.");
  }

  async function refreshBanner(state) {
    const records = state
      ? null
      : await getAllRecords().catch(() => []);
    const pending = state ? state.pending : records.filter((item) => ["pending", "syncing"].includes(item.status)).length;
    const failed = state ? state.failed : records.filter((item) => ["needs_review", "login_required"].includes(item.status)).length;
    const total = state ? state.total : records.length;
    const banner = document.querySelector("[data-offline-banner]");
    if (!banner) return;
    banner.classList.toggle("hidden", total === 0);
    banner.querySelectorAll("[data-offline-pending-count]").forEach((el) => {
      el.textContent = String(pending);
    });
    banner.querySelectorAll("[data-offline-failed-count]").forEach((el) => {
      el.textContent = String(failed);
    });
    banner.dataset.offlineState = failed > 0 ? "attention" : pending > 0 ? "pending" : "clear";
  }

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target.closest("form[data-offline-queue]");
      if (!form) return;
      ensureSubmissionToken(form);
      if (navigator.onLine) return;
      event.preventDefault();
      event.stopPropagation();
      queueForm(form);
    },
    true
  );

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-offline-sync-now]");
    if (!trigger) return;
    trigger.setAttribute("aria-busy", "true");
    syncQueue().finally(() => trigger.removeAttribute("aria-busy"));
  });

  window.addEventListener("online", () => {
    syncQueue();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && (event.data.type === "offline-queue-state" || event.data.type === "offline-pending-count")) {
        refreshBanner(event.data);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshBanner();
    if (navigator.onLine) syncQueue();
  });

  window.MotoTrackOfflineQueue = {
    queueForm,
    syncQueue,
    refreshBanner,
  };
})();
