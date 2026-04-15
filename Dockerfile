FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

COPY requirements/ /tmp/requirements/
RUN pip install --no-cache-dir -r /tmp/requirements/prod.txt

COPY . /app

RUN DJANGO_SETTINGS_MODULE=config.settings.build python manage.py collectstatic --noinput

EXPOSE 8000

RUN addgroup --gid 1000 app \
  && adduser --disabled-password --gecos "" --uid 1000 --gid 1000 app \
  && chown -R 1000:1000 /app

USER 1000:1000

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
