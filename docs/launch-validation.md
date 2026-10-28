# Launch validation — 28 October 2026

Validated against the delivered source.

| Check                             | Result                                                                   |
| --------------------------------- | ------------------------------------------------------------------------ |
| Svelte/TypeScript                 | Passed; 0 errors, 0 warnings                                             |
| ESLint                            | Passed                                                                   |
| Prettier                          | Passed                                                                   |
| Unit suite                        | 722 passed in 95 files                                                   |
| Production build                  | Passed with the Cloudflare adapter                                       |
| Integrated Playwright suite       | 52 passed, 2 skipped                                                     |
| Corrected Free reminder-cap check | Targeted rerun passed (setup + test, 2 passed)                           |
| Android                           | Debug APK, unsigned release AAB and release lint passed                  |
| Windows                           | Self-contained x64 publish and MakeAppx schema/package validation passed |
| iOS                               | Plists parse; Xcode project supplied, compilation deferred by user       |
| Motion exports                    | 3 H.264 videos; 1080 × 1920, 24 fps, 6 seconds, no audio                 |

The integrated browser run used a disposable Neon/Auth branch and local storage emulation. It covered the new public pages, responsive layouts, keyboard access, reduced motion, native distribution guards, records, odometers, account export, calendar access, shared access, reminder rules and offline retries.

One integrated skip was the Free-plan reminder-cap helper: it expected “Free” while the UI displays “Moto Track Free”. The helper was corrected, and that check then passed independently. The remaining skip was live provider acceptance, which was deliberately disabled without provider credentials. No real payment, outbound notification, production R2 transaction or native-device acceptance is evidenced by these results.

The Windows executable was opened locally and its hosted sign-in screen and reload control were inspected without signing in. The native clients depend on the hosted application's deployed version; deploy the accompanying web changes before native release acceptance.

Native package SHA-256 checksums and metadata are in [the package inventory](../native/packages/inventory.json). These local packages are previews or unsigned release inputs; store identity, signing, physical-device testing, final native screenshots and provider acceptance remain release gates in [launch readiness](launch-readiness.md).
