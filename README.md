# Moto Track

Plataforma pessoal de gestão de motocicleta criada para centralizar uso, custos, manutenção e documentação em um único lugar.

A proposta é transformar o controle da moto em algo simples, confiável e útil no dia a dia, sem planilhas soltas, anotações dispersas ou ferramentas complexas.

---

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Painel** | Resumo da situação atual, últimos eventos e alertas |
| **Abastecimentos** | Histórico de reabastecimentos, consumo e gastos |
| **Manutenções** | Serviços realizados, peças usadas e intervalos preventivos |
| **Pneus** | Catálogo estruturado e histórico de instalação/desgaste |
| **Documentos** | Arquivos, metadados e acesso rápido (CRLV, seguro, manual) |
| **Lembretes** | Alertas por data, km ou intervalo |
| **Despesas** | Taxas anuais (IPVA, DPVAT, licenciamento) |
| **Inventário** | Estoque de peças e itens de manutenção |
| **Blog** | Artigos e guias públicos (SEO/forum) |
| **Relatórios** | Evolução de custos e uso ao longo do tempo |
| **API** | Endpoints REST para dados principais |
| **Contas** | Autenticação e adaptadores de conta (django-allauth) |

---

## Stack

- **Backend**: Django (monolith), django-environ, django-money, django-bleach, django-autocomplete-light
- **Auth**: django-allauth + django-allauth-ui
- **Forms**: django-crispy-forms + crispy-tailwind
- **Templates**: django-cotton, HTMX, Alpine.js
- **Frontend**: Tailwind CSS, Chart.js, Lucide icons
- **Banco**: SQLite (dev) · PostgreSQL (prod)
- **Infraestrutura**: Docker, Gunicorn, Nginx, S3 (media)

### Frontend Stack (Locked)

The frontend is **strictly limited** to three technologies. Any deviation requires explicit approval and justification:

| Technology | Purpose |
|-----------|---------|
| **HTMX** | Server-rendered AJAX, partial page updates, form submissions |
| **Alpine.js** | Reactive UI state: modals, menus, snackbars, wizards, toggles, `@click` handlers |
| **Tailwind CSS** | All styling via utility classes |

**Allowed with restrictions:**
- Chart.js — dashboard charts only, initialized via Alpine.js `x-init`
- Lucide — icons only
- Vanilla JS — **only** for: Service Workers, Push API, Web Crypto, HTMX event glue, Chart.js init

**Forbidden:**
- jQuery (isolate and remove; only tolerated for django-autocomplete-light third-party dep)
- Bootstrap, Bulma, Foundation, or any other CSS framework
- React, Vue, Svelte, Angular
- Inline `onclick=`, `onchange=`, `onload=` attributes (use Alpine.js)
- `<script>` blocks in templates for UI state (use Alpine.js `x-data`)
- Inline `<style>` blocks in templates (use Tailwind or `static/css/input.css`)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full frontend rules and contributor checklist.

---

## Como rodar localmente

### Sem Docker

```bash
# 1. Instalar dependências Python
pip install -r requirements/dev.txt

# 2. Copiar e ajustar variáveis de ambiente
cp .env.example .env

# 3. Instalar dependências de frontend
npm install

# 4. Aplicar migrações
python manage.py migrate

# 5. Em um terminal: compilar CSS em modo observação
npm run watch:css

# 6. Em outro terminal: subir o servidor
python manage.py runserver
```

> Para builds de produção ou antes de `collectstatic`, use `npm run build:css`.

### Com Docker

```bash
cp .env.example .env
docker compose --profile dev up --build

# Em outro terminal, aplicar migrações
docker compose --profile dev exec web python manage.py migrate
```

Acesse em `http://localhost:8000`.

### Com Docker + HTTPS (VPS sem proxy externo)

Use o profile `edge` para subir Caddy na frente do Django com certificado TLS automatico:

```bash
cp .env.example .env
# ajuste pelo menos: SITE_DOMAIN, DJANGO_ALLOWED_HOSTS, DJANGO_SECRET_KEY,
# AWS_STORAGE_BUCKET_NAME e POSTGRES_PASSWORD
docker compose --profile prod --profile edge up -d --build
```

Isso publica `80/443` no host, redireciona `www` para o dominio principal e entrega o app em HTTPS.

---

## Acesso inicial

```bash
# Criar superusuário sem prompt de e-mail (recomendado)
python manage.py createadmin

# Alternativa padrão Django
python manage.py createsuperuser
```

Entre em `/accounts/login/` · Admin em `/admin/`.

---

## Dados de demonstração

```bash
python manage.py seed_demo_data
```

Cria, de forma idempotente: usuário demo, moto, especificações, posto, combustível, abastecimento, manutenção, pneu, lembrete e documento manual.

---

## Estrutura do projeto

```text
apps/
  core/        — modelos base, dashboard e utilitários compartilhados
  garage/      — motocicleta e especificações estruturadas
  fuel/        — abastecimentos, postos e combustíveis
  maintenance/ — manutenções, peças e itens recorrentes
  tires/       — pneus e histórico de instalação
  documents/   — documentos e arquivos da moto
  reminders/   — lembretes por gatilho
  reports/     — agregações e indicadores
  expenses/    — taxas anuais (IPVA, DPVAT, licenciamento)
  inventory/   — estoque de peças e itens
  forum/       — artigos públicos e blog
  api/         — endpoints REST internos
  accounts/    — autenticação (django-allauth)
```

---

## Regras de negócio

- Todo dado é associado ao usuário dono (owner-scoped).
- O odômetro é derivado do histórico; override manual é opcional (`odometer_override_km`).
- Abastecimentos exigem quilometragem, litros, valor total e flag `tank_full`.
- Manutenções trabalham com intervalos em km e dias (`interval_km`, `interval_days`).
- Lembretes usam gatilhos explícitos por tipo (data, km, intervalo).
- Catálogos (postos, peças, pneus) são reutilizáveis e reduzem digitação repetida.

---

## Verificação

```bash
npm run build:css
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

---

## Deploy

Guia completo: [docs/deploy.md](docs/deploy.md)

Deploy com Coolify usa apenas `--profile prod` (proxy HTTPS do proprio Coolify).
Para VPS com Docker Compose direto (sem Coolify/Traefik/Nginx externo), use `--profile prod --profile edge`.

---

## Roadmap — funcionalidades planejadas

Itens abaixo estão documentados como planejados. Nenhum está implementado ainda.

### 🔍 OCR de Recibos de Combustível

Aproveitar o campo `receipt_file` já existente no modelo de abastecimento para integrar uma API de OCR (ex: Google Vision API ou AWS Textract). Com uma foto do cupom fiscal, o sistema extrairia automaticamente o posto, a quantidade de litros e o valor total, eliminando a digitação manual.

### 🔗 Dossiê Público / Link Compartilhável

Além da exportação em PDF, gerar uma URL temporária e pública (ex: `mototrack.app/view/abc-123`) para o proprietário compartilhar o histórico completo da moto com um mecânico ou comprador em potencial, sem precisar expor credenciais.

### 🤖 Predição de Manutenção com IA

Usar a média de rodagem mensal do usuário — já calculável a partir do histórico de abastecimentos — para prever a data aproximada da próxima revisão. Em vez de apenas mostrar "próxima troca em X km", o sistema diria: _"Com base no seu uso, sua próxima troca de óleo deve ocorrer em meados de julho."_

### 🛒 Catálogo de Peças Integrado

Vincular itens de manutenção recomendados a buscas em marketplaces (Amazon, Mercado Livre) ou manuais de peças oficiais, facilitando a compra das peças corretas direto do histórico de manutenção.

---

## Acessibilidade

A interface mantém foco visível, landmarks semânticos e labels descritivos. Desenhada para uso confortável por teclado e leitores de tela. Revisão manual periódica ainda recomendada.
