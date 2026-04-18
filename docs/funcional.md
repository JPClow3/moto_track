# Documentação Funcional - Moto Track

## Visão Geral
Moto Track é uma plataforma pessoal para gestão de motocicleta criada para concentrar uso, custos, manutenção e documentação em um único lugar.

A proposta do sistema é ser um painel de controle prático para uso diário, com baixa fricção de registro e consulta rápida em celular e desktop.

## Objetivo do Produto
O app existe para ajudar o usuário a:

- registrar abastecimentos
- acompanhar consumo e gastos
- controlar manutenções preventivas e corretivas
- monitorar pneus, óleo e filtros
- guardar documentos e manual da moto
- receber lembretes por data ou quilometragem

## Estrutura Funcional

### 1. Painel Principal
A tela inicial resume a situação atual da moto com foco no que precisa de atenção agora.

Elementos principais:

- quilometragem atual
- últimos abastecimentos
- últimas manutenções
- próximos lembretes
- gasto mensal com combustível
- alertas importantes

### 2. Abastecimentos
O módulo de abastecimentos registra cada parada no posto com dados como:

- data
- quilometragem
- litros abastecidos
- valor total
- preço por litro
- tipo de combustível
- tanque cheio ou parcial
- posto e observações

A partir desses registros, o sistema sustenta a leitura de consumo e histórico de gastos.

### 3. Manutenções
O módulo de manutenção guarda serviços realizados, como:

- troca de óleo
- filtros
- pneus
- pastilhas
- revisão
- mão de obra
- serviços diversos

Cada manutenção pode incluir:

- data
- quilometragem
- custo
- oficina
- descrição
- peças usadas
- intervalo previsto em km e/ou dias

### 4. Pneus
O controle de pneus permite acompanhar o ciclo de vida de cada item de desgaste.

O sistema trabalha com duas camadas:

- catálogo de produtos de pneu
- registro de instalação e uso na moto

Campos úteis incluem:

- fabricante
- modelo
- tipo de pneu
- medida
- índice de carga
- índice de velocidade
- velocidade máxima
- preço
- desgaste e quilometragem de instalação

### 5. Óleo e Filtros
O app separa itens de consumo recorrente para facilitar consultas e reaproveitamento em novos registros.

Isso inclui:

- óleo
- filtros
- peças de manutenção
- insumos de revisão

Esses itens podem ser usados como catálogo para acelerar lançamentos de manutenção.

### 6. Documentos e Manual
O sistema armazena arquivos e metadados de documentos importantes da moto.

Exemplos:

- manual
- CRLV
- seguro
- notas fiscais
- comprovantes
- arquivos de referência

### 7. Lembretes
O módulo de lembretes apoia manutenção preventiva e vencimentos.

Os gatilhos podem ser por:

- quilometragem
- data
- intervalo

O lembrete pode enviar alertas internos e email.

## Catálogos Estruturados
O sistema usa catálogos para reduzir digitação repetida e tornar os registros mais rápidos.

Catálogos principais:

- postos e combustíveis cadastrados
- peças e insumos de manutenção
- pneus estruturados

Esses catálogos aparecem nas telas como referências reutilizáveis e ficam ligados aos registros históricos.

## Seed e Dados Demo
Existe um comando de seed para popular o sistema com dados de demonstração.

Comando:

- `python manage.py seed_demo_data`

Ele cria, de forma idempotente:

- usuário demo
- moto demo
- especificações da moto
- posto e combustível cadastrado
- abastecimento exemplo
- item de manutenção e manutenção exemplo
- pneu e instalação exemplo
- lembrete exemplo
- documento manual exemplo

## Fluxo de Uso Recomendado
1. Criar ou entrar com um usuário.
2. Cadastrar a moto principal.
3. Registrar abastecimentos.
4. Registrar manutenções e itens de desgaste.
5. Alimentar catálogos de pneus, postos e peças.
6. Subir documentos importantes.
7. Revisar os lembretes no painel.

## Regras de Negócio Principais
- Os dados são sempre associados ao usuário dono.
- O odômetro é derivado do histórico com possibilidade de override manual.
- O abastecimento deve respeitar valores positivos e quilometragem coerente.
- A manutenção aceita intervalos em km e dias.
- Lembretes têm gatilhos explícitos por tipo.

## Interface e Experiência
A interface foi pensada para ser:

- moderna
- responsiva
- direta
- funcional
- limpa visualmente
- rápida no uso diário

O uso de HTMX reduz recarregamentos completos e favorece fluxos de registro rápido.

## Acessibilidade
A interface mantém foco visível, landmarks semânticos e labels descritivos. O sistema foi desenhado para uso confortável por teclado e leitores de tela, embora a validação manual continue recomendada.

## Próximos Passos Sugeridos
- ampliar testes automatizados de fluxos críticos
- adicionar relatórios agregados
- criar telas completas para documentos e lembretes
- evoluir os catálogos com formulários dedicados de cadastro
