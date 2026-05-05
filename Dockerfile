FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Runtime default; override at deploy time if needed.
ENV DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

COPY requirements/ /tmp/requirements/
ARG REQUIREMENTS_FILE=prod.txt
RUN pip install --no-cache-dir -r /tmp/requirements/${REQUIREMENTS_FILE}

COPY . /app

# Build Tailwind CSS using the standalone binary (no Node.js required).
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && curl -L -o /tmp/tailwindcss https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.19/tailwindcss-linux-x64 \
  && chmod +x /tmp/tailwindcss \
  && /tmp/tailwindcss -i /app/static/css/input.css -o /app/static/css/tailwind.generated.css --config /app/tailwind.config.js --minify \
  && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# collectstatic uses `config.settings.build` (placeholder secrets + S3 bucket name only for import).
RUN DJANGO_SETTINGS_MODULE=config.settings.build python manage.py collectstatic --noinput

EXPOSE 8000

RUN addgroup --gid 1000 app \
  && adduser --disabled-password --gecos "" --uid 1000 --gid 1000 app \
  && chown -R 1000:1000 /app

USER 1000:1000

# At runtime, `config.settings.prod` requires DJANGO_SECRET_KEY, DATABASE_URL, AWS_STORAGE_BUCKET_NAME,
# and typically DJANGO_ALLOWED_HOSTS (see `.env.example` and `docs/deploy/lightsail-s3.md`).
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
