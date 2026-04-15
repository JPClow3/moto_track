FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Runtime default; override at deploy time if needed.
ENV DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

COPY requirements/ /tmp/requirements/
RUN pip install --no-cache-dir -r /tmp/requirements/prod.txt

COPY . /app

# Static CSS: this image does not run Node. Commit an up-to-date `static/css/tailwind.generated.css`
# (`npm run build:css` on the host/CI) before `docker build`, or add a multi-stage Node build here.

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
