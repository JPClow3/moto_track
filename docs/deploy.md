# Deploy

Este guia cobre os dois caminhos de deploy suportados: **Lightsail VM** (Nginx + Gunicorn + S3) e **Coolify** (Docker Compose).

---

## Lightsail VM + Nginx + Gunicorn + S3

### Pré-requisitos

- Lightsail Region: **us-east-1** (Virginia) / Zone A (**us-east-1a**)
- Static IP (anexar na instance)
- Bucket S3: **`moto-track`**
- Python 3.12+ e Node 18+ (para build de assets localmente/CI)

### 1) AWS: S3

- Criar bucket: `moto-track` (região `us-east-1`)
- Recomendações:
  - Bloquear acesso público (uploads privados por padrão)
  - Versioning opcional

#### IAM

Crie um usuário/role com permissão mínima para o bucket.

Exemplo de policy (ajuste o ARN do bucket):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MotoTrackBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::moto-track",
        "arn:aws:s3:::moto-track/*"
      ]
    }
  ]
}
```

### 2) Lightsail: instance + rede

1. Criar instance Linux (Debian/Ubuntu)
2. Anexar o Static IP
3. Liberar portas:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS) — recomendado com domínio + Let’s Encrypt

### 3) Provisionar servidor (VM)

#### Pacotes do sistema (exemplo Ubuntu)

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git
```

Se usar Postgres externo, normalmente você também precisa:

```bash
sudo apt install -y libpq-dev
```

#### Usuário/app dir

```bash
sudo adduser --disabled-password --gecos "" mototrack
sudo mkdir -p /srv/mototrack
sudo chown -R mototrack:mototrack /srv/mototrack
```

### 4) App: código + venv

```bash
sudo -iu mototrack
cd /srv/mototrack
git clone <seu-repo> app
cd app

python3 -m venv .venv
./.venv/bin/pip install -r requirements/base.txt
```

#### Alternativa: Docker (mesmo servidor)

Se preferir container em vez de venv + Nginx na VM, use o `Dockerfile` deste repositório e passe as mesmas variáveis (em especial `DJANGO_SECRET_KEY`, `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS`, `AWS_STORAGE_BUCKET_NAME` e credenciais AWS ou IAM role). O profile Compose `web-prod` em `docker-compose.yml` documenta variáveis típicas.

### 5) Variáveis de ambiente (produção)

Este projeto exige `DJANGO_SECRET_KEY` e usa `config.settings.prod` em produção.

Exemplo (arquivo `/etc/systemd/system/mototrack.env`):

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<gere-um-valor-longo-aleatorio>
DJANGO_ALLOWED_HOSTS=54.86.112.205

DATABASE_URL=postgres://...

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=moto-track
AWS_S3_REGION_NAME=us-east-1

# Opcional:
# Para AWS "puro", normalmente você pode OMITIR isso.
# Se usar, mantenha como endpoint S3 compatível.
AWS_S3_ENDPOINT_URL=https://moto-track.s3.us-east-1.amazonaws.com/
```

### 6) Build/collectstatic + migrations

Na máquina de build (ou na VM antes do primeiro deploy), gere o CSS Tailwind minificado; o `Dockerfile` já corre `collectstatic`, mas o fluxo em venv precisa disto explicitamente:

```bash
npm ci
npm run build:css
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py collectstatic --noinput
```

Criar admin (sem prompt de email):

```bash
./.venv/bin/python manage.py createadmin
```

### 7) Gunicorn (systemd)

Crie `/etc/systemd/system/mototrack.service`:

```ini
[Unit]
Description=Moto Track (gunicorn)
After=network.target

[Service]
User=mototrack
Group=www-data
WorkingDirectory=/srv/mototrack/app
EnvironmentFile=/etc/systemd/system/mototrack.env
ExecStart=/srv/mototrack/app/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mototrack
sudo systemctl status mototrack
```

### 8) Nginx (reverse proxy)

Crie `/etc/nginx/sites-available/mototrack`:

```nginx
server {
    listen 80;
    server_name 54.86.112.205;

    location /static/ {
        alias /srv/mototrack/app/staticfiles/;
    }

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:8000;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/mototrack /etc/nginx/sites-enabled/mototrack
sudo nginx -t
sudo systemctl restart nginx
```

### 9) HTTPS (recomendado)

Para HTTPS com Let’s Encrypt, você precisa de um **domínio** apontando para o Static IP.

- Aponte DNS (A/AAAA) para o IP
- Use certbot para Nginx

### 10) Observações sobre media no S3

- O `DEFAULT_FILE_STORAGE` legado não é usado aqui; o projeto usa `STORAGES["default"]`.
- Em produção, `STORAGES["default"]` está configurado para `storages.backends.s3boto3.S3Boto3Storage`.
- Se quiser servir media público via URL direta, pode ajustar `AWS_QUERYSTRING_AUTH=False` e políticas/bucket/public access conforme o modelo de privacidade.
- Em instâncias AWS com **IAM instance role**, não defina `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` no ambiente; o boto3 usa a cadeia de credenciais padrão.

---

## Coolify (Docker Compose)

Este projeto está pronto para rodar no Coolify usando `docker-compose.yml`.

### O que o Coolify gerencia

- Reverse proxy + HTTPS (próprio proxy do Coolify)
- Domain routing
- Environment variables / secrets
- App restarts

O Compose file deste repo separa o reverse proxy (Caddy) em um profile `edge` para deploys autogerenciados via Docker Compose. No Coolify, **não** use o profile `edge` — o Coolify já termina HTTPS e gerencia o edge proxy.

### Configuração no Coolify

- **New Resource**: Docker Compose
- **Compose file**: `docker-compose.yml`
- **Start command / compose command**: `docker compose --profile prod up -d`
- **Expose service**: `web-prod`
- **Port**: `8000`

### Variáveis de ambiente obrigatórias (Coolify)

- `POSTGRES_PASSWORD`: senha forte para o container Postgres
- `DJANGO_SECRET_KEY`: valor longo e aleatório (>= 50 chars)
- `DJANGO_ALLOWED_HOSTS`: hosts separados por vírgula (seu(s) domínio(s) + opcionalmente o IP do servidor)
- `AWS_STORAGE_BUCKET_NAME`: bucket S3 para uploads (default file storage usa django-storages)
- `AWS_S3_REGION_NAME`: ex: `us-east-1` (opcional; default no app é `us-east-1`)

Opcional:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: omita se o host usar IAM instance profile / role com acesso S3
- `AWS_S3_ENDPOINT_URL`: normalmente omita na AWS; defina para endpoints S3-compatíveis se necessário

`DJANGO_SETTINGS_MODULE` e `DJANGO_DEBUG` são definidos em `docker-compose.yml` para o serviço `web-prod`.

Exemplo de `DJANGO_ALLOWED_HOSTS`:

```text
your-domain.com,www.your-domain.com,54.86.112.205
```

### Notas

- Static files são built na imagem (`collectstatic` roda durante o Docker build usando `config.settings.build`).
- Uploads de **media** são armazenados em **S3** quando usando `config.settings.prod`. O volume `media_data` é um caminho local opcional para `MEDIA_ROOT`; ele não substitui o S3 para `FileField` storage a menos que você altere `STORAGES`.

---

## VPS com Docker Compose direto (sem Coolify/Traefik/Nginx externo)

Para subir Caddy na frente do Django com certificado TLS automático, use:

```bash
docker compose --profile prod --profile edge up -d --build
```

Isso publica `80/443` no host, redireciona `www` para o domínio principal e entrega o app em HTTPS. Veja o `Caddyfile` em `deploy/caddy/`.
