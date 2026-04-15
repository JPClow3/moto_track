# Coolify deployment (Docker Compose)

This project is ready to run on Coolify using `docker-compose.coolify.yml`.

## What Coolify should manage

- **Reverse proxy + HTTPS** (Coolify's proxy)
- **Domain routing**
- **Environment variables / secrets**
- **App restarts**

This repo's Compose file intentionally does **not** include Nginx/Caddy/Traefik.

## In Coolify

- **New Resource**: Docker Compose
- **Compose file**: `docker-compose.coolify.yml`
- **Expose service**: `web`
- **Port**: `8000`

## Required environment variables (Coolify)

- `POSTGRES_PASSWORD`: strong password for the Postgres container
- `DJANGO_SETTINGS_MODULE`: `config.settings.prod`
- `DJANGO_DEBUG`: `0`
- `DJANGO_SECRET_KEY`: long random value (>= 50 chars)
- `DJANGO_ALLOWED_HOSTS`: comma-separated hosts (your domain(s) + optionally the server IP)

Example:

`DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com,54.86.112.205`

## Notes

- Static files are built into the image (`collectstatic` runs during the Docker build).
- Uploaded media is persisted in the `media_data` volume at `/data/media`.
