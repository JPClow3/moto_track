import { schemaForFeature, type FeatureConfig } from "$server/domain/features";

export function normalizeApiFeaturePayload(
  feature: FeatureConfig,
  body: Record<string, unknown>,
  ownerId: string,
) {
  const raw: Record<string, unknown> = {};
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    raw[field.key] = body[field.key] ?? "";
  }
  const parsed = schemaForFeature(feature).safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const payload: Record<string, unknown> = {
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
  };
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    const value = parsed.data[field.key];
    if (value === "" || value === undefined) continue;
    if (field.kind === "money") {
      payload[field.key] = field.key.endsWith("_millicents")
        ? Math.round(Number(value) * 100000)
        : Math.round(Number(value) * 100);
    } else {
      payload[field.key] = value;
    }
  }
  return { ok: true as const, payload };
}
