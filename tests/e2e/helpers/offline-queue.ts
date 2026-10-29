import type { Page } from "@playwright/test";

export type LocalFuelDraft = {
  id: string;
  ownerId?: string;
  createdAt: string;
  values: Record<string, string>;
  status?: string;
};

export async function seedLocalFuelDrafts(
  page: Page,
  drafts: LocalFuelDraft[],
) {
  await page.evaluate(async (values) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("moto-track-offline", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("fuel-submissions", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("fuel-submissions", "readwrite");
        const store = transaction.objectStore("fuel-submissions");
        for (const value of values) store.put(value);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }, drafts);
}

export async function readLocalFuelDrafts(
  page: Page,
): Promise<LocalFuelDraft[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("moto-track-offline", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("fuel-submissions", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db
          .transaction("fuel-submissions", "readonly")
          .objectStore("fuel-submissions")
          .getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}
