import { runtimeEnv } from "$server/runtime";

export function siteUrl(platform?: App.Platform) {
  return runtimeEnv(platform).PUBLIC_SITE_URL || "http://localhost:5173";
}
