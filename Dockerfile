FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.prod
ARG BUILD_DJANGO_SECRET_KEY=build-only-secret-key-not-for-runtime
ENV DJANGO_SECRET_KEY=${BUILD_DJANGO_SECRET_KEY}

WORKDIR /app

COPY requirements/base.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app

RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py ensure_admin && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
