type Contact = { companyName: string; supportEmail: string };
export type LegalSection = { id: string; title: string; paragraphs: string[] };

function englishTerms({ companyName, supportEmail }: Contact): LegalSection[] {
  return [
    {
      id: "aceitacao",
      title: "Acceptance of the terms",
      paragraphs: [
        `By creating an account or using Moto Track, you agree to these Terms of Use and our Privacy Policy. The service is provided by ${companyName}. If you disagree with any provision, do not use the service.`,
      ],
    },
    {
      id: "servico",
      title: "Description of the service",
      paragraphs: [
        "Moto Track is a tool for organizing motorcycle history: fuel purchases, maintenance, documents, expenses, reminders and reports. Some features are available on the free plan and others on the Pro subscription plan.",
        "We may change, add or remove features over time to keep the product stable, secure and sustainable.",
      ],
    },
    {
      id: "conta",
      title: "Accounts and user responsibilities",
      paragraphs: [
        "You are responsible for keeping your credentials confidential and for all activity on your account. Provide accurate information when registering and keep your email address up to date to receive relevant communications.",
        "Notify us immediately if you suspect unauthorized access to your account.",
      ],
    },
    {
      id: "uso-aceitavel",
      title: "Acceptable use",
      paragraphs: [
        "You may not use Moto Track for unlawful purposes, to infringe third-party rights, to attempt to access other accounts' data, to interfere with the operation of the service or to reverse engineer beyond what the law permits.",
        "We reserve the right to suspend or close accounts that violate these terms or present a security risk to the service or other users.",
      ],
    },
    {
      id: "assinatura",
      title: "Pro subscription and billing",
      paragraphs: [
        "The Pro plan is billed on a recurring basis by Dodo Payments, which acts as the Merchant of Record. Prices, billing frequency, applicable taxes and accepted payment methods are shown before you confirm the subscription. The Account area directs you to the billing portal to manage your subscription.",
        "Your first Pro subscription includes a 7-day free trial, with a payment method provided at checkout. At the end of the trial, the selected plan is charged and renews automatically. Cancel before the first charge to avoid paying for the plan. A new subscription after previously subscribing to Pro does not include another free trial.",
        "You can cancel your subscription at any time through the billing portal. Pro access continues until the end of the period already paid for, with no subsequent charge.",
        `On your first purchase, you may withdraw within 7 days and receive a full refund under Article 49 of the Brazilian Consumer Protection Code. To do so, email ${supportEmail}. Outside that period, there is no prorated refund for the current period, except where required by law.`,
      ],
    },
    {
      id: "propriedade",
      title: "Intellectual property",
      paragraphs: [
        "Before uploading documents, photos or other content, make sure you are authorized to store them in the service. Moto Track processes submitted records to provide the requested features, as described in the Privacy Policy. Ownership of third-party trademarks, software and content is subject to the respective rights and licenses.",
      ],
    },
    {
      id: "limitacoes",
      title: "Limitations and liability",
      paragraphs: [
        "Moto Track is provided 'as is', without any guarantee of uninterrupted availability or complete freedom from errors. Records such as odometer readings, fuel consumption, costs and maintenance forecasts are estimates and do not replace the manufacturer's manual or an assessment by a qualified professional.",
        "To the fullest extent permitted by law, we are not liable for indirect damages or lost profits arising from the use of, or inability to use, the service. Nothing in these terms excludes consumer rights that the law does not allow to be limited. Keep your own copies of critical information where possible.",
      ],
    },
    {
      id: "rescisao",
      title: "Account closure",
      paragraphs: [
        "The Account area lets you download a JSON file and submit export or deletion requests. The team fulfills deletion requests within 15 days. Subscription cancellation is managed separately through the billing portal. We may suspend or close accounts for violations of these terms or security risks, subject to the applicable rules.",
      ],
    },
    {
      id: "alteracoes",
      title: "Changes to these terms",
      paragraphs: [
        "We may update these terms to reflect changes in the service or applicable legislation. For significant changes, we will update the date on this page and may notify you through the service or by email.",
      ],
    },
    {
      id: "contato",
      title: "Contact",
      paragraphs: [
        `For questions about these terms, refund requests or other requests, email ${supportEmail}.`,
      ],
    },
  ];
}

function englishPrivacy({
  companyName,
  supportEmail,
}: Contact): LegalSection[] {
  return [
    {
      id: "dados",
      title: "Data we may process",
      paragraphs: [
        "To create and maintain your account, we may process identification and contact information, such as your email address. When you use the product, we also process the records you choose to add: motorcycle details, fuel purchases, maintenance, documents, expenses, reminders and preferences.",
        "We also process technical data needed for security and operation, such as access logs, device and browser information, and error events. Error and performance telemetry sent to Sentry is configured not to include personal data by default.",
      ],
    },
    {
      id: "finalidades",
      title: "How we use the data",
      paragraphs: [
        "We use this data to provide your account, store your records, calculate indicators, send requested reminders, provide support, prevent fraud and improve product stability.",
        "Where necessary, processing takes place to perform the requested service, meet legal obligations, protect rights or on the basis of your consent. You may withdraw optional consent without affecting processing that already has another legal basis.",
      ],
    },
    {
      id: "compartilhamento",
      title: "Sharing",
      paragraphs: [
        "We use the following processors, which process data on our behalf: Neon (authentication and database, in São Paulo, Brazil); Cloudflare (hosting, uploaded files in R2 and email reminders, on a global network); Mistral AI (OCR receipt reading, only when you request it, European Union); and Sentry (error telemetry, United States). Push notifications are delivered by the push service used by your device's browser.",
        "To subscribe to Pro, we share account identification and email with Dodo Payments. It acts as the Merchant of Record and processes payment, billing, fraud prevention and tax obligation data under its own privacy policy. Full card details are provided at Dodo Payments checkout and are not stored by Moto Track.",
        "When processing takes place outside Brazil, the international transfer relies on these providers' contractual safeguards and the performance of the service you purchased, under Article 33 of the LGPD.",
        "We do not sell personal data. Data may be shared when you request it, when needed to perform the service, to meet a legal obligation or to protect the security of people and systems.",
      ],
    },
    {
      id: "seguranca",
      title: "Security and retention",
      paragraphs: [
        "We adopt proportionate technical and organizational measures to reduce the risks of unauthorized access, alteration, loss or disclosure. No internet-connected environment is completely free from risk, so use a strong password and keep your devices secure.",
        "We retain your records while your account is active. When a deletion request is fulfilled, account data is removed from the database immediately, and residual copies — files queued for deletion, backups and technical logs — are deleted within 90 days.",
        "Billing records held by Dodo Payments and data we need to retain to meet a legal or regulatory obligation, such as tax documents, are kept for the period required by applicable law.",
      ],
    },
    {
      id: "direitos",
      title: "Your rights under the LGPD",
      paragraphs: [
        "Under Brazil's General Data Protection Law (LGPD), you may request confirmation of processing, access, correction, anonymization, blocking, deletion, portability, information about sharing and review of automated decisions, subject to legal limits.",
        `The Account area offers a direct JSON file download and lets you submit export or deletion requests, which are handled by the team. For other rights, email ${supportEmail}. We respond within 15 days and may ask you to confirm your identity before fulfilling a request.`,
      ],
    },
    {
      id: "cookies",
      title: "Cookies and third-party services",
      paragraphs: [
        "The application uses the mt_session cookie to keep you signed in for up to seven days and the mt_oauth_challenge cookie for up to ten minutes during social sign-in. Your language preference is stored in a cookie for up to one year; your theme preference is saved in the browser's localStorage. When you use offline mode, the service worker stores the offline page and manifest in the Cache API, and fuel submissions awaiting synchronization remain in IndexedDB until submission is complete or local data is removed.",
        "The browser may also store cookies or data from the authentication, billing, telemetry and notification services you use. You can limit storage through your browser, but this may prevent parts of Moto Track from working correctly.",
      ],
    },
    {
      id: "contato",
      title: "Contact and updates",
      paragraphs: [
        `The data controller is ${companyName}. The contact channel for the person in charge of personal data processing is ${supportEmail}, the same address used for support.`,
        "When this policy changes significantly, the date on this page will be updated and we may notify you through the service or by email. Do not send personal data in public issues or notices.",
      ],
    },
  ];
}

export function termsSections(
  locale: string,
  contact: Contact,
): LegalSection[] {
  return locale === "en" ? englishTerms(contact) : portugueseTerms(contact);
}

export function privacySections(
  locale: string,
  contact: Contact,
): LegalSection[] {
  return locale === "en" ? englishPrivacy(contact) : portuguesePrivacy(contact);
}

export function legalCopy(locale: string) {
  return locale === "en"
    ? {
        print: "Print",
        contents: "In this document",
        email: "Send email",
        updated: "Last updated: September 29, 2026",
        terms: {
          title: "Terms of Use",
          description:
            "Moto Track Terms of Use: subscriptions, responsibilities and service limitations.",
          eyebrow: "Terms and conditions",
          headline: "Clear rules,",
          accent: "no fine print.",
          introduction:
            "How Moto Track works, how the Pro plan works and what to expect from the service.",
          navigation: "Terms sections",
          refund:
            "Withdraw within 7 days of your first purchase for a full refund.",
          cancel:
            "Cancel your Pro subscription whenever you want through the billing portal.",
          supportHeading: "Questions about the terms",
          supportText: (email: string) =>
            `Contact support at ${email}. Do not include personal data in a public issue.`,
        },
        privacy: {
          title: "Privacy Policy",
          description: "Moto Track Privacy Policy and LGPD information.",
          eyebrow: "Privacy and the LGPD",
          headline: "Your data,",
          accent: "under your control.",
          introduction:
            "How Moto Track processes data to keep your garage organized, secure and accessible.",
          navigation: "Privacy sections",
          export: "Request an export or deletion in the Account area.",
          processing: "Processing is limited to what the service needs.",
          supportHeading: "Privacy requests",
          manage: "Manage account data",
          supportText: (email: string) =>
            `Download a JSON copy or submit a deletion request in the Account area. For other requests, email ${email} — we respond within 15 days.`,
        },
        lgpd: {
          eyebrow: "Your rights",
          introduction:
            "Data export and deletion requests remain centralized in",
          account: "Billing > Account",
          ending: "within the product itself.",
          privacy: "View Privacy Policy",
        },
        cancellation: {
          title: "Cancellation",
          eyebrow: "No hidden catches",
          introduction:
            "Pro subscriptions are managed through the Dodo Payments portal — cancel whenever you want, without red tape or needing to speak to anyone.",
          conditions:
            "Cancellation prevents the next renewal. Your Pro access continues until the end of the current period. During the 7-day free trial, cancel before the first charge to avoid paying for the plan.",
          portal: "Open billing portal",
        },
      }
    : {
        print: "Imprimir",
        contents: "Neste documento",
        email: "Enviar e-mail",
        updated: "Última atualização: 29 de setembro de 2026",
        terms: {
          title: "Termos de Uso",
          description:
            "Termos de Uso do Moto Track: assinatura, responsabilidades e limitações do serviço.",
          eyebrow: "Termos e condições",
          headline: "Regras claras,",
          accent: "sem letra miúda.",
          introduction:
            "Como funciona o uso do Moto Track, o plano Pro e o que esperar do serviço.",
          navigation: "Seções dos termos",
          refund:
            "Desistência com reembolso integral em até 7 dias na primeira contratação.",
          cancel:
            "Cancele a assinatura Pro quando quiser, pelo Portal de cobrança.",
          supportHeading: "Dúvidas sobre os termos",
          supportText: (email: string) =>
            `Fale com o suporte em ${email}. Não inclua dados pessoais em uma issue aberta.`,
        },
        privacy: {
          title: "Política de Privacidade",
          description:
            "Política de Privacidade e informações LGPD do Moto Track.",
          eyebrow: "Privacidade e LGPD",
          headline: "Seus dados,",
          accent: "no seu controle.",
          introduction:
            "Como o Moto Track trata dados para manter sua garagem organizada, segura e acessível.",
          navigation: "Seções de privacidade",
          export: "Solicite exportação ou exclusão pela área Conta.",
          processing: "Tratamento limitado ao que é necessário para o serviço.",
          supportHeading: "Solicitações de privacidade",
          manage: "Gerenciar dados da conta",
          supportText: (email: string) =>
            `Baixe uma cópia JSON ou registre um pedido de exclusão na área Conta. Para outros pedidos, escreva para ${email} — respondemos em até 15 dias.`,
        },
        lgpd: {
          eyebrow: "Seus direitos",
          introduction:
            "Solicitações de exportação e exclusão de dados permanecem centralizadas na área",
          account: "Billing > Conta",
          ending: "dentro do próprio produto.",
          privacy: "Ver Política de Privacidade",
        },
        cancellation: {
          title: "Cancelamento",
          eyebrow: "Sem pegadinha",
          introduction:
            "Assinaturas Pro são gerenciadas pelo portal da Dodo Payments — cancele quando quiser, sem burocracia e sem precisar falar com ninguém.",
          conditions:
            "O cancelamento impede a próxima renovação. Seu acesso Pro continua até o fim do período atual. Durante o teste grátis de 7 dias, cancele antes da primeira cobrança para não pagar pelo plano.",
          portal: "Abrir portal de cobrança",
        },
      };
}

// These translations preserve the published Portuguese text and its revision
// date. Product or policy changes require a separate review of both languages.

function portugueseTerms({
  companyName,
  supportEmail,
}: Contact): LegalSection[] {
  return [
    {
      id: "aceitacao",
      title: "Aceitação dos termos",
      paragraphs: [
        `Ao criar uma conta ou usar o Moto Track, você concorda com estes Termos de Uso e com a nossa Política de Privacidade. O serviço é oferecido por ${companyName}. Se você não concordar com algum ponto, não utilize o serviço.`,
      ],
    },
    {
      id: "servico",
      title: "Descrição do serviço",
      paragraphs: [
        "O Moto Track é uma ferramenta para organizar o histórico de motocicletas: abastecimentos, manutenções, documentos, despesas, lembretes e relatórios. Parte dos recursos está disponível no plano gratuito e parte no plano Pro, mediante assinatura.",
        "Podemos alterar, adicionar ou remover recursos ao longo do tempo para manter o produto estável, seguro e sustentável.",
      ],
    },
    {
      id: "conta",
      title: "Contas e responsabilidades do usuário",
      paragraphs: [
        "Você é responsável por manter suas credenciais em sigilo e por todas as atividades realizadas na sua conta. Informe dados verdadeiros ao se cadastrar e mantenha seu e-mail atualizado para receber comunicações relevantes.",
        "Avise-nos imediatamente se suspeitar de acesso não autorizado à sua conta.",
      ],
    },
    {
      id: "uso-aceitavel",
      title: "Uso aceitável",
      paragraphs: [
        "Não é permitido usar o Moto Track para fins ilícitos, para violar direitos de terceiros, para tentar acessar dados de outras contas, para interferir na operação do serviço ou para realizar engenharia reversa além do permitido em lei.",
        "Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos ou que representem risco de segurança para o serviço ou para outros usuários.",
      ],
    },
    {
      id: "assinatura",
      title: "Assinatura Pro e cobrança",
      paragraphs: [
        "O plano Pro é cobrado de forma recorrente pela Dodo Payments, que atua como comerciante responsável pela venda (Merchant of Record). Os valores, a periodicidade, os tributos aplicáveis e os métodos de pagamento aceitos são exibidos antes da confirmação da assinatura. A área Conta direciona ao Portal de cobrança para gerenciar a assinatura.",
        "A primeira assinatura Pro inclui um teste grátis de 7 dias com forma de pagamento informada no checkout. Ao fim do teste, o plano escolhido é cobrado e renovado automaticamente. Cancele antes da primeira cobrança para não pagar pelo plano. Uma nova assinatura após já ter contratado Pro não concede outro teste grátis.",
        "Você pode cancelar a assinatura a qualquer momento pelo Portal de cobrança. O acesso Pro continua até o fim do período já pago e não há cobrança seguinte.",
        `Na primeira contratação, você pode desistir em até 7 dias e receber o reembolso integral, conforme o art. 49 do Código de Defesa do Consumidor; para isso, escreva para ${supportEmail}. Fora desse prazo, não há reembolso proporcional do período em curso, salvo quando exigido por lei.`,
      ],
    },
    {
      id: "propriedade",
      title: "Propriedade intelectual",
      paragraphs: [
        "Antes de enviar documentos, fotos ou outros conteúdos, verifique se você tem autorização para armazená-los no serviço. O Moto Track processa registros enviados para fornecer os recursos solicitados, conforme a Política de Privacidade. A titularidade de marcas, software e conteúdos de terceiros depende dos respectivos direitos e licenças.",
      ],
    },
    {
      id: "limitacoes",
      title: "Limitações e responsabilidade",
      paragraphs: [
        "O Moto Track é fornecido 'como está', sem garantia de disponibilidade ininterrupta ou de ausência total de falhas. Registros como odômetro, consumo, custos e previsões de manutenção são estimativas e não substituem o manual do fabricante ou a avaliação de um profissional qualificado.",
        "Na máxima medida permitida por lei, não respondemos por danos indiretos ou lucros cessantes decorrentes do uso ou da impossibilidade de uso do serviço. Nada nestes termos afasta direitos do consumidor que a legislação não permite limitar. Mantenha cópias próprias de informações críticas quando possível.",
      ],
    },
    {
      id: "rescisao",
      title: "Encerramento da conta",
      paragraphs: [
        "A área Conta permite baixar um arquivo JSON e registrar solicitações de exportação ou exclusão. O pedido de exclusão é atendido pela equipe em até 15 dias. O cancelamento de uma assinatura é gerenciado separadamente pelo Portal de cobrança. Podemos suspender ou encerrar contas em caso de violação destes termos ou risco de segurança, observadas as regras aplicáveis.",
      ],
    },
    {
      id: "alteracoes",
      title: "Alterações destes termos",
      paragraphs: [
        "Podemos atualizar estes termos para refletir mudanças no serviço ou na legislação aplicável. Quando a alteração for relevante, atualizaremos a data nesta página e poderemos avisar pelo serviço ou por e-mail.",
      ],
    },
    {
      id: "contato",
      title: "Contato",
      paragraphs: [
        `Para dúvidas sobre estes termos, pedidos de reembolso ou outras solicitações, escreva para ${supportEmail}.`,
      ],
    },
  ];
}

function portuguesePrivacy({
  companyName,
  supportEmail,
}: Contact): LegalSection[] {
  return [
    {
      id: "dados",
      title: "Dados que podemos tratar",
      paragraphs: [
        "Para criar e manter sua conta, podemos tratar dados de identificação e contato, como e-mail. Quando você usa o produto, também tratamos os registros que você escolhe adicionar: dados da moto, abastecimentos, manutenções, documentos, despesas, lembretes e preferências.",
        "Também tratamos dados técnicos necessários para segurança e funcionamento, como registros de acesso, dispositivo, navegador e eventos de erro. A telemetria de erro e desempenho enviada ao Sentry é configurada para não incluir dados pessoais por padrão.",
      ],
    },
    {
      id: "finalidades",
      title: "Para que usamos os dados",
      paragraphs: [
        "Usamos esses dados para fornecer a conta, guardar seus registros, calcular indicadores, enviar lembretes solicitados, oferecer suporte, prevenir fraude e melhorar a estabilidade do produto.",
        "Quando necessário, o tratamento ocorre para executar o serviço solicitado, cumprir obrigações legais, proteger direitos ou com base no seu consentimento. Você pode retirar consentimentos que forem opcionais, sem afetar tratamentos que já tenham outra base legal.",
      ],
    },
    {
      id: "compartilhamento",
      title: "Compartilhamento",
      paragraphs: [
        "Usamos os seguintes operadores, que tratam dados em nosso nome: Neon (autenticação e banco de dados, em São Paulo, Brasil); Cloudflare (hospedagem, arquivos enviados no R2 e envio de lembretes por e-mail, em rede global); Mistral AI (leitura de comprovantes por OCR, somente quando você solicita, União Europeia); e Sentry (telemetria de erros, Estados Unidos). Notificações push são entregues pelo serviço push do navegador do seu dispositivo.",
        "Para contratar Pro, compartilhamos identificação da conta e e-mail com a Dodo Payments. Ela atua como comerciante responsável pela venda (Merchant of Record) e trata dados de pagamento, faturamento, prevenção a fraudes e obrigações tributárias conforme sua própria política de privacidade. Dados completos do cartão são informados no checkout da Dodo Payments e não são armazenados pelo Moto Track.",
        "Quando o tratamento ocorre fora do Brasil, a transferência internacional se apoia nas garantias contratuais desses fornecedores e na execução do serviço que você contratou, nos termos do art. 33 da LGPD.",
        "Não vendemos dados pessoais. Dados podem ser compartilhados quando você solicitar, quando forem necessários para executar o serviço, para cumprir obrigação legal ou para proteger a segurança de pessoas e sistemas.",
      ],
    },
    {
      id: "seguranca",
      title: "Segurança e retenção",
      paragraphs: [
        "Adotamos medidas técnicas e organizacionais proporcionais para reduzir riscos de acesso indevido, alteração, perda ou divulgação. Nenhum ambiente conectado à internet é completamente imune a riscos; por isso, use uma senha forte e mantenha seus dispositivos protegidos.",
        "Mantemos seus registros enquanto sua conta estiver ativa. Quando uma solicitação de exclusão é atendida, os dados da conta são removidos do banco de dados imediatamente, e cópias residuais — arquivos em fila de remoção, cópias de segurança e registros técnicos — são eliminadas em até 90 dias.",
        "Registros de cobrança mantidos pela Dodo Payments e dados que precisamos guardar para cumprir obrigação legal ou regulatória, como documentos fiscais, são conservados pelo prazo exigido pela lei aplicável.",
      ],
    },
    {
      id: "direitos",
      title: "Seus direitos pela LGPD",
      paragraphs: [
        "Nos termos da Lei Geral de Proteção de Dados, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, observados os limites legais.",
        `A área Conta oferece download direto de um arquivo JSON e permite registrar pedidos de exportação ou exclusão, que são atendidos pela equipe. Para os demais direitos, escreva para ${supportEmail}. Respondemos em até 15 dias e podemos pedir a confirmação da sua identidade antes de atender.`,
      ],
    },
    {
      id: "cookies",
      title: "Cookies e serviços de terceiros",
      paragraphs: [
        "A aplicação usa o cookie mt_session para manter a sessão por até sete dias e o cookie mt_oauth_challenge por até dez minutos durante o login social. A preferência de idioma fica em um cookie por até um ano; a preferência de tema é salva no localStorage do navegador. Ao usar o modo offline, o service worker armazena a página offline e o manifesto no Cache API, e envios de abastecimento aguardando sincronização ficam no IndexedDB até o envio ser concluído ou os dados locais serem removidos.",
        "O navegador também pode armazenar cookies ou dados próprios dos serviços de autenticação, cobrança, telemetria e notificações que você usar. Você pode limitar o armazenamento pelo navegador, mas isso pode impedir partes do Moto Track de funcionar corretamente.",
      ],
    },
    {
      id: "contato",
      title: "Contato e atualizações",
      paragraphs: [
        `O controlador dos dados é ${companyName}. O canal do encarregado pelo tratamento de dados pessoais é o e-mail ${supportEmail}, o mesmo do suporte.`,
        "Quando esta política mudar de forma relevante, a data nesta página será atualizada e poderemos avisar pelo serviço ou por e-mail. Não envie dados pessoais em issues ou avisos públicos.",
      ],
    },
  ];
}
