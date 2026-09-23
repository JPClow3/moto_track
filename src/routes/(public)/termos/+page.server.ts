import { getSiteContact } from "$server/domain/site-contact";

export async function load({ locals }) {
  return { contact: await getSiteContact(locals.db) };
}
