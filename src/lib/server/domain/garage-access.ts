import { error } from "@sveltejs/kit";
import type { Sql } from "postgres";
import { createTranslator, DEFAULT_LOCALE, type Locale } from "$lib/i18n";

export type GarageRole = "viewer" | "contributor" | "workshop";
export type GarageMembership = {
  id: string;
  owner_id: string;
  member_id: string;
  role: GarageRole;
  owner_email?: string;
};

export function garageRole(value: unknown): GarageRole | null {
  return value === "viewer" || value === "contributor" || value === "workshop"
    ? value
    : null;
}

export function canWriteGarageRecord(role: GarageRole, feature: string) {
  return feature === "maintenance"
    ? role === "contributor" || role === "workshop"
    : feature === "fuel" && role === "contributor";
}

export async function requireGarageMembership(
  db: Sql,
  memberId: string,
  id: string,
  lock = false,
  locale: Locale = DEFAULT_LOCALE,
): Promise<GarageMembership> {
  const t = createTranslator(locale);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw error(404, t("sharing.accessNotFound"));
  const [membership] = await db<GarageMembership[]>`
    select id, owner_id, member_id, role from garage_memberships
    where id = ${id} and member_id = ${memberId} and revoked_at is null
    ${lock ? db`for update` : db``}
  `;
  if (!membership) throw error(404, t("sharing.accessRevoked"));
  return membership;
}
