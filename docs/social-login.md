# Google and Apple sign-in

Moto Track uses Neon's Managed Better Auth. The [2026-10-30 release](https://neon.com/docs/changelog/2026-10-30)
adds Apple and Microsoft providers alongside the existing Google provider.
Follow [Neon's OAuth guide](https://neon.com/docs/auth/guides/setup-oauth) for provider credentials.

## Application configuration

`NEON_AUTH_SOCIAL_PROVIDERS` is a server-only comma-separated allowlist. It defaults
to `google` to preserve the current login. Set it to `google,apple` only after
Apple credentials have been saved on the matching Neon branch. An explicit value
of `none` hides both buttons. The allowlist controls both rendered buttons and
server actions; it does not create provider credentials in Neon.

The build's CSP `form-action` allowlist includes the branch's Neon Auth origin
and Google's and Apple's sign-in origins, because Chromium checks the entire
redirect chain after a form POST. Set `PUBLIC_NEON_AUTH_URL` at build time when
building for a non-production branch; the default is Moto Track's production
Auth origin. Unrelated external form destinations remain blocked.

The same buttons are available from sign-in and account creation. Native
`MotoTrackNative/*` webviews continue to use email/password until a native OAuth
handoff is implemented. The callback exchanges Neon's verifier with the existing
HTTP-only challenge cookie before setting the app's first-party session cookie.

## Production target

- Neon project: `misty-meadow-08424188` (`moto-track`).
- Neon branch: `br-lingering-darkness-acnan3z2` (`production`).
- Auth URL: `https://ep-damp-bar-acu29m6g.neonauth.sa-east-1.aws.neon.tech/neondb/auth`.
- Trusted app origins: `https://moto-track.net`, `https://moto-track.pages.dev`.
- Google Cloud project: `moto-track-513221` in `jpclow.dev`, owned through
  `joao@jpclow.dev`. Keep this separate from Lorebound and tat2.

On 2026-10-30 the Google consent screen was published for external users and
the production Neon provider was changed from shared to app-owned credentials.
The HTTP handshake requests only `email profile openid` and uses the production
Neon `/callback/google` redirect. Apple credentials remain unconfigured and
the Apple button stays disabled by the server allowlist.

Provider redirects must be the Auth URL followed by `/callback/google` or
`/callback/apple`. The later application landing URL is `/auth/callback?next=...`;
do not register that application route as the provider redirect.

## Apple prerequisites

Apple's web setup does not require an Apple device. It requires an Apple Developer
membership, a primary App ID with Sign in with Apple, a Services ID, a Team ID,
a Key ID, and the full `.p8` signing key. Use the account/team that owns Moto Track.
The tat2 team belongs to another project and must not be used.

Register the Auth hostname as an Apple domain and the full `/callback/apple`
URL as the return URL. Store the Services ID as Neon's `client_id`, the full PEM
as `client_secret`, and supply `apple_team_id` and `apple_key_id`. Neon generates
Apple's short-lived client-secret JWT; the app never receives the signing key.
The current Neon connector's provider mutation schema does not include Apple;
use the Console, API, or Neon CLI 8.14.0+ with `--oauth-client-secret-file`.

## Verification

Before replacing Google's shared development credentials, complete the consent
screen, publish the external app, and check the authorized redirect. Confirm
the resulting Google authorization URL uses the app-owned Client ID. Then
exercise a real login, callback, session restoration, protected access and
sign-out. A redirect to Google or Apple alone does not prove a completed login.

Never commit OAuth secrets or `.p8` keys. Credentials belong in Neon's provider
configuration, not a `PUBLIC_*` variable or browser bundle.
