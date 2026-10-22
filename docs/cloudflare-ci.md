# Cloudflare CI/CD

Cloudflare Pages remains the owner of the web app at moto-track, running format, lint, Svelte checks, unit tests and the web build. A separate Workers Builds trigger on moto-track-reminders tracks main from /workers/reminders, validates the source and deploys only that Worker when its code, domain imports, tests or dependency/configuration files change. It does not rebuild the web artifact. Runtime secrets and the daily cron stay on the existing Worker. GitHub CI runs on pull requests or manually; the old reminder deployment is manual emergency fallback. IndexNow and production-provider smoke remain independent.

Configured on 2026-10-22. Cloudflare settings live outside Git. Rollback: restore the prior build settings and re-enable push triggers in the retained GitHub workflow. Never run both automatic deployment owners at the same time.
