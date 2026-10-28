export type NativePlatform = "ios" | "android" | "windows" | null;

/** A presentation/distribution hint only. Never use it to grant paid access. */
export function nativePlatform(userAgent: string | null): NativePlatform {
  const match = /(?:^|\s)MotoTrackNative\/(iOS|Android|Windows)(?:\s|$)/i.exec(
    userAgent ?? "",
  );
  return match
    ? (match[1].toLowerCase() as Exclude<NativePlatform, null>)
    : null;
}

export function nativePurchasesRestricted(userAgent: string | null): boolean {
  const platform = nativePlatform(userAgent);
  return platform === "ios" || platform === "android";
}

export function nativeRestrictedPath(path: string): boolean {
  return [
    "/precos",
    "/billing",
    "/billing/checkout",
    "/billing/portal",
  ].includes(path.replace(/\/+$/, "") || "/");
}
