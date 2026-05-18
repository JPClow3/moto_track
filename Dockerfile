# syntax=docker/dockerfile:1.7

# I-L3: multi-stage build keeps the runtime image lean. Build stages carry
# Node + pip wheels + Tailwind binary; the runtime stage only ships the
# installed site-packages, the app code, and the generated static files.
# I-H1: Tailwind binary version is bumped via build-arg so caching keys are stable.

ARG PYTHON_VERSION=3.12-slim
ARG TAILWIND_VERSION=3.4.19


########################
# 0. Frontend vendor assets (from main)
########################
# Pulls vendored JS/CSS into /app/static/vendor without installing Node in the
# final image. Copied into the builder stage below.
FROM node:22-slim AS frontend-vendor

WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/copy_vendor_assets.mjs scripts/
RUN npm ci


########################
# 1. Builder
########################
FROM python:${PYTHON_VERSION} AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps into an isolated prefix we can copy into the runtime image.
COPY requirements/ /tmp/requirements/
ARG REQUIREMENTS_FILE=prod.txt
RUN pip install --prefix=/install --no-cache-dir -r /tmp/requirements/${REQUIREMENTS_FILE}

# Copy app source and build Tailwind + collect static files.
COPY . /app
COPY --from=frontend-vendor /app/static/vendor /app/static/vendor

ARG TAILWIND_VERSION
RUN curl -fsSL -o /tmp/tailwindcss \
      https://github.com/tailwindlabs/tailwindcss/releases/download/v${TAILWIND_VERSION}/tailwindcss-linux-x64 \
  && chmod +x /tmp/tailwindcss \
  && /tmp/tailwindcss \
       -i /app/static/css/input.css \
       -o /app/static/css/tailwind.generated.css \
       --config /app/tailwind.config.js \
       --minify

# Use the installed deps for collectstatic so we don't need pip in the next stage.
ENV PATH=/install/bin:$PATH PYTHONPATH=/install/lib/python3.12/site-packages
RUN DJANGO_SETTINGS_MODULE=config.settings.build python manage.py collectstatic --noinput


########################
# 2. Runtime
########################
FROM python:${PYTHON_VERSION} AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PATH=/install/bin:$PATH \
    PYTHONPATH=/install/lib/python3.12/site-packages

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libpq5 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python deps and the built application.
COPY --from=builder /install /install
COPY --from=builder /app /app

# I-C1 / I-H7: run as a dedicated non-root user. UID overridable via build arg.
ARG APP_UID=1000
RUN addgroup --gid ${APP_UID} app \
  && adduser --disabled-password --gecos "" --uid ${APP_UID} --gid ${APP_UID} app \
  && chown -R ${APP_UID}:${APP_UID} /app
USER ${APP_UID}:${APP_UID}

EXPOSE 8000

# I-L10: container healthcheck so orchestrators (compose, k8s, ECS) can route
# traffic only to ready instances. /healthz/ is exposed by the Django app and
# is listed in SECURE_REDIRECT_EXEMPT so this plain-HTTP probe reaches the
# view instead of being short-circuited by SECURE_SSL_REDIRECT's 301 (which
# `curl --fail` would otherwise treat as success — Codex P2).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT:-8000}/healthz/ || exit 1

# I-C1: migrations are now a release-phase concern, not part of the steady
# CMD. Operators run `python manage.py migrate` from a one-shot job (compose
# `web-migrate` profile, k8s init container, or a CI deploy step). The default
# CMD only boots gunicorn so the container becomes Ready predictably.
# I-H2: GUNICORN_WORKERS / GUNICORN_THREADS are env-driven for capacity tuning.
# `exec` ensures gunicorn becomes PID 1 so SIGTERM is delivered for graceful
# shutdown instead of being swallowed by the shell. Default threads matches
# docker-compose.yml (4) so the two surfaces don't diverge.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-4} --access-logfile - --error-logfile -"]
