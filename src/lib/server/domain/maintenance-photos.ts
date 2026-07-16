export const MAX_MAINTENANCE_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAINTENANCE_PHOTO_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type PhotoValidation = { ok: true } | { ok: false; message: string };

export function validateMaintenancePhoto(file: File | null): PhotoValidation {
  if (!file || file.size === 0) {
    return { ok: false, message: "Envie uma foto para o registro." };
  }

  if (!MAINTENANCE_PHOTO_CONTENT_TYPES.has(file.type)) {
    return {
      ok: false,
      message: "Envie uma foto em JPEG, PNG, WebP, AVIF ou GIF.",
    };
  }

  if (file.size > MAX_MAINTENANCE_PHOTO_BYTES) {
    return {
      ok: false,
      message: "A foto deve ter no máximo 10 MB.",
    };
  }

  return { ok: true };
}
