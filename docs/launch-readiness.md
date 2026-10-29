# Launch readiness — 28 October 2026

This is a preparation and evidence record, not a claim that the stores have approved the app.

## Completed in this launch preparation

- Added a public demonstration with fictional data and working, keyboard-accessible views for costs, fuel, maintenance and reminders.
- Added installation instructions for iPhone/iPad, Android and desktop, plus a support page using the configured support contact.
- Added campaign photography to the landing page and demonstration; optimized WebP assets keep the original PNG masters outside the public bundle.
- Added three accessible SVG motion designs with reduced-motion support and replay, plus exported promotional MP4s.
- Prepared Apple, Google and Microsoft artwork, icons, listing copy, editable rendering scripts and a local gallery at `launch-assets/index.html`.
- Improved PWA identity, scope, description, shortcuts and a dedicated safe-zone maskable icon.
- Added native Android and Windows clients and an iOS Xcode project. The user explicitly chose the Xcode project without an IPA build for now.
- Added native mobile purchase restrictions and email/password sign-in fallback. Browser billing and Google OAuth remain available.

See [the asset guide](../launch-assets/README.md) and [native build instructions](../native/README.md).

## Evidence

See [the final validation record](launch-validation.md) for source checks, browser results and package evidence. Artifact checksums are included in the delivered native kit. Public coverage and authenticated/provider coverage must remain distinguishable. An unavailable or skipped provider test does not prove production acceptance.

The Windows desktop executable was launched locally; its sign-in surface and native reload control were inspected. No account was signed into or mutated through that production-connected native smoke check.

Android APK/AAB builds and release lint are local evidence. No physical Android-device acceptance is claimed. The iOS project has not been compiled on a Mac.

Authenticated QA uses a dedicated temporary Neon branch, `launch-qa-20261028`, created from the existing release verification branch, with its own database and Auth endpoint, a synthetic account and local storage emulation. Its scheduled expiry is 30 October 2026. Production database, Auth configuration, R2 and payment secrets are excluded from that local environment.

## Required before public release

1. Publish the reviewed web code and confirm the native distribution guards, support and installation routes on the release origin.
2. Complete account registration/recovery, data persistence, ownership, deletion, attachment and offline acceptance on the actual release environment and native devices. Confirm the real Cloudflare Hyperdrive/R2 boundary.
3. Verify Dodo signed webhooks, renewal, cancellation, failed payment, refunds/disputes, and scheduled email/push using the intended provider environments. Local contracts cannot replace delivery and transaction evidence.
4. Configure isolated Cloudflare preview bindings before using hosted previews for acceptance. The repository's existing deployment audit identified shared production preview resources; this task does not change those bindings.
5. Confirm app/bundle identities, Microsoft publisher identity, signing ownership, store account/trader details, privacy declarations, age ratings and review access. Replace provisional development identities and sign store binaries.
6. Resolve the store-approved mobile subscription model before enabling native paid upgrades. Assess Apple's minimum functionality and payment rules and Google's payment rules against the final binaries. The current mobile clients expose no hosted purchasing.
7. Capture the final signed builds for store screenshot slots. The supplied promotional panels visibly use the public web demonstration and illustrative numbers.

## Product scope still dependent on partners

In-app Mercado Livre purchasing and real insurance quotations still require supported partner contracts and credentials, as recorded in the existing [completion audit](completion-audit.md). Search links and manually recorded insurance are not purchases or live quotations. The launch copy does not advertise those unfinished integrations.

## Primary store references

- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Microsoft screenshots and images](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images)
- [Microsoft WebView2 WinForms](https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/winforms)
