const DATABASE_NAME = "moto-track-offline";
const STORE_NAME = "fuel-submissions";
const SYNC_TAG = "moto-track-fuel-sync";

export type OfflineFuelSubmission = {
  id: string;
  createdAt: string;
  values: Record<string, string>;
};

export function offlineFuelValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) {
        throw new Error("Envie o comprovante quando estiver online; fotos não entram na fila offline.");
      }
      continue;
    }
    values[key] = value;
  }
  for (const key of ["date", "odometer_km", "liters", "total_price"]) {
    if (!values[key]?.trim()) throw new Error("Preencha os campos obrigatórios antes de salvar offline.");
  }
  return values;
}

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineFuelSubmission(formData: FormData) {
  const submission: OfflineFuelSubmission = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    values: offlineFuelValues(formData),
  };
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(submission);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  const registration = await navigator.serviceWorker.ready;
  const sync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
  if (sync) await sync.register(SYNC_TAG);
  registration.active?.postMessage({ type: "SYNC_FUEL_QUEUE" });
  return submission;
}

export async function requestOfflineFuelSync() {
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "SYNC_FUEL_QUEUE" });
}
