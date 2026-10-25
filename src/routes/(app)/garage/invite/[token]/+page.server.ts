import { localizedActions } from "$server/domain/localized-actions";
import { createTranslator } from "$lib/i18n";
import { error, fail, redirect } from "@sveltejs/kit";
import { shareTokenHash } from "$server/domain/sale-report-share";
import type { GarageRole } from "$server/domain/garage-access";
import type { Sql } from "postgres";
import { lockAccountActor, lockObjectOwner } from "$server/db/owner-lock";
import {
  requestEmailVerification,
  verifyEmailAddress,
} from "$server/auth/session";

async function invitationFor(locals: App.Locals, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw error(
      404,
      createTranslator(locals.locale)("sharing.invitationNotFound"),
    );
  const [invitation] = await locals.db<
    Array<{
      id: string;
      owner_id: string;
      invited_email: string;
      role: GarageRole;
    }>
  >`
    select id, owner_id, invited_email, role from garage_invitations
    where token_hash = ${await shareTokenHash(token)} and revoked_at is null
      and accepted_at is null and expires_at > now()
  `;
  if (!invitation)
    throw error(
      404,
      createTranslator(locals.locale)("sharing.invitationUnavailable"),
    );
  return invitation;
}

export async function load({ locals, params }) {
  const invitation = await invitationFor(locals, String(params.token ?? ""));
  const [identity] = await locals.db<
    Array<{ email: string; emailVerified: boolean }>
  >`
    select email, "emailVerified" from neon_auth."user" where id = ${locals.user!.id}
  `;
  return {
    role: invitation.role,
    matchesEmail: identity?.email.toLowerCase() === invitation.invited_email,
    verified: identity?.emailVerified === true,
  };
}

export const actions = localizedActions({
  sendVerification: async (event) => {
    const { locals } = event;
    const invitation = await invitationFor(
      event.locals,
      String(event.params.token ?? ""),
    );
    if (event.locals.user!.email?.toLowerCase() !== invitation.invited_email)
      return fail(403, {
        message: createTranslator(locals.locale)("sharing.signInInvited"),
      });
    const result = await requestEmailVerification(event);
    return result.ok
      ? { verificationSent: true }
      : fail(400, { message: result.message });
  },
  verifyEmail: async (event) => {
    const { locals } = event;
    const invitation = await invitationFor(
      event.locals,
      String(event.params.token ?? ""),
    );
    if (event.locals.user!.email?.toLowerCase() !== invitation.invited_email)
      return fail(403, {
        message: createTranslator(locals.locale)("sharing.signInInvited"),
      });
    const form = await event.request.formData();
    const result = await verifyEmailAddress(
      event,
      String(form.get("code") ?? "").trim(),
    );
    return result.ok
      ? { verified: true }
      : fail(400, { message: result.message });
  },
  accept: async ({ locals, params }) => {
    const invitation = await invitationFor(locals, String(params.token ?? ""));
    if (invitation.owner_id === locals.user!.id)
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.alreadyOwner"),
      });
    const [identity] = await locals.db<
      Array<{ email: string; emailVerified: boolean }>
    >`
      select email, "emailVerified" from neon_auth."user" where id = ${locals.user!.id}
    `;
    if (
      !identity?.emailVerified ||
      identity.email.toLowerCase() !== invitation.invited_email
    ) {
      return fail(403, {
        message: createTranslator(locals.locale)("sharing.verifyInvitedEmail"),
      });
    }
    const membershipId = await locals.db.begin(async (tx) => {
      await lockAccountActor(tx as unknown as Sql, locals.user!.id);
      await lockObjectOwner(tx as unknown as Sql, invitation.owner_id);
      await tx`select id from profiles where id = ${invitation.owner_id} for update`;
      const [pending] = await tx<Array<{ id: string }>>`
        select id from garage_invitations where id = ${invitation.id}
          and revoked_at is null and accepted_at is null and expires_at > now() for update
      `;
      if (!pending) return null;
      const [membership] = await tx<Array<{ id: string }>>`
        insert into garage_memberships (owner_id, member_id, role)
        values (${invitation.owner_id}, ${locals.user!.id}, ${invitation.role})
        on conflict (owner_id, member_id) do update set role = excluded.role, revoked_at = null returning id
      `;
      await tx`update garage_invitations set accepted_at = now(), accepted_by = ${locals.user!.id} where id = ${invitation.id}`;
      return membership.id;
    });
    if (!membershipId)
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invitationGone"),
      });
    throw redirect(303, `/garage/shared/${membershipId}`);
  },
});
