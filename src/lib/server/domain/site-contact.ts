import type { Sql } from "postgres";

export type SiteContact = {
  companyName: string;
  supportEmail: string;
};

// Mirrors the site_settings column defaults so legal pages still name a real
// contact when the database is unreachable (offline public-page e2e).
export const DEFAULT_SITE_CONTACT: SiteContact = {
  companyName: "Moto Track",
  supportEmail: "suporte@moto-track.net",
};

/**
 * Privacy and terms requests share the support channel configured by staff in
 * the admin console, so the published contact never drifts from it.
 */
export async function getSiteContact(sql: Sql): Promise<SiteContact> {
  try {
    const [row] = await sql<
      Array<{ company_name: string | null; support_email: string | null }>
    >`select company_name, support_email from site_settings where id = 1`;
    return {
      companyName:
        row?.company_name?.trim() || DEFAULT_SITE_CONTACT.companyName,
      supportEmail:
        row?.support_email?.trim() || DEFAULT_SITE_CONTACT.supportEmail,
    };
  } catch {
    return DEFAULT_SITE_CONTACT;
  }
}
