# Integrações de parceiros: contratos e pendências em 23/10/2026

Compra de peças no aplicativo e cotações reais de seguro continuam requisitos
abertos. O proprietário confirmou que ainda não possui contas de parceiro nem
credenciais de homologação. Este documento separa o código que pode ser preparado
agora da capacidade externa que ainda precisa ser comprovada.

## Mercado Livre

O aplicativo já possui `marketplace.ts`, com busca autenticada injetável,
validação de preços e links HTTPS brasileiros. A ação de manutenção atualmente
prepara uma busca externa. Ela não gera compra nem apresenta preços inventados.

A [documentação oficial de autorização](https://developers.mercadolivre.com.br/pt_br/mensagens-post-venda/autenticacao-e-autorizacao)
documenta código de autorização, PKCE, troca em
`https://api.mercadolibre.com/oauth/token` e renovação. Refresh tokens são de uso
único e substituídos na renovação. O [guia oficial de autenticação](https://developers.mercadolivre.com.br/pt_ar/autenticacao-e-autorizacao)
também recomenda `state`; a aplicação precisa validá-lo.

O novo `src/lib/server/domain/mercado-livre-oauth.ts` prepara esse contrato:

- URL brasileira de autorização com `S256`, verificador e estado aleatórios.
- Solicitação pendente vinculada ao proprietário autenticado, aplicativo,
  callback registrado e prazo curto.
- Troca e renovação por formulário no endpoint fixo, com redirecionamentos HTTP
  desabilitados e limite de tempo.
- Validação de identidade da conta remota, validade e par completo de tokens.
- Erros sem segredo, código de autorização ou corpo privado do provedor.
- Nenhuma repetição automática de concessão: falha de rede, timeout, HTTP 5xx ou
  sucesso ilegível podem ter consumido o código/refresh token.

O módulo é transporte de autenticação. Ainda não é um fluxo conectado à conta do
usuário. `beginMercadoLivreAuthorization` retorna uma URL pública e um objeto
`pending` privado: somente a URL deve ser enviada ao navegador. O objeto privado
não deve ser incluído em dados de página, logs ou telemetria.

Configuração proposta para a ligação futura, sempre do lado servidor:

| Nome                                 | Origem / uso                                 |
| ------------------------------------ | -------------------------------------------- |
| `MERCADO_LIVRE_CLIENT_ID`            | Aplicação cadastrada no DevCenter            |
| `MERCADO_LIVRE_CLIENT_SECRET`        | Segredo da mesma aplicação                   |
| `MERCADO_LIVRE_REDIRECT_URI`         | Callback HTTPS fixo e idêntico ao registrado |
| Chave de criptografia de credenciais | Segredo gerenciado para tokens em repouso    |

Não foram adicionados valores fictícios ao ambiente. Antes de ativar rotas,
persistir solicitações pendentes no servidor, associadas ao proprietário e
consumidas atomicamente uma única vez. Os tokens exigem armazenamento cifrado por
proprietário/conta, revogação/desconexão e retenção definida. Renovação deve ser
serializada por concessão, com comparação de versão ao persistir o novo par.
Resultado indeterminado mantém estado de reconciliação; não se reenvia o refresh
token antigo cegamente. O callback precisa validar a sessão e a associação antes
de consumir o registro pendente.

A [documentação oficial de orders](https://developers.mercadolivre.com.br/pt_br/imovel-consulta-de-usuarios/gerenciamento-de-vendas)
descreve pedidos criados pelo cliente no checkout e sua consulta/gestão por API.
O contrato consultado não comprova criação de uma compra na conta do comprador
por um checkout próprio do Moto Track. Isso é uma lacuna de capacidade a confirmar
com o Mercado Livre, além das credenciais. Não foi inventado `POST /orders`, nem
tratado um pagamento Mercado Pago como compra de qualquer anúncio Mercado Livre.

Para fechar o requisito de compra, é necessário um contrato oficialmente
suportado para esse uso, elegibilidade do aplicativo e teste de comprador/vendedor:
estoque, frete, preço final, consentimento, confirmação do pagamento/pedido,
cancelamento e atualização autenticada de status. Uma resposta simulada de OAuth
ou uma busca com token não constitui essa prova.

## Seguro

As apólices, sinistros e lembretes existentes são registros do proprietário. Não
consultam seguradoras nem equivalem a uma oferta de seguro.

O [portal de desenvolvimento Porto](https://dev.portoseguro.com.br/api-portal/?language=pt-br)
informa que o cadastro de APIs está restrito a parceiros com acordo já
estabelecido. O catálogo público, por si só, não confirma acesso ao produto Moto
nem autorização para o Moto Track cotar em nome do cliente.

A [documentação oficial Gente Seguradora](https://apidocs.genteseguradora.com.br/)
publica um fluxo com credencial, criação de cotação, veículo e coberturas. Isso
demonstra um contrato específico, mas não comprova elegibilidade de motocicletas,
disponibilidade comercial para o Moto Track ou permissão de usar dados de clientes.
Nenhuma dessas empresas foi escolhida como fornecedora pelo proprietário.

Não existe uma API universal de cotação que possa ser implementada com um URL
arbitrário. Um adaptador real deve ser derivado do contrato do parceiro escolhido.
Por isso não se criaram endpoint, cabeçalho de autenticação, cotação, prêmio ou
franquia fictícios. A seleção do parceiro precisa definir:

| Contrato necessário                          | Evidência que fecha a pendência                                    |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Produto Moto e uso por entregador/aplicativo | Documentação e aceite do parceiro para os usos oferecidos          |
| Credenciais e ambientes separados            | Sandbox acessível e exemplo oficial de autenticação                |
| Campos obrigatórios e consentimento          | Esquema versionado e escopo autorizado de transmissão              |
| Envio, processamento e consulta              | Identificadores reais, idempotência e estados do provedor          |
| Oferta comparável                            | Prêmio total, parcelas, franquias, coberturas, limites e exclusões |
| Validade da oferta                           | Datas e regras do parceiro, sem reutilizar oferta vencida          |
| Proposta, contratação e cancelamento         | Operações e eventos oficialmente suportados                        |
| Erros e recuperação                          | Casos de timeout, resposta pendente, rejeição e reconsulta         |

O adaptador normalizará a resposta para o domínio do Moto Track depois que esse
contrato estiver disponível, preservando os identificadores e a origem de cada
oferta. Testes locais podem conferir transformação, expiração, validação de
entrada e falhas. Eles precisam ser complementados por uma cotação real de
homologação; uma média de apólices anteriores não deve ser apresentada como preço
ofertado por seguradora.

## Validação da preparação

`tests/unit/mercado-livre-oauth.test.ts` usa somente respostas injetadas. Cobre
vetor conhecido PKCE, vínculo de proprietário/estado/callback, expiração,
renovação única, troca de conta indevida e resultados ambíguos. Nenhum teste desta
frente gasta um código, renova token real, cria pedido ou transmite dados pessoais.

As suítes serão executadas na validação serial central. A existência desses
testes não é evidência de aprovação do provedor, OAuth completo em produção,
compra ou cotação. As rotas existentes continuam descrevendo a busca externa e
os registros de seguro de forma compatível com o que realmente está disponível.
