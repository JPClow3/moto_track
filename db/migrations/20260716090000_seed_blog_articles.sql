-- Seeds the blog with the maintenance guides that shipped on the previous
-- (Django) stack, plus new ones written for this seed.
--
-- Bodies are Markdown (GFM): headings, tables, task lists and a closing
-- callout. They are rendered by src/lib/components/Markdown.svelte, which walks
-- the token tree rather than injecting HTML.
--
-- Notes for anyone editing this file:
--   * Bodies are dollar-quoted ($md$) — Portuguese copy is full of apostrophes
--     and doubling them all up would be unreadable and easy to get wrong.
--   * `on conflict (slug) do nothing` keeps this re-runnable and stops it from
--     clobbering edits made later through the admin editor.
--   * published_at is fixed rather than now(), so the ordering of the blog list
--     (and therefore which guide is the lead) is identical in every environment.

insert into public.forum_articles (title, slug, summary, meta_description, body, is_published, published_at)
values
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Checklist de segurança para viajar de moto no Brasil',
  'checklist-seguranca-viajar-moto-brasil',
  'Checklist completo com os itens essenciais para viajar de moto no Brasil: documentos, mecânica, equipamento, kit de emergência e o que muda em cada região.',
  'Checklist essencial de segurança para viagens de moto no Brasil. Documentos, equipamentos, revisão mecânica e considerações regionais.',
  $md$## Por que um checklist pode salvar a sua viagem

O Brasil tem mais de 1,7 milhão de km de rodovias atravessando biomas completamente diferentes. Uma moto que roda bem em São Paulo pode dar problema no cerrado ou na serra gaúcha. Este checklist cobre documentos, mecânica, equipamento e o que muda em cada região.

## 1. Documentos e burocracia

- [ ] CRLV (licenciamento atualizado) — impresso ou digital pelo app do Detran
- [ ] CNH dentro da validade, categoria A
- [ ] Seguro com cobertura para roubo e acidente em outro estado
- [ ] Telefone da corretora e número da apólice salvos no celular

## 2. Mecânica (verifique uma semana antes, não na véspera)

- [ ] Óleo do motor no nível e dentro do prazo de troca
- [ ] Pneus com sulco mínimo de 2 mm e pressão calibrada já com o peso da viagem
- [ ] Pastilhas de freio com mais de 3 mm de material
- [ ] Corrente lubrificada e com a folga correta
- [ ] Fluido de freio no nível e ainda claro — se está marrom, troque
- [ ] Farol alto, baixo, lanterna, freio e setas funcionando

Uma semana de antecedência é proposital: se algo estiver gasto, ainda dá tempo de encomendar a peça.

## 3. Equipamento

- [ ] Capacete com selo do Inmetro, viseira limpa e trava funcionando
- [ ] Jaqueta com proteção de ombros, cotovelos e costas
- [ ] Luvas com proteção nos nós dos dedos
- [ ] Calça de couro ou cordura com proteção de joelhos — bermuda não é opção
- [ ] Bota que cubra o tornozelo

## 4. Kit de emergência

- [ ] Kit de reparo de pneu (macarrão, alicate e mini compressor ou CO2)
- [ ] Chaves Allen, Phillips e fenda no tamanho da sua moto
- [ ] Fusíveis reserva
- [ ] Lanterna de cabeça
- [ ] Fita isolante e abraçadeiras de nylon

Abraçadeira e fita isolante já salvaram mais viagem do que qualquer ferramenta cara.

## 5. O que muda em cada região

| Região | O que esperar | O que levar |
|--------|---------------|-------------|
| Norte | Chuva intensa entre outubro e maio | Capa impermeável, lubrificante de corrente extra |
| Nordeste | Sertão acima de 40 °C | Óleo mais viscoso, muita água, protetor solar |
| Centro-Oeste | Postos muito espaçados | Galão reserva de 5 litros |
| Sul | Inverno perto de 0 °C | Luvas térmicas, jaqueta com forro |
| Sudeste | Serra com neblina e curva fechada | Viseira anti-embaçante, cautela com folha molhada |

## 6. Na estrada

- Pare a cada 150–200 km para hidratar e esticar as pernas.
- Mantenha 2 segundos de distância do veículo da frente.
- Use farol alto de dia em pista simples: carro te enxerga tarde.
- Baixe o mapa offline da região — sinal de celular acaba antes da estrada.

## Dica final: encurte o primeiro dia

Se você não está acostumado a rodar mais de 300 km por dia, faça 200 km no primeiro. O cansaço acumula em silêncio, e a fadiga responde por boa parte dos acidentes em viagens longas.

> **No Moto Track:** registre a revisão pré-viagem e cada abastecimento da estrada. Na volta você sabe quanto a viagem custou por km — e onde a gasolina estava mais cara.$md$,
  true,
  '2026-02-10 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Pressão dos pneus: a importância da calibragem correta',
  'pressao-dos-pneus-calibragem-correta',
  'Pneu murcho aumenta o consumo, desgasta irregularmente e tira estabilidade em curva. Entenda a pressão certa, quando calibrar e o que muda com garupa.',
  'Por que calibrar o pneu da moto corretamente: efeito no consumo, na segurança e na durabilidade. Como descobrir a pressão ideal do seu modelo.',
  $md$## O item mais barato de manter e o mais esquecido

Calibrar o pneu é grátis e leva dois minutos. Ainda assim é o item que mais encontramos errado. Pneu abaixo da pressão aumenta o consumo, desgasta as bordas, esquenta demais e tira estabilidade justamente na curva.

## Como descobrir a pressão certa da sua moto

A pressão ideal muda por modelo e por carga. Ela **não** está escrita no pneu — o número no flanco é a pressão máxima que a carcaça suporta, não a recomendada. Procure:

- No manual do proprietário.
- Em um adesivo na balança traseira, no protetor de corrente ou embaixo do banco.

## Valores típicos de referência

| Tipo de moto | Dianteiro | Traseiro |
|--------------|-----------|----------|
| 125–160 cc (CG, Biz, Factor) | 26–29 psi | 29–33 psi |
| 250–300 cc (Twister, Fazer 250) | 29 psi | 33 psi |
| 500 cc+ (CB 500X, MT-07) | 29–33 psi | 33–36 psi |

Use como ponto de partida e confirme no manual — este é o valor da sua moto, não o da tabela.

## As três regras da calibragem

1. **Calibre a frio.** Antes de rodar, ou depois de menos de 2 km. Pneu quente marca até 4 psi a mais e engana a leitura.
2. **Verifique toda semana.** Um pneu perde 1 a 2 psi por mês sozinho, sem nenhum furo.
3. **Com garupa ou carga, suba a traseira.** Normalmente 2 a 4 psi a mais, conforme o manual.

## Como o erro aparece no pneu

- **Pressão baixa:** desgaste nas duas bordas, centro preservado. A moto fica "pesada" para entrar na curva.
- **Pressão alta:** desgaste só no centro. Menos aderência e a moto fica nervosa no piso ruim.
- **Desgaste em degraus:** normalmente não é pressão, é suspensão ou alinhamento.

## Não confie no calibrador do posto

Calibradores de posto vivem descalibrados por uso e por queda. Um manômetro de bolso custa pouco e é o único jeito de saber se o do posto está mentindo. Compare os dois: se divergirem muito, troque de posto.

> **No Moto Track:** anote a pressão a cada calibragem. Se um pneu sempre perde mais que o outro, você tem um furo lento ou uma válvula ressecada — e o histórico mostra isso antes do prego aparecer.$md$,
  true,
  '2026-02-24 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Como ajustar a suspensão traseira para diferentes cargas',
  'como-ajustar-suspensao-traseira-cargas-diferentes',
  'Guia prático para regular a pré-carga da suspensão traseira conforme a carga. Monoshock, twin-shock, como medir o sag e tabela de ajuste por cenário.',
  'Guia prático para ajustar a pré-carga da suspensão traseira conforme a carga. Monoshock, twin-shock, sag de corrida e recomendações por cenário.',
  $md$## Dois minutos que mudam a moto inteira

A suspensão traseira controla tração, estabilidade em curva e conforto. Com a pré-carga errada, a moto patina na aceleração, tomba em curva lenta ou bate no fundo na lombada. O ajuste leva dois minutos e muda completamente o comportamento — e quase ninguém mexe nele.

## Os três ajustes (e o que cada um faz)

- **Pré-carga (preload):** tensiona a mola para suportar pesos diferentes. Afeta a altura da moto e o curso disponível. É o único ajuste que **toda** moto tem.
- **Compressão:** controla a velocidade com que a suspensão comprime. Mais firme = menos mergulho, mais duro no buraco.
- **Retorno (rebound):** controla a velocidade com que ela volta. Rápido demais e a moto "chuta"; lento demais e ela afunda progressivamente.

Se a sua moto só tem um ajuste, é a pré-carga. Comece por ela.

## Sag: a medida que diz se está certo

O sag é o quanto a suspensão afunda com o peso. É o número que importa — não o "clique" em que a mola está.

| Tipo de moto | Sag de pilotagem | Sag livre |
|--------------|------------------|-----------|
| Naked / street (CB 300F, MT-03) | 25–30 mm | 5–10 mm |
| Trail / adventure (CB 500X, Versys) | 35–40 mm | 10–15 mm |
| Esportiva (CBR 600RR, R6) | 30–35 mm | 5–10 mm |
| Custom / cruiser (Shadow, Boulevard) | 30–35 mm | 10–15 mm |

## Como medir o sag

1. **Livre:** levante a roda traseira no cavalete. Meça do eixo traseiro até um ponto fixo do chassi (o parafuso do banco serve).
2. **De pilotagem:** desça a moto, suba nela com o equipamento que você usa, pés nas pedaleiras, sem se apoiar. Peça para alguém medir do mesmo ponto.
3. **Calcule:** sag = medida livre − medida com piloto.

Fora da faixa da tabela? Ajuste a pré-carga e meça de novo.

## Ajuste por cenário

| Cenário | Pré-carga | Por quê |
|---------|-----------|---------|
| Sozinho, sem bagagem | Mais macia (0–1) | Conforto e curso máximo |
| Sozinho, com mochila ou malas | Meio (2–3) | Compensa o peso extra |
| Com garupa | Meio-alto (3–4) | Sustenta o peso na traseira |
| Garupa + bagagem | Máxima | Evita bater no fundo na lombada |
| Estrada de terra | Um passo acima do urbano | Evita bottoming no buraco |

## Se a pré-carga não resolve

Pré-carga não substitui mola. Se você precisa do ajuste máximo e a moto **ainda** afunda demais, a mola é fraca para o seu peso — o caminho é uma mola mais dura, não mais pré-carga. Apertar a mola até o fim só reduz o curso e piora o conforto.

## Quando o amortecedor precisa de revisão

O monoshock usa óleo hidráulico que se degrada. Sinais:

- A moto pula na lombada em vez de absorver.
- O retorno parece instantâneo.
- Há óleo vazando pelo retentor.

A revisão custa entre R$ 250 e R$ 600 conforme a moto. Vale a cada 20.000–30.000 km em uso intenso.

> **No Moto Track:** registre o ajuste como observação da moto e compare consumo e desgaste do pneu antes e depois. Pré-carga errada aparece primeiro no pneu traseiro.$md$,
  true,
  '2026-03-05 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Manutenção da Honda CB 300R: problemas comuns e soluções',
  'manutencao-honda-cb-300r-problemas-comuns',
  'Como cuidar da CB 300R e prevenir o problema mais conhecido do modelo: a trinca no cabeçote. Óleo, velas, ajuste de válvulas e kit relação.',
  'Guia de manutenção da Honda CB 300R. Como prevenir a trinca no cabeçote, cuidados com óleo, velas de irídio e ajuste de válvulas.',
  $md$## Uma moto robusta com um ponto de atenção

A Honda CB 300R é durável e simples de manter, mas tem uma fama que assusta comprador: a trinca no cabeçote. Ela é real, é evitável, e quase sempre é consequência de manutenção adiada — não de defeito de fábrica inevitável.

## O problema do cabeçote, explicado

A trinca aparece quando o cabeçote trabalha mais quente do que deveria, por tempo suficiente. O que leva a isso:

- **Válvula desregulada.** Folga fora da especificação faz a válvula não assentar direito, não trocar calor com a sede e cozinhar a região.
- **Óleo velho ou de nível baixo.** No motor refrigerado a ar, o óleo é metade do sistema de arrefecimento.
- **Marcha alta em rotação baixa.** Forçar a moto em 5ª a 40 km/h aquece sem ventilação.

Nenhum desses é caro de evitar. Todos são caros de consertar.

## Ajuste de válvulas: o item que não pode atrasar

É o serviço mais importante desta moto e o mais adiado — porque a moto não reclama antes de quebrar.

- Verifique a cada **10.000 km** (ou conforme o manual do seu ano).
- Faça com o motor **frio**, nunca morno.
- Barulho de máquina de costura no cabeçote a frio é sinal de folga grande. Silêncio total pode ser folga zero, que é pior.

## Óleo

- Use 10W-30 ou 20W-50 conforme o ano e o manual.
- Troque a cada **5.000 km** com semissintético; a cada 3.000 km se roda muito parado no trânsito.
- Confira o nível **toda semana**. Motor a ar consome um pouco de óleo, e isso é normal — descobrir o consumo tarde não é.

## Velas

Muito dono migra para vela de irídio, e faz sentido: queima mais completa e menos calor no cabeçote. Não é obrigatório — vela comum trocada no prazo funciona. O que não pode é vela vencida em motor que já aquece.

## Kit relação

- Lubrifique a cada 500 km.
- Ajuste a folga a cada 500–1.000 km.
- Pneus: 110/70-17 na frente, 140/70-17 atrás. Calibragem 29 psi / 33 psi.

## Resumo dos intervalos

| Item | Intervalo |
|------|-----------|
| Nível de óleo | Semanal |
| Lubrificação da corrente | 500 km |
| Troca de óleo | 5.000 km |
| Ajuste de válvulas | 10.000 km |
| Filtro de ar | 12.000 km (ou antes, em terra) |

> **No Moto Track:** cadastre o ajuste de válvulas como lembrete por quilometragem. É o serviço que ninguém lembra e o único que decide a vida do cabeçote.$md$,
  true,
  '2026-03-18 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Honda CB 300F Twister 2023/2024: as primeiras manutenções',
  'honda-cb-300f-twister-primeiras-manutencoes',
  'Pegou a Twister nova? Veja o que fazer na revisão dos 1.000 km, quais óleos usar, o que a garantia exige e como não perder prazo.',
  'Primeiras manutenções da Honda CB 300F Twister 2023/2024. Revisão de 1.000 km, especificações de óleo, garantia e amaciamento.',
  $md$## A revisão que decide a vida do motor

A Twister 2023/2024 chegou com embreagem assistida e deslizante e um motor bem mais refinado que o da geração anterior. Nada disso sobrevive a um amaciamento malfeito. A revisão dos 1.000 km é a mais importante que essa moto vai receber.

## Por que os 1.000 km importam tanto

Durante o amaciamento, os anéis assentam contra a parede do cilindro e as engrenagens acomodam. Esse processo solta limalha metálica fina — normal e esperado. O óleo dos primeiros 1.000 km termina cheio dela. Ele **precisa** sair, junto com o filtro.

Rodar 5.000 km com o óleo de amaciamento é circular limalha pelo motor inteiro.

## O que é feito na revisão de 1.000 km

- Primeira troca de óleo e filtro.
- Reaperto geral (a vibração afrouxa parafusos no início).
- Verificação de folgas, corrente e freios.
- Registro no plano de manutenção — é isso que mantém a garantia.

Não perca o prazo. A Honda trabalha com janela de km **e** de tempo: vale o que vencer primeiro.

## Especificações rápidas

| Item | Especificação |
|------|---------------|
| Óleo | Honda 10W-30 semissintético |
| Capacidade (com filtro) | ~1,5 litro |
| Combustível | Flex (gasolina ou etanol) |
| Filtro de óleo | Trocado em todas as revisões do plano |
| Revisões seguintes | A cada 6.000 km ou 12 meses |

## Como amaciar sem estragar

O mito diz "ande devagar". Errado. Amaciamento é sobre **variar**, não sobre poupar:

- Não fique na mesma rotação por muito tempo — varie a faixa constantemente.
- Evite rotação máxima até os 1.000 km, mas não tenha medo de girar o motor.
- Evite carga alta em rotação baixa (subida em marcha alta).
- Evite estrada longa em velocidade constante nos primeiros 500 km.

## Gasolina comum ou aditivada?

A Twister é flex e roda bem com as duas. A aditivada ajuda a manter os bicos limpos em uso urbano curto. O que realmente importa é **posto de confiança**: gasolina adulterada faz mais estrago que qualquer escolha entre comum e aditivada.

> **No Moto Track:** cadastre a moto com a data da compra e crie o lembrete dos 1.000 km por quilometragem. A garantia depende de prazo — e prazo é exatamente o que se esquece na euforia da moto nova.$md$,
  true,
  '2026-03-30 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Quando trocar as pastilhas de freio da Honda CB 300F Twister',
  'quando-trocar-pastilhas-freio-honda-cb-300f-twister',
  'Como identificar o momento certo de trocar as pastilhas da Twister: medição da lona, tipos de material, códigos das peças, procedimento e assentamento.',
  'Guia para saber quando trocar as pastilhas de freio da Honda CB 300F Twister. Sintomas, tipos de material, códigos das peças e procedimento.',
  $md$## A regra de ouro: troque antes de ouvir

A pastilha tem uma camada de atrito sobre uma base metálica. Quando essa camada acaba, o metal raspa o disco — o barulho que você ouve é o disco sendo destruído. Uma pastilha custa R$ 40 a R$ 130. Um disco custa até R$ 450. Trocar no prazo é a decisão mais barata da moto.

## Como medir sem desmontar

1. **Olhe pela fresta da pinça** com uma lanterna. A pastilha é visível sem tirar nada.
2. **Meça a camada de atrito.** Abaixo de **2 mm**, programe a troca. Abaixo de **1 mm**, troque agora.
3. **Procure a ranhura indicadora.** Se ela sumiu, a pastilha chegou ao limite.
4. **Sinta a manete.** Curso longo demais pode ser desgaste — ou ar no sistema, que é outro problema.

## Quanto duram na prática

- **Dianteira:** 15.000–25.000 km. Em uso urbano agressivo, 12.000 km.
- **Traseira:** 25.000–35.000 km.

A dianteira faz cerca de 70% da frenagem — é normal que acabe primeiro. Se a traseira estiver acabando antes, você está pisando no freio traseiro demais.

## Qual material escolher

| Tipo | Característica | Melhor para | Preço (par) |
|------|----------------|-------------|-------------|
| Orgânica (resina) | Aquece pouco, poupa o disco | Uso urbano | R$ 40–70 |
| Sinterizada (metal) | Resiste ao calor, morde forte | Estrada, descida longa | R$ 80–130 |
| Cerâmica | Silenciosa, pouco pó, dura mais | Uso misto | R$ 90–150 |

Para a Twister na cidade, orgânica ou cerâmica resolve. Sinterizada só compensa se você roda serra ou pista.

## Códigos das peças

- **Dianteira original Honda:** 06455-KVK-900
- **Traseira original Honda:** 06430-KTE-901

A Twister 2022+ mudou a pinça dianteira. **Confirme o ano antes de comprar** — a peça da geração anterior não serve.

## Procedimento (dianteira)

1. Afrouxe os dois parafusos da pinça (Allen 5 mm).
2. Retire o pino de travamento e puxe as pastilhas velhas.
3. **Empurre o pistão para dentro**, devagar, com uma espátula limpa. Vigie o nível do reservatório de fluido: ele sobe e pode transbordar.
4. Instale as novas no sentido correto.
5. Lubrifique o pino guia com graxa de silicone — nunca graxa comum.
6. Monte e aperte o eixo com torque (65 Nm).
7. **Bombeie a manete até endurecer, antes de sair.** Na primeira frenagem sem isso, não há freio nenhum.

## Assentamento das pastilhas novas

Pastilha nova precisa transferir uma camada fina de material para o disco. Sem isso, o freio é fraco nos primeiros 200 km:

1. Acelere até 60 km/h e freie moderadamente até 20 km/h.
2. Acelere de novo sem parar completamente.
3. Repita 10 vezes.
4. Deixe esfriar 10 minutos sem usar o freio.
5. Evite freada brusca nos primeiros 100 km.

## E o disco?

Troque se: a moto treme ao frear (empeno acima de 0,3 mm), o dedo encaixa na ranhura, a espessura caiu abaixo de 3,5 mm, ou há qualquer trinca.

> **No Moto Track:** registre a data e o km da troca. Com dois registros o app já sabe quanto **as suas** pastilhas duram e avisa antes da próxima.$md$,
  true,
  '2026-04-08 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Cronograma de manutenção da corrente: Yamaha MT-07, XJ6 e Tracer 900',
  'cronograma-manutencao-corrente-yamaha-mt07-xj6-tracer900',
  'Quando lubrificar, ajustar e trocar a corrente da sua Yamaha. Intervalos por modelo, qual lubrificante usar, como medir a folga e sinais de desgaste.',
  'Cronograma de manutenção da corrente Yamaha MT-07, XJ6 e Tracer 900. Lubrificação, ajuste de folga, sinais de desgaste e troca do kit.',
  $md$## O item mais negligenciado da moto

Muita gente troca óleo religiosamente e esquece a corrente. O resultado é pinhão com dente em gancho, coroa desgastada e, no pior caso, corrente arrebentando em movimento e travando a roda traseira. Manter uma corrente custa 15 minutos a cada 500 km.

## Cronograma

| Intervalo | Tarefa | Tempo |
|-----------|--------|-------|
| A cada 500 km | Lubrificar com a corrente limpa e seca | 10 min |
| A cada 1.000 km | Verificar a folga e ajustar se preciso | 15 min |
| A cada 3.000 km | Limpar com querosene e escova, relubrificar | 30 min |
| A cada 15.000–20.000 km | Avaliar troca do kit completo | Oficina |

## Vida útil por modelo

| Modelo | Troca da corrente |
|--------|-------------------|
| MT-07 (2014–2024) | 25.000–30.000 km |
| XJ6 (2009–2020) | 20.000–25.000 km |
| Tracer 900 / GT (2015+) | 25.000–30.000 km |

## Como medir a folga

1. Moto no cavalete central, ou peça ajuda para levantar a traseira.
2. Ache o ponto médio entre a coroa e o pinhão.
3. Empurre a corrente para baixo até o limite e depois para cima.
4. Meça a diferença entre os dois extremos.

**Faixa ideal para MT-07, XJ6 e Tracer 900: 25 a 35 mm.**

Abaixo de 20 mm a corrente está tensionada demais e força o rolamento do pinhão. Acima de 40 mm ela bate no protetor e destrói o kit.

Meça em **vários pontos** girando a roda. Corrente desgastada tem folga irregular — e o ajuste deve seguir sempre o ponto **mais apertado**.

## Qual lubrificante usar

- **Parafina em spray (à base de cera):** uso urbano e asfalto. Não suja a roda.
- **Graxa branca de lítio:** chuva constante e terra. Dura mais, mas suja bastante.
- **Óleo de corrente sintético:** alta cilindrada (Tracer 900). Menos atrito e calor.
- **Graxa industrial: nunca.** Ela atrai areia como ímã e vira lixa dentro do retentor.

O momento certo é com a **corrente morna, logo depois de rodar** — o lubrificante penetra. E aplique no lado interno, que é a face que trabalha: a centrífuga espalha o resto.

## Sinais de que precisa trocar

- **No ajuste máximo e ainda solta:** esticou além do limite do tensionador.
- **Elo rígido:** não flexiona suavemente — há oxidação sob o retentor.
- **Ruído metálico constante** de corrente batendo.
- **O-ring ressecado ou faltando.**
- **Dente do pinhão em formato de gancho.**

## Troque o kit inteiro, sempre

Nunca troque só a corrente. Um pinhão gasto destrói uma corrente nova em 3.000 km. Um kit completo para a MT-07 custa entre R$ 350 e R$ 600. Economizar na coroa e no pinhão é gastar em dobro daqui a pouco.

## Ferramentas

- Chave de fenda grande, Allen 6 mm (varia por modelo)
- Torquímetro — o eixo traseiro pede 80–100 Nm na maioria das Yamaha
- Cavalete traseiro (muito recomendado)
- Régua ou trena

Se o torque do eixo traseiro te deixa inseguro, deixe o ajuste para a oficina. A lubrificação, porém, é simples e é sua.

> **No Moto Track:** crie um lembrete de lubrificação a cada 500 km. É o intervalo mais fácil de perder de vista — e o mais barato de cumprir.$md$,
  true,
  '2026-04-21 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Guia completo: troca de óleo da Yamaha FZ25 e Fazer 250',
  'guia-troca-oleo-yamaha-fz25-fazer-250',
  'Tudo sobre a troca de óleo da Fazer 250: viscosidade por clima, quantidade exata, torque do bujão e do filtro, passo a passo e os erros que matam o motor.',
  'Passo a passo completo para trocar o óleo da Yamaha FZ25 e Fazer 250. Especificações de viscosidade, torque, filtros recomendados e ferramentas.',
  $md$## Por que o óleo é a manutenção que mais importa

O óleo lubrifica, refrigera o cabeçote, limpa impurezas e ajuda a vedar os anéis. Na FZ25/Fazer 250 a recomendação de fábrica é a cada 5.000 km ou 6 meses. Quem roda muito parado no trânsito deve trabalhar com 4.000 km — o motor faz hora sem ventilação nenhuma.

## Qual viscosidade usar

A Yamaha recomenda 10W-30 ou 10W-40 semissintético (API SL ou superior) para o cenário brasileiro típico.

- **Calor acima de 35 °C:** 15W-40 ou 20W-50 sustentam a película em alta temperatura.
- **Frio abaixo de 10 °C:** 5W-30 facilita a partida e reduz o desgaste inicial.
- **Estrada longa e uso intenso:** 10W-40 sintético (API SN), mais estável termicamente.

## Especificações

| Item | Especificação |
|------|---------------|
| Capacidade com troca de filtro | 1,30 litro |
| Capacidade sem filtro | 1,15 litro |
| Filtro | Yamaha 5D7-E3440-00 ou equivalente |
| Torque do bujão de drenagem | 20 Nm |
| Torque do filtro | 10 Nm (ou à mão + 3/4 de volta) |
| Intervalo | 5.000 km / 6 meses |

## Passo a passo

1. **Aqueça o motor** 3–5 minutos: óleo quente drena melhor e leva mais sujeira.
2. **Abra a tampa de enchimento** para o óleo descer sem fazer vácuo.
3. **Posicione o recipiente** embaixo do motor.
4. **Solte o bujão** (chave 17 mm), anti-horário. Ele vai cair no óleo quente — conte com isso.
5. **Espere 5–10 minutos** até parar de pingar.
6. **Remova o filtro** com chave de cinta.
7. **Passe óleo novo no anel de borracha** do filtro novo. Sem isso o anel agarra e rasga.
8. **Instale o filtro** à mão até encostar, mais 3/4 de volta.
9. **Feche o bujão com arruela nova**, 20 Nm.
10. **Coloque 1,15 litro.**
11. **Ligue por 30 segundos** e desligue.
12. **Espere 2 minutos** e complete pela vareta.

## A arruela de alumínio é descartável

Ela deforma para vedar — é o trabalho dela. Reutilizada, ela não deforma de novo e você vai ter um vazamento lento no bujão. Custa centavos. Troque sempre.

## A primeira troca (amaciamento)

A primeira troca é aos 1.000 km. Use óleo mineral barato nessa fase: ele ajuda a assentar os anéis e sai levando a limalha de fabricação. Troque o filtro junto. Depois disso, migre para semissintético.

## Erros que destroem o motor

- **Óleo de carro:** a moto tem embreagem em banho de óleo. Aditivo de economia de atrito faz a embreagem patinar. Procure a especificação **JASO MA2** no rótulo.
- **Não trocar o filtro:** é ele que segura a partícula metálica. Trocar óleo e manter o filtro é tomar banho e vestir a roupa suja.
- **Apertar demais o bujão:** espana a rosca do cárter, e aí o conserto é outro nível de caro.
- **Nível errado:** acima do máximo gera pressão e vaza pelos retentores; abaixo do mínimo acelera o desgaste.

## Descarte

Guarde em garrafa PET limpa e entregue em posto ou oficina. Um litro de óleo usado contamina muita água. Nunca no ralo, nunca no lixo comum.

> **No Moto Track:** registre a troca com o km e o app calcula o próximo intervalo e avisa antes de vencer — por quilometragem ou por data, o que chegar primeiro.$md$,
  true,
  '2026-05-02 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Como calcular o consumo exato de combustível da Honda CB 500X',
  'como-calcular-consumo-combustivel-honda-cb-500x',
  'O método do tanque cheio para medir o consumo real da CB 500X. Tabela por versão, os 7 fatores que mudam o gasto e os erros que estragam a medição.',
  'Guia completo para calcular o consumo exato da Honda CB 500X. Método do tanque cheio, valores de referência por versão e fatores que influenciam.',
  $md$## Por que o painel não mostra o consumo real

O computador de bordo da CB 500X calcula uma média a partir do tempo de injeção. Ele não sabe do vento contra, da carga, da altitude, da qualidade do combustível nem da temperatura. Diferenças de 5% a 12% entre painel e realidade são comuns — quase sempre a favor da moto. Para saber quanto ela bebe de verdade existe um método confiável: o tanque cheio.

## O método do tanque cheio

1. **Encha até a borda do bocal**, sem espuma. Anote o odômetro.
2. **Rode no mínimo 200 km** no seu ritmo normal. Não ande diferente para "melhorar" o número.
3. **Volte ao mesmo posto e à mesma bomba.**
4. **Encha até a borda**, com a moto na mesma posição (vertical, no cavalete central).
5. **Anote os litros** com uma casa decimal.
6. **Divida:** km percorridos ÷ litros = km/L.

> **Exemplo:** 248 km rodados e 9,8 litros abastecidos = 248 / 9,8 = **25,3 km/L**.

## Valores de referência reais

| Versão | Cidade | Estrada 80 km/h | Estrada 120 km/h |
|--------|--------|-----------------|------------------|
| 2013–2015 | 20–23 km/L | 26–29 km/L | 22–25 km/L |
| 2016–2018 | 21–24 km/L | 27–30 km/L | 23–26 km/L |
| 2019–2021 | 22–25 km/L | 28–31 km/L | 24–27 km/L |
| 2022+ (Euro 5) | 24–27 km/L | 30–33 km/L | 25–28 km/L |

*Compilado de relatos de proprietários e testes independentes.*

## 7 fatores que mexem no consumo

1. **Pressão dos pneus.** Abaixo de 29 psi / 33 psi você perde até 1,5 km/L só de resistência ao rolamento.
2. **Velocidade.** A 120 km/h o consumo cai 15–20% em relação a 90 km/h. O arrasto cresce com o **quadrado** da velocidade.
3. **Carga e aerodinâmica.** Malas laterais cheias e top case alto pesam mais no ar do que na balança.
4. **Altitude.** Acima de 1.000 m a mistura muda e a injeção compensa.
5. **Combustível.** Gasolina adulterada ou com etanol acima do permitido rende menos.
6. **Filtro de ar entupido.** Até 2 km/L, porque a injeção enriquece para compensar.
7. **Pilotagem.** Reduzir marcha cedo demais em subida gira o motor à toa.

## Erros que estragam a medição

- **Trocar de bomba.** Cada bico tem tolerância de calibração. Mudar de posto vira erro no resultado.
- **Rodar pouco.** Com 50 km, o erro de arredondamento do bico domina a conta. Mínimo: 200 km.
- **Inclinar a moto diferente.** Inclinada para o lado do bocal, entra menos combustível e o número mente.
- **Medir uma vez só.** Um tanque é uma amostra. A média de três é um dado.

## Como economizar de verdade

- Mantenha 29 psi (dianteiro) e 33 psi (traseiro).
- Cruzeiro em 6ª por volta de 5.000 rpm é o ponto doce da CB 500X.
- Tire as malas quando não estiver viajando.

> **No Moto Track:** cadastre cada abastecimento e o app faz essa conta sozinho — consumo por tanque, tendência mensal e custo por km. Quando o consumo cai fora da faixa, ele avisa: normalmente é filtro de ar, pneu murcho ou injeção pedindo atenção.$md$,
  true,
  '2026-05-14 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Como fazer a troca de óleo da Honda CG 160 (2016–2024)',
  'troca-de-oleo-honda-cg-160',
  'Passo a passo da manutenção mais comum da moto mais vendida do Brasil. Serve para Titan, Fan e Start: materiais, especificações, torque e intervalos.',
  'Guia passo a passo para trocar o óleo da Honda CG 160 Titan, Fan e Start. Óleo recomendado, quantidade, torque e intervalo de troca.',
  $md$## A manutenção que decide a vida da CG

A troca de óleo é a manutenção mais importante da Honda CG 160 — e a mais fácil de fazer em casa. Titan, Fan ou Start: o procedimento é o mesmo. O motor é refrigerado a ar, então o óleo também é o sistema de arrefecimento. Óleo velho aqui não é desgaste lento, é motor quente.

## Materiais

- 1 litro de óleo (Honda 10W-30 semissintético)
- Chave de boca ou soquete de 12 mm
- Arruela de vedação nova do bujão
- Recipiente para o óleo usado
- Funil e panos limpos

## Passo a passo

1. **Aqueça o motor** 3 a 5 minutos. Óleo fluido drena mais completo e leva mais sujeira.
2. **Deixe a moto no plano**, de preferência no cavalete central.
3. **Solte o bujão de drenagem** na parte de baixo do motor, com a chave de 12 mm, e deixe escorrer tudo.
4. **Limpe o bujão** e confira o ímã da ponta, se o seu tiver: pasta metálica fina é normal, lasca não é.
5. **Troque a arruela** e recoloque o bujão sem forçar — a rosca é no alumínio do cárter e espana fácil.
6. **Abasteça com 1 litro** pelo bocal da vareta, no lado direito do motor.
7. **Confira o nível:** limpe a vareta, encoste sem rosquear e veja se está entre as marcas.

## Especificações

| Item | Especificação |
|------|---------------|
| Óleo | Honda 10W-30 semissintético (JASO MA2) |
| Capacidade | ~1,0 litro |
| Intervalo (uso normal) | 3.000 km |
| Intervalo (uso severo) | 2.000 km |
| Primeira troca | 1.000 km |

## Qual é o seu intervalo, afinal?

O manual fala em 3.000 km para uso normal. O detalhe é que "uso normal" não é o que a maioria das CG faz. **Uso severo** — que pede 2.000 km — inclui:

- Trajeto curto no trânsito, sem o motor esquentar direito
- Entrega e aplicativo, com o motor horas em marcha lenta
- Estrada de terra e poeira

Se a sua CG trabalha, ela é uso severo. Não é opinião, está no manual.

## A vareta não se rosqueia para medir

Erro clássico: rosquear a vareta para checar o nível. Isso faz o nível parecer mais alto do que é, e você anda com óleo de menos. **Encoste e retire.**

## Onde descartar

Garrafa PET e entrega no posto ou na oficina. Nunca no ralo.

> **No Moto Track:** registre a troca com o km e escolha o intervalo do seu perfil de uso. O lembrete chega antes de vencer, e o histórico vira argumento de preço quando você for vender.$md$,
  true,
  '2026-05-27 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Bateria de moto: por que ela morre e como fazer durar',
  'bateria-de-moto-como-cuidar-e-testar',
  'A bateria quase nunca morre de velhice — ela morre de descuido. Como testar com multímetro, o que é corrente parasita e por que moto parada mata bateria.',
  'Como cuidar da bateria da moto e fazer durar mais. Teste com multímetro, tensão correta, corrente parasita e cuidados com a moto parada.',
  $md$## Ela raramente morre de velhice

Uma bateria de moto dura de 2 a 4 anos. Quando morre com 1 ano, quase sempre não foi defeito: foi sulfatação por ficar descarregada, ou uma moto que passou semanas parada. A boa notícia é que os dois têm conserto — antes de acontecer.

## Os números que importam

Você precisa de um multímetro. Custa pouco e é o único jeito de saber a verdade.

| Medida | Valor saudável | O que significa fora disso |
|--------|----------------|---------------------------|
| Em repouso (moto desligada, 1h) | 12,6–12,8 V | Abaixo de 12,4 V: parcialmente descarregada |
| Repouso crítico | — | Abaixo de 12,0 V: sulfatando agora |
| Motor a 5.000 rpm | 13,5–14,5 V | Abaixo de 13,0 V: não está carregando |
| Motor a 5.000 rpm | — | Acima de 15,0 V: regulador com defeito, vai ferver a bateria |

Se em repouso está bom mas a moto não pega, o problema não é a bateria — é a partida, o relé ou o contato.

## Por que moto parada mata bateria

Uma bateria descarregada não fica esperando. Ela **sulfata**: forma cristais de sulfato de chumbo nas placas, e cada dia parada torna esse processo mais irreversível. Duas ou três semanas de moto parada bastam para tirar meses de vida útil.

Além disso, quase toda moto tem consumo parasita (relógio, alarme, injeção). Ele é pequeno, constante e não perdoa.

## Se a moto vai ficar parada

- **Melhor opção:** carregador mantenedor (float charger). Ele monitora e completa a carga sozinho. Não é o mesmo que carregador comum — carregador comum esquecido **ferve** a bateria.
- **Alternativa:** desconecte o polo **negativo** primeiro. Elimina o parasita, mas não impede a auto-descarga.
- **O que não funciona:** ligar a moto 5 minutos por semana. Isso **piora** — a partida gasta mais carga do que a marcha lenta repõe. Se for ligar, ande 20 minutos de verdade.

## Cuidados que custam zero

- **Terminais limpos e apertados.** Aquele pó branco-esverdeado é resistência: a bateria pode estar boa e a moto não pegar.
- **Passe graxa** nos terminais depois de apertar. Não antes — graxa entre o terminal e o polo isola.
- **Confira se está firme.** Vibração solta as placas por dentro e não tem conserto.
- **Bateria com manutenção:** confira o nível do eletrólito. Complete **só com água destilada**, nunca com água de torneira nem ácido.

## Chupeta com segurança

Chupeta de carro **com o motor do carro desligado**. Motor ligado, o alternador do carro entrega muito mais corrente do que a moto aguenta e pode levar a injeção junto. Positivo primeiro, negativo por último, e o negativo no chassi — não no polo da bateria descarregada.

E lembre: chupeta te leva para casa, não conserta nada. Se precisou, teste o sistema.

## Quando trocar

- Repouso abaixo de 12,0 V mesmo depois de carga completa
- Precisa de chupeta mais de uma vez no mês
- Carcaça estufada — troque **agora**, não discuta
- Mais de 4 anos e partida preguiçosa a frio

> **No Moto Track:** anote a data da compra da bateria e a tensão de repouso a cada revisão. Uma bateria não morre de repente: ela avisa por meses caindo alguns décimos de volt — mas só se alguém estiver anotando.$md$,
  true,
  '2026-06-05 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Vela de ignição: quando trocar e como ler o que ela conta',
  'quando-trocar-vela-de-ignicao-moto',
  'A vela é a peça mais barata da moto e a que mais entrega o estado do motor. Intervalos, folga do eletrodo, torque e como ler a cor do isolador.',
  'Quando trocar a vela de ignição da moto, como escolher entre comum e irídio, folga correta, torque de aperto e diagnóstico pela cor da vela.',
  $md$## A peça mais barata e a mais informativa

Uma vela custa entre R$ 15 e R$ 80 e é o item que mais conta sobre a saúde do motor. Quem sabe ler uma vela usada descobre mistura rica, óleo passando por anel e superaquecimento sem abrir nada.

## Intervalos

| Tipo | Intervalo | Observação |
|------|-----------|------------|
| Comum (níquel) | 10.000 km | Barata, exige mais atenção |
| Platina | 20.000 km | Meio-termo |
| Irídio | 30.000–40.000 km | Cara, dura mais, faísca mais estável |

Irídio compensa em moto que roda muito. Em uso urbano leve, vela comum trocada no prazo faz o mesmo trabalho. O que não funciona é vela cara vencida.

## Lendo a vela usada

Tire a vela depois de rodar e olhe o isolador de cerâmica em volta do eletrodo central:

| Cor / aspecto | Diagnóstico |
|---------------|-------------|
| Marrom-claro ou cinza | Tudo certo |
| Preta e seca (fuligem) | Mistura rica, filtro de ar sujo ou muita marcha lenta |
| Preta e oleosa | Óleo passando: anel ou guia de válvula |
| Branca ou gretada | Mistura pobre ou superaquecimento — perigoso, investigue |
| Eletrodo arredondado | Simplesmente gasta: troque |
| Pontos metálicos derretidos | Detonação. Pare e diagnostique antes de furar o pistão |

Branca e eletrodo derretido são sintomas sérios. Trocar a vela e seguir em frente é tratar o alarme, não o incêndio.

## Folga do eletrodo

A folga vem de fábrica, mas confira antes de instalar — vela cai na caixa e amassa o eletrodo com frequência.

- Faixa típica em moto nacional: **0,6 a 0,7 mm** (confirme no seu manual).
- Meça com calibrador de lâminas ou de arame.
- Ajuste dobrando **só o eletrodo lateral**, nunca o central.
- **Nunca ajuste vela de irídio.** O eletrodo é fino e quebra; ela vem na folga certa.

## Torque: onde todo mundo erra

Vela apertada demais espana a rosca do cabeçote — e aí o conserto é caro. Frouxa demais não troca calor com o cabeçote, superaquece e pode soltar.

O jeito certo, sem torquímetro:

1. Rosqueie **com a mão** até encostar a arruela.
2. Aperte mais **meia volta** (arruela nova) ou **1/8 de volta** (vela já usada, arruela já esmagada).

Com torquímetro: 10–12 Nm na maioria das motos nacionais. E rosqueie sempre com o motor **frio** — alumínio quente é presente para espanar rosca.

## Um detalhe que salva rosca

Antes de tirar a vela, sopre a cavidade. Areia e poeira acumuladas ali caem direto no cilindro assim que a vela sai.

> **No Moto Track:** cadastre a troca de vela como lembrete por quilometragem e registre a cor que você encontrou. Ao longo do tempo, essa anotação é o que mostra que a mistura está mudando — bem antes de virar problema.$md$,
  true,
  '2026-06-16 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Filtro de ar da moto: limpar ou trocar?',
  'filtro-de-ar-da-moto-limpar-ou-trocar',
  'Filtro entupido rouba até 2 km/L e enriquece a mistura. Saiba qual é o tipo do seu (papel, espuma ou lavável), o intervalo certo e como limpar sem estragar.',
  'Filtro de ar da moto: quando limpar e quando trocar. Diferença entre papel, espuma e filtro lavável, intervalos e efeito no consumo.',
  $md$## O item barato que mexe no consumo

Um filtro de ar entupido pode custar até 2 km/L. O motor precisa de ar; se ele entra com dificuldade, a injeção enriquece a mistura para compensar. Você paga isso em combustível, em fuligem na vela e em carbono na câmara.

## Primeiro: qual é o seu filtro?

Isso decide tudo. Limpar o tipo errado destrói o filtro.

| Tipo | Como reconhecer | Limpar? |
|------|-----------------|---------|
| Papel (seco, sanfonado) | Sanfona branca ou amarela, seca | **Não.** Só troca |
| Espuma (a óleo) | Esponja, levemente oleosa | Sim, lava e re-oleia |
| Lavável (K&N e afins) | Gaze entre telas metálicas | Sim, com kit próprio |

## Papel: não tente limpar

É o mais comum nas motos nacionais. Bater, escovar ou soprar com ar comprimido **rasga as fibras** — e um filtro furado deixa passar areia direto para o cilindro. O dano é invisível na hora e definitivo.

Se está sujo, troque. Custa entre R$ 25 e R$ 60.

Um sopro leve de fora para dentro, com pressão baixa, tira folha e inseto grande — mas isso é limpeza de porta-filtro, não recuperação do elemento.

## Espuma: lave direito ou não lave

1. Lave com água morna e sabão neutro (ou desengraxante próprio).
2. **Aperte, não torça.** Torcer rasga a espuma.
3. Deixe secar completamente, à sombra. Nunca no sol nem com secador.
4. **Re-oleie com óleo de filtro** e espalhe até ficar uniforme.
5. Aperte o excesso.

**Espuma sem óleo não filtra nada.** O óleo é o que prende a poeira; a espuma seca é só uma peneira grossa. Esse é o erro mais comum.

## Lavável: cuidado com o excesso de óleo

Use o kit da marca. Óleo demais migra para o sensor de fluxo de ar e bagunça a leitura da injeção — a moto começa a falhar e ninguém liga ao filtro.

## Intervalos

| Uso | Verificar | Trocar / limpar |
|-----|-----------|-----------------|
| Urbano | 6.000 km | 12.000 km |
| Estrada | 8.000 km | 15.000 km |
| Terra e poeira | 2.000 km | Conforme o estado |

Verificar é olhar. Se dá para ver a luz do outro lado, ainda respira.

## Sinais de filtro entupido

- Consumo caindo sem explicação
- Falta de força em rotação alta
- Vela preta e seca
- Marcha lenta oscilando

## Nunca rode sem filtro

Existe a lenda de que tirar o filtro "dá força". Dá — por algumas centenas de km, até a areia riscar o cilindro. É o jeito mais barato de destruir um motor.

> **No Moto Track:** registre a troca do filtro e acompanhe a curva de consumo. Uma queda gradual de km/L sem mudança de rota é o filtro pedindo atenção — e o gráfico mostra isso antes da moto reclamar.$md$,
  true,
  '2026-06-25 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Manutenção da Honda Biz 125: o guia de quem roda o dia inteiro',
  'manutencao-honda-biz-125',
  'A Biz aguenta muito, e é por isso que ela é maltratada. Intervalos reais para uso de entrega, óleo, transmissão, freio a tambor e o que muda no uso severo.',
  'Guia de manutenção da Honda Biz 125 para uso intenso e entrega. Intervalos de óleo, corrente, freio a tambor e cuidados de uso severo.',
  $md$## A moto que trabalha

A Biz 125 é provavelmente a moto mais maltratada do Brasil — justamente porque aguenta. Ela roda o dia inteiro, com bag pesado, no trânsito, e não reclama. O problema é que "não reclamar" não é o mesmo que "não desgastar". Quem tira o sustento dela precisa de um intervalo diferente do que está no manual.

## Uso severo não é exceção, é a regra

O manual traz intervalos para uso normal. Se a sua Biz trabalha, ela está em **uso severo** — e isso está previsto no próprio manual:

- Trajeto curto e repetido, sem o motor atingir a temperatura de trabalho
- Muito tempo em marcha lenta no trânsito parado
- Carga constante (bag, garupa)
- Poeira

Não é pessimismo: é a definição oficial. Uma Biz de entregador roda em condição severa todo dia.

## Intervalos reais para quem trabalha

| Item | Uso normal | Uso de trabalho |
|------|------------|-----------------|
| Óleo do motor | 3.000 km | **2.000 km** |
| Lubrificação da corrente | 1.000 km | **500 km** |
| Folga da corrente | 1.000 km | 500 km |
| Filtro de ar | 12.000 km | 6.000 km |
| Vela | 10.000 km | 8.000 km |
| Lona de freio (tambor) | Verificar 10.000 km | Verificar 5.000 km |

## Óleo

- Honda 10W-30 semissintético, especificação **JASO MA2**.
- Capacidade em torno de 0,8 litro — confira a vareta, não o palpite.
- A Biz tem embreagem automática centrífuga, e ela vive no mesmo óleo. Óleo velho aqui não é só desgaste do motor: é embreagem patinando e arranque preguiçoso.

Essa é a diferença mais importante da Biz para a CG: **o óleo cuida da embreagem também.**

## Transmissão

A corrente da Biz é fechada, o que engana muita gente: "não vejo, não existe". Ela vive dentro da carenagem, junta poeira, e ninguém olha.

- Folga: 25–35 mm (confirme no manual do seu ano).
- Lubrifique a cada 500 km em uso de trabalho.
- Carga pesada acelera o desgaste do kit: bag cheio é peso permanente na traseira.

## Freio a tambor traseiro

Boa parte das Biz tem tambor atrás. Ele é diferente do disco em dois pontos:

- **Não dá para inspecionar de fora.** Use o indicador de desgaste na alavanca: com o freio acionado, a seta deve ficar dentro da faixa marcada.
- **Ele acumula pó de lona por dentro.** Na revisão, abra e limpe. Pó de lona acumulado reduz a frenagem gradualmente — tão devagar que você se acostuma sem perceber.

Regule o freio pela porca borboleta até ter uma folga pequena e confortável na alavanca. Sem folga nenhuma, a lona arrasta e esquenta.

## Pneus e carga

- Calibre com o peso que você **realmente** carrega, não com a moto vazia.
- Com bag cheio, suba 2 a 4 psi no traseiro.
- Verifique semanalmente: a Biz de trabalho pega prego com muito mais frequência.

## O cálculo que importa para quem trabalha

Manutenção em dia numa Biz custa por volta de R$ 60–80 por mês em uso intenso. Uma embreagem destruída por óleo velho custa muito mais que isso — e leva a moto (e o dia de trabalho) para a oficina.

> **No Moto Track:** use os turnos para registrar receita e quilometragem do dia. Junto com abastecimento e manutenção, você descobre o **lucro real por dia** — e não o que parece sobrar no bolso.$md$,
  true,
  '2026-07-02 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Como fazer a troca de óleo da Honda CG 125 (Fan e Cargo)',
  'troca-de-oleo-honda-cg-125',
  'A troca de óleo da CG 125 passo a passo: qual óleo, quantidade exata, torque do bujão, intervalo por perfil de uso e os erros que custam motor.',
  'Guia passo a passo para trocar o óleo da Honda CG 125 Fan e Cargo. Óleo recomendado, quantidade, torque, intervalo e erros comuns.',
  $md$## A manutenção mais simples que existe

A CG 125 é a moto mais fácil do Brasil de manter, e a troca de óleo é o serviço mais simples dela. Leva 20 minutos, custa o preço de um litro de óleo e é literalmente a diferença entre um motor que passa dos 100.000 km e um que morre aos 40.000.

O motor é refrigerado a ar. Não existe radiador nem líquido de arrefecimento: **o óleo é o sistema de arrefecimento**. Óleo velho na CG não é desgaste lento, é motor quente todos os dias.

## Materiais

- 1 litro de óleo 10W-30 semissintético (especificação **JASO MA2**)
- Chave de 12 mm (boca ou soquete)
- Arruela de vedação nova do bujão
- Bacia para o óleo usado
- Funil e pano

## Especificações

| Item | Especificação |
|------|---------------|
| Óleo | Honda 10W-30 semissintético (JASO MA2) |
| Capacidade | ~0,9 litro (confirme pela vareta) |
| Torque do bujão | 24 Nm |
| Intervalo — uso normal | 3.000 km |
| Intervalo — uso severo | 2.000 km |
| Primeira troca | 1.000 km |

## Passo a passo

1. **Aqueça o motor** por 3 a 5 minutos. Óleo quente é mais fino, sai mais completo e leva mais sujeira junto. Quente o bastante para escorrer, não a ponto de queimar sua mão.
2. **Deixe a moto no plano**, no cavalete central. Inclinada, sobra óleo velho lá dentro.
3. **Retire a vareta** (lado direito do motor) antes de drenar. Sem ela, o cárter faz vácuo e o óleo desce devagar.
4. **Posicione a bacia** e solte o bujão embaixo do motor com a chave de 12 mm, girando no anti-horário. Ele vai cair no óleo quente — segure firme.
5. **Espere 5 a 10 minutos** até virar pingo. A pressa aqui deixa óleo velho no motor.
6. **Limpe o bujão** e olhe o ímã da ponta: pasta metálica fina é normal e esperado. Lasca ou fiapo de metal, não — leve a um mecânico antes de fechar.
7. **Troque a arruela** e recoloque o bujão. Aperte com firmeza, sem força de macho: a rosca é no alumínio do cárter.
8. **Abasteça com ~0,9 litro** pelo bocal da vareta, com funil.
9. **Confira o nível:** limpe a vareta, **encoste sem rosquear** e veja se está entre as marcas. Complete de pouco em pouco.
10. **Ligue por 30 segundos**, desligue, espere 2 minutos e confira de novo.

## Qual é o seu intervalo de verdade

O manual diz 3.000 km. Mas "uso normal" não é o que a maioria das CG 125 faz. Você está em **uso severo** — e deve trocar a cada 2.000 km — se:

- Faz trajetos curtos, de poucos km, sem o motor esquentar direito
- Roda em trânsito parado, com o motor horas em marcha lenta sem ventilação
- Anda em estrada de terra ou poeira
- Carrega carga com frequência (Cargo, bag, garupa)

Motor a ar parado no trânsito é o pior cenário possível: ele gera calor e não recebe vento nenhum.

## Erros que custam motor

- **Óleo de carro.** Parece igual e é mais barato — e é o jeito mais rápido de destruir a embreagem. A CG tem embreagem em banho de óleo, e o aditivo de economia de atrito do óleo automotivo faz ela patinar. Procure **JASO MA2** no rótulo. Se não tiver, não é óleo de moto.
- **Rosquear a vareta para medir.** Rosqueada, ela mostra um nível mais alto do que o real e você anda com óleo de menos. **Encoste e retire.**
- **Reaproveitar a arruela.** Ela deforma para vedar — é para isso que serve. Reutilizada, ela não veda de novo e você ganha um vazamento lento.
- **Apertar demais o bujão.** Espanar a rosca do cárter transforma uma troca de R$ 40 num conserto de centenas.
- **Completar em vez de trocar.** Óleo não "acaba", ele se degrada. Completar dilui o velho, não o substitui.

## Nível é semanal, não anual

A CG 125 consome um pouco de óleo, e isso é normal num motor a ar. O que não é normal é descobrir isso quando a vareta já está seca. Cheque toda semana: leva 30 segundos e é a verificação com melhor retorno da moto inteira.

## Descarte

Garrafa PET limpa e entrega no posto ou na oficina. Um litro de óleo usado contamina uma quantidade absurda de água. Nunca no ralo, nunca no lixo comum, nunca no quintal.

> **No Moto Track:** registre a troca com o km e escolha o intervalo do seu perfil de uso. O lembrete chega antes de vencer — e o histórico completo vira dinheiro na hora de vender: moto com manutenção documentada não sofre o mesmo desconto na conversa.$md$,
  true,
  '2026-07-09 09:00:00+00'
),
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Quanto custa manter uma moto por ano no Brasil',
  'quanto-custa-manter-uma-moto-por-ano-brasil',
  'A conta completa e honesta: IPVA, seguro, combustível, manutenção, pneus e depreciação. Com exemplos reais para 125 cc, 300 cc e 500 cc.',
  'Quanto custa manter uma moto por ano no Brasil: IPVA, seguro, combustível, manutenção, pneus e depreciação, com exemplos por cilindrada.',
  $md$## A conta que quase ninguém faz

Quase todo mundo sabe quanto pagou na moto. Quase ninguém sabe quanto ela custa por ano. E essa é a única conta que importa, porque é ela que sai do bolso todo mês.

Vamos fazer a conta inteira, com números do Brasil de 2026 e um cenário de **12.000 km por ano** (mil km por mês, o padrão de uso urbano).

## 1. Custos fixos (você paga mesmo parado)

| Item | 125 cc | 300 cc | 500 cc |
|------|--------|--------|--------|
| IPVA (~2% do valor venal) | R$ 200 | R$ 450 | R$ 800 |
| Licenciamento | R$ 130 | R$ 130 | R$ 130 |
| Seguro | R$ 700 | R$ 1.600 | R$ 2.400 |
| **Subtotal** | **R$ 1.030** | **R$ 2.180** | **R$ 3.330** |

O seguro é o item que mais varia: CEP, idade, garagem e histórico mudam tudo. Alguns estados isentam de IPVA motos até 150 cc — confirme o seu.

## 2. Combustível (12.000 km/ano)

| Cilindrada | Consumo real | Litros/ano | Custo (R$ 6,20/L) |
|------------|--------------|------------|-------------------|
| 125 cc | 45 km/L | 267 L | R$ 1.655 |
| 300 cc | 30 km/L | 400 L | R$ 2.480 |
| 500 cc | 25 km/L | 480 L | R$ 2.976 |

## 3. Manutenção programada

| Item | 125 cc | 300 cc | 500 cc |
|------|--------|--------|--------|
| Óleo e filtro (4–6 trocas) | R$ 320 | R$ 600 | R$ 900 |
| Kit relação (rateado) | R$ 150 | R$ 250 | R$ 400 |
| Pastilhas / lonas | R$ 90 | R$ 180 | R$ 300 |
| Filtro de ar e vela | R$ 80 | R$ 150 | R$ 250 |
| Revisões e mão de obra | R$ 300 | R$ 500 | R$ 800 |
| **Subtotal** | **R$ 940** | **R$ 1.680** | **R$ 2.650** |

## 4. Pneus (o custo que ninguém provisiona)

Pneu não é gasto anual, é gasto **rateado**. Um par dura de 15.000 a 25.000 km — ou seja, você troca a cada ano e meio, e leva um susto quando acontece.

| Cilindrada | Par de pneus | Vida | Custo/ano |
|------------|--------------|------|-----------|
| 125 cc | R$ 400 | 25.000 km | R$ 192 |
| 300 cc | R$ 900 | 20.000 km | R$ 540 |
| 500 cc | R$ 1.400 | 15.000 km | R$ 1.120 |

## 5. Total anual (sem depreciação)

| | 125 cc | 300 cc | 500 cc |
|---|--------|--------|--------|
| Fixos | R$ 1.030 | R$ 2.180 | R$ 3.330 |
| Combustível | R$ 1.655 | R$ 2.480 | R$ 2.976 |
| Manutenção | R$ 940 | R$ 1.680 | R$ 2.650 |
| Pneus | R$ 192 | R$ 540 | R$ 1.120 |
| **Total/ano** | **R$ 3.817** | **R$ 6.880** | **R$ 10.076** |
| **Por mês** | **R$ 318** | **R$ 573** | **R$ 840** |
| **Por km** | **R$ 0,32** | **R$ 0,57** | **R$ 0,84** |

## 6. E a depreciação?

É o maior custo de todos, e o mais invisível — porque não vem em boleto.

Uma moto perde de 8% a 12% do valor por ano. Numa moto de R$ 20.000, são R$ 1.600 a R$ 2.400 anuais. Isso quase **dobra** o custo real de uma 300 cc.

A depreciação é o único custo grande sobre o qual você tem controle sem abrir mão de nada: moto com histórico de manutenção documentado, nota de peça e revisão em dia se defende muito melhor na negociação. O comprador desconta o risco do desconhecido — e histórico é exatamente o que elimina o desconhecido.

## O número que realmente importa

Custo por km é a única métrica que permite comparar. Ela responde perguntas reais:

- Vale a pena ir de moto ou de aplicativo hoje?
- Essa moto maior compensa para o meu uso?
- Meu frete está cobrindo o custo, ou estou trabalhando de graça?

E aqui está o ponto: **a tabela acima é uma média. A sua moto não é uma média.** O seu consumo, o seu trajeto, o seu seguro e o seu estilo de pilotagem mudam esses números em até 40% para cima ou para baixo.

> **No Moto Track:** cada abastecimento, peça e revisão registrada vira custo por km **real** da sua moto — não estimativa de tabela. Em três meses de registro você sabe exatamente o que ela custa. E quando for vender, o histórico completo vai junto num relatório compartilhável.$md$,
  true,
  '2026-07-14 09:00:00+00'
)
on conflict (slug) do nothing;
