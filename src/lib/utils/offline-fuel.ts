import { createTranslator, DEFAULT_LOCALE, type Locale } from "$lib/i18n";

const DATABASE_NAME = "moto-track-offline";
const STORE_NAME = "fuel-submissions";
const SYNC_TAG = "moto-track-fuel-sync";

export type OfflineFuelSubmission = {
  id: string;
  ownerId?: string;
  createdAt: string;
  values: Record<string, string>;
  status?: OfflineFuelStatus;
  lastAttemptAt?: string;
};

export type OfflineFuelStatus =
  | "authentication"
  | "conflict"
  | "network"
  | "invalid"
  | "unknown-owner"
  | "file-missing"
  | "other-owner";

export function offlineDraftScope(
  draft: OfflineFuelSubmission,
  ownerId?: string | null,
) {
  return !draft.ownerId
    ? "unknown"
    : draft.ownerId === ownerId
      ? "current"
      : "other";
}

export function offlineDraftHasMissingAttachment(draft: OfflineFuelSubmission) {
  return Object.entries(draft.values || {}).some(
    ([key, value]) =>
      (key === "receipt_file" || key === "receipt_file_key") && Boolean(value),
  );
}

export function prepareLegacyFuelDraft(
  draft: OfflineFuelSubmission,
  form: FormData,
  ownerId: string | null | undefined,
  consent: boolean,
  locale: Locale = DEFAULT_LOCALE,
): OfflineFuelSubmission {
  const t = createTranslator(locale);
  if (!ownerId) throw new Error(t("offline.signInToQueue"));
  if (!consent || draft.ownerId)
    throw new Error(t("offline.reviewConsentRequired"));
  if (offlineDraftHasMissingAttachment(draft))
    throw new Error(t("offline.missingAttachment"));
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      draft.id,
    )
  )
    throw new Error(t("offline.invalidDraft"));
  const allowed = new FormData();
  for (const key of [
    "date",
    "odometer_km",
    "liters",
    "total_price",
    "price_per_liter",
    "fuel_type",
    "station_name",
    "notes",
    "tank_full",
    "motorcycle_id",
  ]) {
    const value = form.get(key);
    if (value !== null) allowed.set(key, value);
  }
  return {
    id: draft.id,
    ownerId,
    createdAt: draft.createdAt,
    values: offlineFuelValues(allowed, locale),
  };
}

export function offlineFuelValues(
  formData: FormData,
  locale: Locale = DEFAULT_LOCALE,
) {
  const t = createTranslator(locale);
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) {
        throw new Error(t("offline.receiptOnline"));
      }
      continue;
    }
    values[key] = value;
  }
  for (const key of ["date", "odometer_km", "liters", "total_price"]) {
    if (!values[key]?.trim()) throw new Error(t("offline.requiredFields"));
  }
  return values;
}

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readOfflineFuelSubmissions(): Promise<
  OfflineFuelSubmission[]
> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function discardOfflineFuelSubmission(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function reviewOfflineFuelSubmission(
  id: string,
  form: FormData,
  ownerId: string | null | undefined,
  consent: boolean,
  locale: Locale,
) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      let failure: unknown;
      request.onsuccess = () => {
        try {
          if (!request.result)
            throw new Error(createTranslator(locale)("offline.invalidDraft"));
          store.put(
            prepareLegacyFuelDraft(
              request.result,
              form,
              ownerId,
              consent,
              locale,
            ),
          );
        } catch (cause) {
          failure = cause;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(failure || transaction.error);
      transaction.onabort = () => reject(failure || transaction.error);
    });
  } finally {
    db.close();
  }
}

export function offlineFuelExport(drafts: OfflineFuelSubmission[]) {
  return JSON.stringify(
    {
      format: "moto-track-offline-fuel-v1",
      exportedAt: new Date().toISOString(),
      drafts,
    },
    null,
    2,
  );
}

export async function queueOfflineFuelSubmission(
  formData: FormData,
  locale: Locale = DEFAULT_LOCALE,
  ownerId?: string,
) {
  if (!ownerId)
    throw new Error(createTranslator(locale)("offline.signInToQueue"));
  const submission: OfflineFuelSubmission = {
    id: crypto.randomUUID(),
    ownerId,
    createdAt: new Date().toISOString(),
    values: offlineFuelValues(formData, locale),
  };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(submission);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
  void requestOfflineFuelSync(true).catch(() => undefined);
  return submission;
}

export async function requestOfflineFuelSync(registerBackground = false) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.active) return;
  const sync = (
    registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    }
  ).sync;
  if (registerBackground && sync)
    await sync.register(SYNC_TAG).catch(() => undefined);
  registration.active?.postMessage({ type: "SYNC_FUEL_QUEUE" });
}
