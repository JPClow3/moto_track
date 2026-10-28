# Dodo Payments audit — 28 October 2026

## Result

Live pricing, checkout quotes, webhook configuration, existing webhook processing, and subscription entitlement reconciliation passed inspection. One checkout recovery bug was fixed locally. The fix has not been committed, pushed, or deployed.

## Production evidence

- Monthly product: BRL 1490 every month. Yearly product: BRL 9900 every year. Both are tax-inclusive recurring products with a seven-day free trial, a required payment method, no paid trial amount, and a 20-year subscription term.
- Four live checkout preview requests returned HTTP 200. First-time monthly/yearly signups quote zero due today and seven trial days. Returning subscribers quote BRL 1490/9900 due immediately, with the corresponding recurring amounts. Preview requests do not create payable sessions or charge a card.
- The webhook at `https://moto-track.net/billing/webhook/dodo` is enabled. Its filters include the required subscription lifecycle, payment, refund, and dispute events. Its provider signing secret matches local configuration; the secret was not logged.
- Production pricing and health routes return HTTP 200. Checkout and portal redirect unauthenticated users to sign-in, preserving the yearly checkout interval. An unsigned webhook returns HTTP 400.
- The production Neon billing configuration is `live_mode`. There are zero uncertain `pending:` checkout intents. All 16 existing Dodo ledger events are processed, with zero pending events.
- The one linked production subscription is canonically `on_hold`. Its successful BRL 0 trial authorization was followed by a failed BRL 1490 renewal. Dodo reports `INSUFFICIENT_FUNDS`. Moto Track correctly stores Free access and no grace period for that subscription. No customer payment method, subscription, or billing setting was changed during this audit.

## Fixed checkout recovery

The route durably reserves a checkout intent before contacting Dodo. Previously, failures in read-only product validation or subscription-history lookup left that reservation permanently pending even though no payable session had been created. A customer could not retry without operator intervention.

A dedicated preflight error now identifies failures before session creation. Under the account lock, the route clears only its own matching unused intent. Provider session-creation failures and uncertain post-creation persistence retain the existing fail-closed behavior. An existing subscription discovered during preflight also releases the unused intent before redirecting to the portal.

Three regression cases cover product lookup failure, history lookup failure, and an existing subscription appearing during preflight. The existing lost-response test continues to verify that an uncertain CREATE is never blindly retried.

## Validation

Windows Node dependency loading stalled on this host. Validation used an isolated Linux copy with the current billing implementation and tests, plus the repository baseline for unrelated files. Resolved dependency versions and integrity hashes matched the existing Linux installation; concurrent unrelated launch/UI changes were preserved and are outside this validation.

| Check                                      | Result                     |
| ------------------------------------------ | -------------------------- |
| Unit suite                                 | 91 files, 708 tests passed |
| Final billing suites                       | 6 files, 128 tests passed  |
| SvelteKit sync + svelte-check              | 0 errors, 0 warnings       |
| ESLint                                     | Passed                     |
| Prettier, changed billing files            | Passed                     |
| Vite production build + Cloudflare adapter | Passed                     |
| Production browser billing redirects       | 2 tests passed             |

## Acceptance still required

- Deploy the local recovery fix through the normal release flow.
- Verify a successful nonzero payment and paid renewal. The inspected production history proves trial authorization and failure handling, not successful paid collection.
- Complete authenticated provider test-mode acceptance for hosted checkout completion, customer portal cancellation, recovery after a failed renewal, full/partial refunds, disputes, and deletion. These flows have unit coverage but were not executed as financial operations in this audit.
- Local `.env` database credentials were rejected. Production inspection succeeded through the connected Neon service; local credentials were left unchanged.

Provider references: [Checkout Sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [Subscription Integration Guide](https://docs.dodopayments.com/developer-resources/subscription-integration-guide), and [Webhooks](https://docs.dodopayments.com/developer-resources/webhooks).
