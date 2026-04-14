# Moto Track

Moto Track é uma plataforma pessoal de gestão de motocicleta criada para centralizar uso, custos, manutenção e documentação em um único lugar.

A ideia é transformar o controle da moto em algo simples, confiável e útil no dia a dia, sem exigir planilhas soltas, anotações dispersas ou ferramentas complexas.

## O que o sistema cobre

- registro de abastecimentos
- acompanhamento de consumo e gastos
- controle de manutenções preventivas e corretivas
- monitoramento de pneus, óleo e filtros
- armazenamento de documentos e manual da moto
- lembretes por data ou quilometragem
- painel com visão rápida do estado atual da moto

## Módulos

- Painel principal: resumo da situação atual, últimos eventos e alertas
- Abastecimentos: histórico, custos e dados de consumo
- Manutenções: serviços realizados, peças usadas e intervalos
- Pneus: catálogo estruturado e histórico de instalação/uso
- Documentos: arquivos, metadados e acesso rápido
- Lembretes: alertas por data, km ou intervalo
- Relatórios: evolução de custos e uso ao longo do tempo

## Stack

- Django com templates server-rendered
- django-crispy-forms com crispy-tailwind para padronização de formulários
- django-allauth e django-allauth-ui para autenticação
- django-environ para configuração por ambiente
- django-bleach para sanitização de texto
- django-autocomplete-light para campos de busca assistida
- django-money para valores monetários com moeda explícita
- django-cotton para componentes de template
- HTMX para interações rápidas
- Alpine.js para interações leves
- PostgreSQL em produção
- Tailwind CSS na camada de estilo
- Docker para execução local e empacotamento

## Como rodar localmente

### Sem Docker

- Criar e ativar a virtualenv.
- Instalar dependências Python:

```bash
pip install -r requirements/dev.txt
```

- Copiar `.env.example` para `.env` e ajustar quando necessário.
- Instalar dependências de frontend:

```bash
npm install
```

- Aplicar migrações:

```bash
python manage.py migrate
```

- Em um terminal, compilar CSS em modo observação:

```bash
npm run watch:css
```

- Em outro terminal, subir o servidor:

```bash
python manage.py runserver
```

### Com Docker

- Copiar `.env.example` para `.env`.
- Subir o ambiente:

```bash
docker compose up --build
```

- Em outro terminal, aplicar migrações:

```bash
docker compose exec web python manage.py migrate
```

- Abrir o sistema em `http://localhost:8000`.

## Acesso inicial

- Criar superusuário:

```bash
python manage.py createsuperuser
```

- Entrar em `/accounts/login/`.
- Acessar `/admin/` para gerenciamento interno.

## Dados de demonstração

Existe um comando de seed para popular o banco com um conjunto inicial de dados demo.

```bash
python manage.py seed_demo_data
```

Esse comando cria, de forma idempotente:

- usuário demo
- moto demo
- especificações da moto
- posto e grade de combustível
- abastecimento exemplo
- peça de manutenção e manutenção exemplo
- pneu e instalação exemplo
- lembrete exemplo
- documento de manual exemplo

## Estrutura funcional dos dados

O projeto é organizado em apps por domínio:

- `apps/core`: modelos base, dashboard e utilidades compartilhadas
- `apps/garage`: motocicleta e especificações estruturadas
- `apps/fuel`: abastecimentos, postos e grades de combustível
- `apps/maintenance`: manutenções, peças e itens recorrentes
- `apps/tires`: pneus estruturados e histórico de instalação
- `apps/documents`: documentos e arquivos da moto
- `apps/reminders`: lembretes por gatilho
- `apps/reports`: agregações e indicadores

## Regras de negócio importantes

- Todo dado do usuário é associado ao dono.
- O odômetro é derivado do histórico, com override manual opcional.
- Abastecimentos usam quilometragem, litros, valor total e preço por litro.
- Manutenções trabalham com intervalos em km e dias.
- Lembretes usam gatilhos explícitos por tipo.
- Catálogos estruturados reduzem digitação repetida e aceleram o uso.

## Experiência de uso

O app foi desenhado para ser:

- moderno
- responsivo
- direto
- funcional
- limpo visualmente
- rápido no celular e no desktop

Quick actions e HTMX reduzem o atrito para registrar eventos em poucos segundos.

## Documentação funcional

Leia a visão funcional detalhada em [docs/funcional.md](docs/funcional.md).

## Verificação

Comandos úteis para validação local:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test apps.fuel apps.maintenance apps.tires
```

## Observação

A interface foi construída com acessibilidade em mente, mas ainda vale revisão manual com teclado, leitor de tela e ferramentas como Accessibility Insights.
