export function privateFileUrl(objectKey: string | null | undefined) {
  if (!objectKey) return null;
  return `/files/${objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
