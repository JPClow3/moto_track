import { writable } from "svelte/store";

export type ToastTone = "ok" | "info" | "error";

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  /** Optional single follow-up, e.g. "Undo" or "View". */
  action?: { label: string; href?: string; onClick?: () => void };
};

const DEFAULT_TIMEOUT_MS = 5000;

let nextId = 1;
export const toasts = writable<Toast[]>([]);

export function dismissToast(id: number) {
  toasts.update((list) => list.filter((toast) => toast.id !== id));
}

/** Global save/delete confirmation. A record sheet closes on success, so the
 *  inline form message alone was easy to miss. Rendered by <ToastRegion />. */
export function showToast(
  message: string,
  options: {
    tone?: ToastTone;
    action?: Toast["action"];
    timeoutMs?: number;
  } = {},
) {
  const id = nextId++;
  const toast: Toast = {
    id,
    message,
    tone: options.tone ?? "ok",
    action: options.action,
  };
  toasts.update((list) => [...list.slice(-2), toast]);
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (timeout > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), timeout);
  }
  return id;
}
