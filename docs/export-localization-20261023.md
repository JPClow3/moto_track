# Idioma dos relatórios e arquivos exportados

Inventário das saídas reais em 23/10/2026:

| Saída                                   | Implementação                                  | Escolha de idioma                                                                     |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Relatório de venda HTML / impressão PDF | Svelte autenticado e público em `reports/sale` | Locale da página; não existe renderizador PDF separado no servidor                    |
| Linha do tempo                          | `reports/+page.server.ts`                      | Fallback de abastecimento usa `locals.locale`; descrições cadastradas são preservadas |
| Distribuição de custos calculada        | `report-summary.ts`                            | Parâmetro `locale` explícito; padrão pt-BR para chamadas anteriores                   |
| CSV dos módulos                         | `[feature]/export.csv/+server.ts`              | Erros e `Content-Language` acompanham o locale da sessão                              |
| JSON de dados da conta                  | `billing/conta/export/+server.ts`              | Erros, nome do arquivo e `Content-Language` acompanham o locale da sessão             |
| Download ICS autenticado                | `reminders/calendar.ics/+server.ts`            | Locale do proprietário na solicitação                                                 |
| Assinatura ICS por token                | `calendar/[token]/+server.ts`                  | Locale gravado pelo proprietário quando criou o feed                                  |

CSV e JSON mantêm nomes de tabelas, colunas, chaves, valores, moedas e datas
originais. Isso permite reutilizar os arquivos sem que a mudança do idioma altere
o contrato de importação ou o conteúdo de um registro. O CSV usa os mesmos
identificadores de coluna em ambos os idiomas; `Content-Language` descreve a
apresentação da resposta, sem prometer tradução dos dados cadastrados.

`src/lib/i18n/exports.ts` reúne os textos de apresentação destas saídas.
Calendários traduzem somente as instruções do Moto Track. Títulos dos lembretes,
nomes das motos e textos de manuais permanecem como foram registrados. Datas,
regras de adiamento e identificadores dos eventos também são preservados.

A migração `20261023170000_calendar_feed_locale.sql` adiciona o idioma ao feed.
Feeds já existentes continuam em português; novos feeds capturam `locals.locale`
durante a criação autenticada. Para publicar uma assinatura em outro idioma, o
proprietário cria um novo feed nesse idioma e pode revogar o anterior. O crawler
do serviço de calendário nunca determina o idioma do feed por `Accept-Language`.

`tests/unit/exports-i18n.test.ts` cobre paridade dos textos, conteúdo original dos
eventos, instruções por quilometragem, idioma persistido do feed, contrato CSV e
valores dos cálculos. A execução fica para a validação serial central; a presença
dos testes não estabelece resultado de execução nem teste em um calendário externo.
