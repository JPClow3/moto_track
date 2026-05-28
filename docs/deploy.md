# Deploy

Este guia assume **Dokploy em uma EC2 na AWS** como caminho principal de
produção. Os outros caminhos continuam documentados como fallback:
**Docker Compose direto com Caddy** e **VM manual com Gunicorn + Nginx**.

Use [`.env.example`](../.env.example) como fonte canônica das variáveis de
ambiente. Este documento só destaca o que muda por alvo de deploy.

---

## Dokploy + EC2 (recomendado)

Este é o fluxo mais alinhado com o estado atual do repositório.

### O que muda em relação ao Compose "puro"

- Use **Dokploy Docker Compose**, não **Docker Stack**. Este repositório usa
  `build:` no [docker-compose.yml](../docker-compose.yml), e o modo Stack não
  suporta esse fluxo.
- Use o **proxy/domínios do Dokploy**. Não suba o serviço `caddy` no Dokploy.
- Faça o deploy do **profile `prod`**. O profile `edge` só existe para o
  fallback de Compose direto com Caddy.
- Use o recurso nativo de **Domains** do Dokploy em vez de labels Traefik
  manuais.

### 1) Preparar a EC2

- Ubuntu 22.04+ é o caminho mais simples.
- Security Group:
  - `22/tcp` liberada apenas para IPs administrativos
  - `80/tcp` e `443/tcp` liberadas para a internet
- Associe um domínio ao IP público da instância.
- Se a instância for acessar S3 diretamente, prefira um **IAM instance role**
  com acesso mínimo ao bucket em vez de `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY`.

### 2) Registrar o servidor no Dokploy

Siga o fluxo de **Remote Server** do Dokploy para:

1. criar/adicionar a chave SSH no painel;
2. cadastrar a EC2 como servidor remoto;
3. executar o `Setup Server` uma única vez.

### 3) Criar a aplicação Docker Compose

No Dokploy:

1. crie uma aplicação do tipo **Docker Compose**;
2. aponte para este repositório;
3. use o [docker-compose.yml](../docker-compose.yml);
4. mantenha o modo **Docker Compose**.

### 4) Variáveis de ambiente

Copie o bloco **Production Baseline** de [`.env.example`](../.env.example) para
as variáveis do ambiente no Dokploy.

Obrigatórias na prática:

- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `AWS_STORAGE_BUCKET_NAME`

Fortemente recomendadas:

- `APP_BUILD_ID`
- `WEB_PUSH_PUBLIC_KEY`
- `PUSH_ENCRYPTION_KEY`
- `SESSION_COOKIE_AGE`

Observações:

- Em EC2 com IAM role, normalmente você **omite**
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- Se `APP_BUILD_ID` não for definido, a aplicação cai no default `dev`, o que
  piora o rastreamento de release no Sentry.

### 5) Profile de deploy no Dokploy

O compose deste repositório separa dev/test/prod com **profiles**. Para o
Dokploy incluir os serviços corretos, configure o deploy para executar o
profile `prod`.

Na prática, isso significa que o comando de Compose do Dokploy precisa incluir:

```text
--profile prod
```

Se você também for subir a stack de observabilidade, inclua:

```text
--profile prod --profile observability
```

Depois disso, use o **Preview Compose** do Dokploy para confirmar que o deploy
inclui `web-prod`, `celery-worker-prod`, `celery-beat-prod`, `migrate`,
`redis` e `db`.

> Inferência importante: o Dokploy documenta que permite acrescentar flags ao
> comando interno de Docker Compose; aqui a flag necessária é `--profile prod`
> porque os serviços de produção deste repositório não sobem sem ela.

### 6) Domínio e TLS

No Dokploy, adicione o domínio na aba **Domains** da aplicação.

- Caminho recomendado: **Domains do Dokploy**
- Não use o serviço `caddy` neste cenário
- Não adicione labels Traefik manualmente, a menos que tenha um motivo muito
  específico

### 7) Auto deploy

Se o deploy de produção passa por Dokploy, prefira o **Auto Deploy** nativo do
Dokploy (GitHub/webhook/API). O workflow
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) foi mantido
apenas como fallback manual para o caminho legado de SSH direto.

---

## VM manual (legado) em AWS com Nginx + Gunicorn + S3

O passo a passo abaixo continua válido para quem quiser operar a instância
manualmente com `systemd` + Nginx, fora do Dokploy.

### Pré-requisitos

- Região AWS: **us-east-1** (Virginia) é um baseline simples
- Elastic IP ou equivalente anexado à instância
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

### 2) AWS: instância + rede

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

Se preferir container em vez de venv + Nginx na VM, use o `Dockerfile` deste
repositório e parta do bloco de produção em [`.env.example`](../.env.example).
O `docker-compose.yml` já define `DJANGO_SETTINGS_MODULE=config.settings.prod`
para o serviço `web-prod`.

### 5) Variáveis de ambiente (produção)

Este projeto exige `DJANGO_SECRET_KEY` e usa `config.settings.prod` em
produção. Para evitar drift, copie o bloco **Production Baseline** de
[`.env.example`](../.env.example) e adapte para o host.

Exemplo (arquivo `/etc/systemd/system/mototrack.env`):

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<gere-um-valor-longo-aleatorio>
DJANGO_ALLOWED_HOSTS=54.86.112.205
APP_BUILD_ID=<git-sha-ou-release>
SESSION_COOKIE_AGE=2592000
CELERY_BROKER_URL=redis://redis:6379/0

DATABASE_URL=postgres://...

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=moto-track
AWS_S3_REGION_NAME=us-east-1
WEB_PUSH_PUBLIC_KEY=...
PUSH_ENCRYPTION_KEY=...

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

## VPS com Docker Compose direto (fallback sem Dokploy)

Para subir Caddy na frente do Django com certificado TLS automático, use:

```bash
docker compose --profile prod --profile edge up -d --build
```

Isso publica `80/443` no host, redireciona `www` para o domínio principal e entrega o app em HTTPS. Veja o `Caddyfile` em `deploy/caddy/`.
