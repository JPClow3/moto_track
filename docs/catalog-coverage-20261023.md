# Catálogo oficial: cobertura conferida em 23/10/2026

A migração `20261023130000_expand_verified_exact_schedules.sql` acrescenta 14
entradas específicas e atualiza seis entradas orientativas existentes. São 20
registros de fonte e 456 itens transcritos. Somente quatro entradas novas geram
agenda automática: NH 190 e NH 300, anos-modelo 2025 e 2026. O catálogo passa de
duas para seis agendas exatas após aplicação, sem alterar planos dos proprietários.
As escolhas genéricas de anos/modelos continuam disponíveis.

A conferência usou PDFs baixados diretamente dos fabricantes ou de CDN
explicitamente retornada pelo seletor oficial KTM. As páginas das tabelas foram
renderizadas e inspecionadas, além da extração de texto. Não foram utilizados
intervalos de blogs, revendedores ou agregadores de manuais. Os PDFs continuam
hospedados pelos fabricantes; seus arquivos não são redistribuídos no repositório.
A data persistida é o literal `2026-10-23`, não a data de execução da migração.

## Dafra: agendas habilitadas e limites

O [portal oficial de pós-venda](https://daframotos.com.br/pos-venda/) distingue
expressamente NH 190/NH 300 modelos 2025/2026 dos documentos para 2027 em diante.
Cada ano recebe sua própria entrada, vinculada ao mesmo modelo existente.

Os manuais NH 190 e NH 300 registram o primeiro serviço em 1.000 km ou seis meses,
o segundo em 3.000 km ou doze meses e, depois, marcos a cada 3.000 km/seis meses.
As condições de tempo contam da nota fiscal original (p. 6, PDF p. 10).
`schedule_milestones` conserva os marcos; `recurrence_km` e `recurrence_months`
conservam os incrementos seguintes. Meses são meses de calendário no motor de
fases; o valor legado em dias não substitui esse cálculo. Histórico desconhecido
não é convertido em revisão feita, e compra de uma moto usada não reinicia a idade.

O ordinal pertence à ocorrência daquele item, não ao número global da revisão na
caderneta. A primeira inspeção de válvulas em 6.000 km/18 meses é a ocorrência 1
desse serviço; a próxima é 12.000 km/30 meses. A primeira troca de filtro de ar
em 12.000 km/30 meses também é ocorrência 1; a próxima é 24.000 km/54 meses.
A seleção de histórico apresenta esses marcos concretos para evitar que o número
global da revisão faça o motor pular ocorrências.

Inspeção e substituição permanecem operações diferentes. O filtro de papel de óleo
aparece somente na NH 300. Inspeções de 6.000 km começam em 6.000 km/18 meses;
trocas de 12.000 km começam em 12.000 km/30 meses. A corrente requer cuidados também
após chuva/lavagem, e inspeções semanais continuam indicadas. O plano não inventa
periodicidade de troca do fluido de freio que não aparece nessas tabelas.

A NHX 190 possui tabela PROMOT 5 conferida, mas seu link no portal não delimita
todos os anos-modelo abrangidos. A edição de janeiro/2025 não serve como prova
de ano-modelo. Sua entrada 2025–2026 existente permanece orientativa.

O PDF Cruisym 150 identifica `80503-T46-301 REV-05/2026` no rodapé final. O link do
portal cobre modelos 2025 em diante, mas há divergência interna: tabela p. 73/PDF
p. 74 indica primeira revisão por seis meses; narrativa p. 75/PDF p. 76 diz um mês.
A linha de escape também tem marcas que não coincidem com a coluna “A Cada”.
Essas divergências estão registradas; não se gera agenda automática para a scooter.

| Modelo / aplicação | Versão oficial                 | Páginas impressas / PDF                                                              | Fonte                                                                                                                           |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| NH 190             | 80503-A41-401 PROMOT 5 rev. 02 | Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10) | [PDF](https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-190-modelo-2025-em-diante--jan-25.pdf) |
| NH 300             | 80503-B42-101 PROMOT 5 rev. 02 | Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10) | [PDF](https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-300-modelo-2025-em-diante--jan-25.pdf) |
| NHX 190            | 80503-G49-001 PROMOT 5 rev. 01 | Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10) | [PDF](https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nhx-190--jan-25.pdf)                      |
| Cruisym 150        | 80503-T46-301 REV-05/2026      | Programa preventivo, p. 73-75 (PDF p. 74-76)                                         | [PDF](https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-cruisym-150-2025-em-diante.pdf)           |

Os PDFs NH 300 têm o título de metadados/capa com “NH190”, apesar do código
80503-B42-101. A apresentação e as especificações internas identificam NH 300.
A transcrição usa a identificação interna e o documento indicado pelo portal da
fabricante para NH 300, sem trocar peças/valores com o manual NH 190.

## KTM: fontes precisas por ano e código brasileiro

O [seletor oficial KTM Brasil](https://www.ktm.com/pt-br/service/manuals.html)
consulta o endpoint público
`/pt-br/service/manuals/_jcr_content/root/responsivegrid_1_col/bikemanuals.manuals.json?modelName=390%20Duke%202023`.
A mesma consulta com `200 Duke` e cada ano retorna os títulos por mercado/idioma.
Somente resultados `BR (pt)` foram usados. Cada PDF foi conferido quanto ao ano na
capa e aos códigos BR na apresentação. A CDN abaixo é fornecida por esse portal.

| Modelo / ano  | Códigos BR no documento   | Páginas impressas / PDF                                                   | PDF oficial                                                                                   |
| ------------- | ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 200 Duke 2017 | F4140Q1, F4140Q2          | Plano de serviço, p. 72-74 (PDF p. 74-76); modelos BR na apresentação     | [17_3213562_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/17_3213562_pt_OM.pdf) |
| 200 Duke 2018 | F4140R1, F4140R2          | Plano de serviço, p. 94-97 (PDF p. 96-99); modelos BR na apresentação     | [18_3213780_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/18_3213780_pt_OM.pdf) |
| 200 Duke 2020 | F4140T2, F4140T3          | Plano de serviço, p. 95-98 (PDF p. 97-100); modelos BR na apresentação    | [20_3214119_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214119_pt_OM.pdf) |
| 200 Duke 2020 | F4140T5, F4140T6, F4140T7 | Plano de serviço, p. 95-98 (PDF p. 97-100); modelos BR na apresentação    | [20_3214120_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214120_pt_OM.pdf) |
| 390 Duke 2018 | F4340R1, F4340R2          | Plano de serviço, p. 112-115 (PDF p. 114-117); modelos BR na apresentação | [18_3213782_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/18_3213782_pt_OM.pdf) |
| 390 Duke 2019 | F4340S1, F4340S2          | Plano de serviço, p. 114-117 (PDF p. 116-119); modelos BR na apresentação | [19_3213939_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/19_3213939_pt_OM.pdf) |
| 390 Duke 2020 | F4340T1, F4340T2          | Plano de serviço, p. 114-117 (PDF p. 116-119); modelos BR na apresentação | [20_3214122_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214122_pt_OM.pdf) |
| 390 Duke 2021 | F4340U1, F4340U2          | Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação     | [21_3214321_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/21_3214321_pt_OM.pdf) |
| 390 Duke 2022 | F4340V1                   | Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação     | [22_3214574_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/22_3214574_pt_OM.pdf) |
| 390 Duke 2023 | F4340W1, F4340W3          | Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação     | [23_3214790_pt_OM](https://azwecdnepstoragewebsiteuploads.azureedge.net/23_3214790_pt_OM.pdf) |

Os dois documentos da 200 Duke 2020 possuem listas distintas de códigos de modelo.
São modelos selecionáveis separados pelos códigos BR, sem supor equivalência de
ABS, geração ou acabamento. Anos sem resultado BR não herdam manual de outro país
nem de ano vizinho. O manual 2023 é uma revisão publicada em 13/03/2024; isso não
transforma sua aplicação em ano-modelo 2024.

As tabelas distinguem revisão única aos 1.000 km de ciclos de 7.500 km/12 meses,
vela e válvulas a 15.000 km, fluido de freio a 24 meses e arrefecimento a 48 meses.
Em 2023 a inspeção de quadro/balança muda de 30.000 km para 15.000 km. As linhas
obrigatórias e recomendadas são identificadas nas observações. Não se converte a
verificação única das válvulas em repetição de 1.000 km.

Essas fontes têm ano/variante comprovados, mas ficam temporariamente
`is_exact_schedule = false`: o motor de fases aprovado para a Dafra usa ordinal
por item, vinculando seus eixos à âncora original. Os eixos KTM de primeira revisão por quilometragem
e revisão anual independente precisam de contrato próprio. Uma revisão anual com
menos de 1.000 km não pode ser ignorada nem causar repetição imediata indevida.
As notas e os itens preservam a transcrição para essa evolução; não se anuncia
uma agenda automática incompleta como concluída. Também é necessário confirmar
na rede autorizada eventuais atualizações locais citadas pelo próprio manual.

## Shineray: tabela conferida, ano-modelo ainda sem comprovação

| Modelo       | Documento oficial                                                                                                                                       | Páginas impressas / PDF                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Jet 50S      | [Manual Jet 50S, publicação 2024](https://www.shineray.com.br/wp-content/uploads/2024/04/MANUAL-DE-PROPRIETARIO-JET50S.pdf)                             | Plano de manutenção, p. 58-60 (PDF p. 58-60); notas sobre uso severo e troca de fluidos na última página do plano |
| SHI 175      | [Manual SHI 175, copyright 2022](https://www.shineray.com.br/wp-content/uploads/2024/03/MANUAL-DE-PROPRIETARIO-SHI-175-2.pdf)                           | Plano de manutenção, p. 58-60 (PDF p. 58-60); notas sobre uso severo e troca de fluidos na última página do plano |
| SHI 175S EFI | [Manual SHI 175S EFI, edição 2025 rev. 003](https://www.shineray.com.br/wp-content/uploads/2024/06/2025-MANUAL-DE-PROPRIETARIO-SHI-175S-EFI-REV003.pdf) | Plano de manutenção, p. 60-62 (PDF p. 60-62); notas sobre uso severo e troca de fluidos na última página do plano |
| Free 150 EFI | [Manual Free 150 EFI, edição 2025 rev. 00](https://www.shineray.com.br/wp-content/uploads/2024/05/2025-MANUAL-DE-PROPRIETARIO-FREE-150-EFI-REV00.pdf)   | Plano de manutenção, p. 60-62 (PDF p. 60-62); notas sobre uso severo e troca de fluidos na última página do plano |

O [registro oficial SHI 175S EFI](https://www.shineray.com.br/manuais-produto/shi-175s-efi/)
foi publicado em 28/06/2024, e o PDF informa edição/copyright 2025. O
[registro Free 150 EFI](https://www.shineray.com.br/manuais-produto/free-150-efi/)
foi publicado em 17/05/2024, com edição 2025. Nenhuma dessas datas estabelece todos
os anos-modelo aplicáveis. Os intervalos dos dois PDFs anteriores também não podem
ser extrapolados a anos de fabricação apenas pelo copyright.

As quatro entradas existentes preservam seus anos selecionáveis, com aviso
orientativo. O plano transcrito separa inspeções e trocas. A folga de válvulas da
SHI 175S EFI está em 3.000 km na coluna de repetição; os outros três documentos
mostram 1.000 km. Óleo está em 1.000 km, corrente em 500 km ou semanalmente e troca
de filtro de ar em 6.000 km. A linha de eixos/rodas tem marcas que não coincidem com
a coluna de repetição e foi omitida, sem escolher arbitrariamente uma interpretação.
Condições severas exigem intervalos definidos pela autorizada; não se aplica um
fator de redução inventado.

## Conferência e próximos requisitos

- A migração é reexecutável por `on conflict`, mantém `model_id`, vínculos de fontes
  e documentos e não modifica `maintenance_plan_items` de proprietários.
- As quatro agendas automáticas só devem ser habilitadas junto da migração e do
  motor de fases. Uma fase concluída exige indicação explícita no histórico;
  quilometragem isolada não comprova revisão.
- O rodapé Dafra p. 52/PDF p. 56 diz: “Considerar a data de aquisição da
  motocicleta ou de substituição do item.” Por isso a correção
  `20261023140000_maintenance_replacement_calendar.sql` distingue
  `calendar_anchor_mode = 'last_service'` no conjunto de arrefecimento de três
  anos. O primeiro vencimento usa a entrada original em serviço; após troca
  confirmada, a idade do item reinicia na data real. As revisões por fase
  continuam usando a nota fiscal original. A frase não estabelece reinício
  do hodômetro.
- A migração `20261023180000_maintenance_relative_replacement.sql` permite
  calcular a troca temporal simples a partir da última data confirmada mesmo
  quando a quantidade de trocas anteriores é desconhecida. Essa exceção exige
  somente um marco temporal, repetição por meses, ausência de eixo de km e
  âncora `last_service`; o ordinal desconhecido continua nulo. Não se aplica a
  programas temporais irregulares nem a marcos combinados de km/meses.
- Os campos em dias nas transcrições orientativas são valores de referência
  existentes na estrutura antiga. Não são usados para promover esses documentos
  a uma agenda exata por meses/anos.
- Permanecem requisitos: confirmar anos Shineray/NHX junto à fonte primária,
  esclarecer Cruisym com a Dafra, representar os eixos independentes KTM e expandir
  as famílias Honda/Yamaha ainda orientativas. Esta entrega não prova cobertura de
  todos os modelos brasileiros.
- Verificação de banco deve ser feita em ambiente descartável, aplicando a cadeia
  completa e reexecutando esta migração. A existência do SQL não prova publicação,
  migração de produção, clique autenticado ou aceitação em dispositivo físico.

## Impressões digitais dos arquivos inspecionados

Links oficiais são mutáveis. Estes SHA-256 identificam os bytes efetivamente
inspecionados em 23/10/2026, sem espelhar arquivos protegidos no aplicativo.

| Arquivo           | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| cruisym.pdf       | `6709d4a1b95b7c14720a3d6762b21c52f6920ce5ca1b4746696adee15bb018cf` |
| free150efi.pdf    | `4bcdf14a63e44beeb8915c44e61c4c64ef65da9113d5bb41598537b9593e2b38` |
| jet50s.pdf        | `dfeb4590adececf536dd5ed1f5fc5d5bcadee7ca88bc7f0e3ac6d5e34d15084b` |
| ktm200-2017-0.pdf | `56cf84b88fb39c6a911c7272e06d0920b94802de048707542f0767545144fcb6` |
| ktm200-2018-0.pdf | `7a3b71c8424558bb7010a5e574b5c6ac6a4e842e4c4e6f6bc8657d24959fe845` |
| ktm200-2020-0.pdf | `316c63e4b0ca077c6bf414156b5a17553750869fd35d7e16fcb4cd4a82858974` |
| ktm200-2020-1.pdf | `028124596fa7ae455951f0aed0172a807a65895487b72ee77cb4517a4c097a8d` |
| ktm390-2018-0.pdf | `701639249588ce02161a592cab6ff91bff9b03e016713650bca7b619c0733098` |
| ktm390-2019-0.pdf | `c5ab1c80689a91388be6227afc58e473d0486a6f2133615e353b6c8d551dd79a` |
| ktm390-2020-0.pdf | `5e59d48c2abf63cf0b280fe389947e86411e991fe7346519ffd650222120307b` |
| ktm390-2021-0.pdf | `a2881ffbdd8f31fbfe307a9484ca1604be69016533b0bba3833e956f966449a1` |
| ktm390-2022-0.pdf | `c3eaa48cca2c2f6cbcb790589a2e9af8cb62336bc0190580383feb379ed44607` |
| ktm390-2023-0.pdf | `e3de8abc0997390f6aa900b7a7fcb3643fc8eac959f18036494b805c60385bd5` |
| nh190.pdf         | `b08750109f83e4ef67db5b05a7419ce86dbe906566e58cd58ed7f7bc707b6dfc` |
| nh300.pdf         | `99915dce24427f8bc8f5e17c3ab653728991e6ed0332e1a8044892046c96fe03` |
| nhx190.pdf        | `864b88c4e9aa4156dca3c1f4f1e09b89eadfca73d58f99b38f2529dad7464a5c` |
| shi175.pdf        | `00940f6756bde19c8745f607ee05b3e2f4627f2453aa83f3a8f2257a44402c4f` |
| shi175sefi.pdf    | `ae2476b8d683067f2bf3fe67c41eaf452d3e6707df78f75b27c678fac4e7d51f` |
