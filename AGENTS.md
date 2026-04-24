# AGENTS.md

Use this file for agent-specific repo workflows. Keep broader product and frontend conventions in [`README.md`](/F:/Github/moto_track/README.md), [`CONTRIBUTING.md`](/F:/Github/moto_track/CONTRIBUTING.md), and [`.github/copilot-instructions.md`](/F:/Github/moto_track/.github/copilot-instructions.md).

## Validation Commands

- Windows Django checks:
  - `./.venv/Scripts/python.exe manage.py check`
  - `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
  - `./.venv/Scripts/python.exe manage.py test`
- Frontend build:
  - `npm run build:css`

## Repo Workflows

- Local CI helper:
  - `python scripts/local_ci.py`
  - Runs the repo's grouped pytest suite plus `bandit -r apps -ll` and `pip-audit -r requirements/prod.txt`.
- CI-equivalent test scope:
  - `pytest tests/unit tests/integration tests/system tests/regression tests/performance tests/security --cov=apps --cov-report=xml --cov-report=term -q`
  - In CI this runs after `python manage.py migrate --noinput` with `DJANGO_SETTINGS_MODULE=config.settings.test`.
- Docker test profile:
  - `docker compose --profile test up --build --abort-on-container-exit --exit-code-from test`
- Docker HTTPS edge profile:
  - `docker compose --profile prod --profile edge up -d --build`
  - Use this path only when Caddy should terminate TLS directly on the host.
