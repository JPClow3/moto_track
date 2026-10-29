# Cloudflare CI/CD

Cloudflare Pages remains the owner of the web app at moto-track, running format, lint, Svelte checks, unit tests and the web build. A separate Workers Builds trigger on moto-track-reminders tracks main from /workers/reminders, validates the source and deploys only that Worker when its code, domain imports, tests or dependency/configuration files change. It does not rebuild the web artifact. Runtime secrets and the daily cron stay on the existing Worker. GitHub CI runs on pull requests or manually; the old reminder deployment is manual emergency fallback. IndexNow and production-provider smoke remain independent.

Configured on 2026-10-22. Cloudflare settings live outside Git. Rollback: restore the prior build settings and re-enable push triggers in the retained GitHub workflow. Never run both automatic deployment owners at the same time.

## GitHub Actions runtime controls

Updated on 2026-10-29 after reviewing Actions runtime:

- Draft PRs run format, lint, Svelte checks, unit tests, migration verification and the production build under a separate `Draft checks` name. Their green result cannot satisfy the required full-suite check. Keep a PR in draft while iterating to avoid starting the authenticated browser suite for every push.
- Marking a PR ready for review triggers the full authenticated E2E suite. Subsequent pushes and reopened ready PRs also run it. The required `Lint, Check, and Test` check keeps its existing name; there are no workflow-level path filters or E2E opt-outs for ready PRs. GitHub prevents merging draft PRs.
- Each newer update cancels the older CI run for the same PR. Converting a PR back to draft also cancels its previous full run. Manually dispatched runs have their own concurrency groups.
- PR E2E stops at the first failure and has a 30-minute step limit inside a 40-minute job. Browser actions have a 15-second limit and navigations a 60-second limit; multi-step acceptance tests retain their overall journey budgets.
- To collect all failures, dispatch CI with **full_diagnostics** enabled. This still runs the entire validation pipeline, disables E2E fail-fast, and allows 40 minutes for E2E inside a 50-minute job. Locally, use `npm run test:e2e -- --max-failures=0` to override CI fail-fast.
- Each disposable Neon branch expires two hours after creation. The action retains its default suspend setting for compatibility with Neon Free. Cleanup still runs on success, failure and cancellation, using the exact run-specific branch name if creation outputs were lost. Expiry is the fallback if cleanup cannot finish.

Automatic web and reminder deployments remain owned by Cloudflare. These controls do not change CodeQL, IndexNow or the manual production-provider smoke workflow.
