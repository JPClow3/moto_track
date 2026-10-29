import { localizedActions } from "$server/domain/localized-actions";
import { createTranslator } from "$lib/i18n";
import { fail } from "@sveltejs/kit";
import { z } from "zod";
import { garageRole, type GarageRole } from "$server/domain/garage-access";
import { shareTokenHash } from "$server/domain/sale-report-share";
import { siteUrl } from "$server/env";
import type { Sql } from "postgres";
import { lockObjectOwner } from "$server/db/owner-lock";

export async function load({ locals }) {
  const id = locals.user!.id;
  const [members, invitations, received, activity] = await Promise.all([
    locals.db<Array<{ id: string; email: string; role: GarageRole }>>`
      select m.id, p.email, m.role from garage_memberships m
      join profiles p on p.id = m.member_id
      where m.owner_id = ${id} and m.revoked_at is null order by p.email
    `,
    locals.db<
      Array<{
        id: string;
        invited_email: string;
        role: GarageRole;
        expires_at: string;
      }>
    >`
      select id, invited_email, role, expires_at::text from garage_invitations
      where owner_id = ${id} and revoked_at is null and accepted_at is null and expires_at > now()
      order by created_at desc
    `,
    locals.db<Array<{ id: string; email: string; role: GarageRole }>>`
      select m.id, p.email, m.role from garage_memberships m
      join profiles p on p.id = m.owner_id
      where m.member_id = ${id} and m.revoked_at is null order by p.email
    `,
    locals.db<
      Array<{
        id: string;
        email: string | null;
        record_table: string;
        created_at: string;
      }>
    >`
      select a.id, p.email, a.record_table, a.created_at::text
      from garage_activity a left join profiles p on p.id = a.actor_id
      where a.owner_id = ${id} order by a.created_at desc limit 50
    `,
  ]);
  return { members, invitations, received, activity };
}

export const actions = localizedActions({
  invite: async ({ locals, request, platform }) => {
    const form = await request.formData();
    const email = z
      .string()
      .email()
      .max(254)
      .safeParse(
        String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
      );
    const role = garageRole(form.get("role"));
    if (
      !email.success ||
      !role ||
      email.data === locals.user!.email?.toLowerCase()
    ) {
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invalidInviteEmail"),
      });
    }
    const token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const hash = await shareTokenHash(token);
    const created = await locals.db.begin(async (tx) => {
      await lockObjectOwner(tx as unknown as Sql, locals.user!.id);
      await tx`select id from profiles where id = ${locals.user!.id} for update`;
      const [pending] = await tx<Array<{ count: number }>>`
        select count(*)::int as count from garage_invitations
        where owner_id = ${locals.user!.id} and accepted_at is null and revoked_at is null and expires_at > now()
      `;
      if (Number(pending.count) >= 20) return false;
      await tx`insert into garage_invitations (owner_id, invited_email, role, token_hash, token_prefix, expires_at)
        values (${locals.user!.id}, ${email.data}, ${role}, ${hash}, ${token.slice(0, 12)}, now() + interval '7 days')`;
      return true;
    });
    return created
      ? { inviteUrl: `${siteUrl(platform)}/garage/invite/${token}` }
      : fail(400, {
          message: createTranslator(locals.locale)("sharing.pendingLimit"),
        });
  },
  revokeInvitation: async ({ locals, request }) => {
    const form = await request.formData();
    const id = z.string().uuid().safeParse(form.get("id"));
    if (!id.success)
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invalidInvitation"),
      });
    await locals.db`update garage_invitations set revoked_at = now()
      where id = ${id.data} and owner_id = ${locals.user!.id}`;
    return { ok: true };
  },
  revokeMember: async ({ locals, request }) => {
    const form = await request.formData();
    const id = z.string().uuid().safeParse(form.get("id"));
    if (!id.success)
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invalidAccess"),
      });
    await locals.db.begin(async (tx) => {
      await lockObjectOwner(tx as unknown as Sql, locals.user!.id);
      await tx`select id from profiles where id = ${locals.user!.id} for update`;
      const [member] = await tx<Array<{ member_id: string }>>`
        update garage_memberships set revoked_at = now()
        where id = ${id.data} and owner_id = ${locals.user!.id} returning member_id
      `;
      if (member)
        await tx`
        update garage_invitations set revoked_at = now()
        where owner_id = ${locals.user!.id} and accepted_at is null and revoked_at is null
          and invited_email = (select lower(email) from neon_auth."user" where id = ${member.member_id})
      `;
    });
    return { ok: true };
  },
  leave: async ({ locals, request }) => {
    const form = await request.formData();
    const id = z.string().uuid().safeParse(form.get("id"));
    if (!id.success)
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invalidAccess"),
      });
    await locals.db`update garage_memberships set revoked_at = now()
      where id = ${id.data} and member_id = ${locals.user!.id}`;
    return { ok: true };
  },
});
