# Coolify deployment (Docker Compose)

This project is ready to run on Coolify using `docker-compose.yml`.

## What Coolify should manage

- **Reverse proxy + HTTPS** (Coolify's proxy)
- **Domain routing**
- **Environment variables / secrets**
- **App restarts**

This repo's Compose file intentionally does **not** include Nginx/Caddy/Traefik.
There is an optional `edge` profile with Caddy for self-hosted Docker Compose;
do **not** use that profile on Coolify (Coolify already terminates HTTPS).

## In Coolify

- **New Resource**: Docker Compose
- **Compose file**: `docker-compose.yml`
- **Start command / compose command**: `docker compose --profile prod up -d`
- **Expose service**: `web-prod`
- **Port**: `8000`

## Required environment variables (Coolify)

- `POSTGRES_PASSWORD`: strong password for the Postgres container
- `DJANGO_SECRET_KEY`: long random value (>= 50 chars)
- `DJANGO_ALLOWED_HOSTS`: comma-separated hosts (your domain(s) + optionally the server IP)
- `AWS_STORAGE_BUCKET_NAME`: S3 bucket for uploads (default file storage uses django-storages)
- `AWS_S3_REGION_NAME`: e.g. `us-east-1` (optional; default in app is `us-east-1`)

Optional:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: omit if the host uses an IAM instance profile / role with S3 access
- `AWS_S3_ENDPOINT_URL`: usually omit on AWS; set for S3-compatible endpoints if needed

`DJANGO_SETTINGS_MODULE` and `DJANGO_DEBUG` are set in `docker-compose.yml` for `web-prod`.

Example:

`DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com,54.86.112.205`

## Notes

- Static files are built into the image (`collectstatic` runs during the Docker build using `config.settings.build`).
- Uploaded **media** is stored in **S3** when using `config.settings.prod`. The `media_data` volume is an optional local path for `MEDIA_ROOT`; it does not replace S3 for `FileField` storage unless you change `STORAGES`.
