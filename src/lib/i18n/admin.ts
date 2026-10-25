import type { Locale } from "$lib/i18n";
import { actionMessage } from "$lib/i18n/action-messages";

const pt = {
  pageTitle: "Admin · Moto Track",
  admin: "Admin",
  consoleTitle: "Console operacional",
  description:
    "Configurações, blog, templates, assinaturas e solicitações de dados.",
  operationComplete: "Operação concluída.",
  operationFailed: "Não foi possível concluir.",
  users: "Usuários",
  articles: "Artigos",
  billingEvents: "Eventos Dodo Payments",
  dataRequestsMetric: "Dados",
  workerTitle: "Lembretes e limpeza de arquivos",
  workerDescription:
    "Resumo operacional sem dados de conta ou identificadores de arquivos.",
  workerUnavailable:
    "Histórico operacional indisponível. Confirme as migrações e a conexão do Worker.",
  r2Queue: "Fila de exclusão no R2",
  queued: "Na fila",
  readyToRetry: "Prontos para tentar",
  highestAttempts: "Mais tentativas",
  oldestAge: "Idade do item mais antigo",
  latestRun: "Execução mais recente",
  scheduled: "Agendada",
  manual: "Manual",
  running: "Em execução",
  succeeded: "Concluída",
  failed: "Falhou",
  failures: "Falhas",
  failureCount: "falhas",
  runSummary:
    "Lembretes: {emailed} enviados por email, {pushed} por push; exclusões R2: {deleted}/{attempted} concluídas.",
  noRuns: "Nenhuma execução registrada.",
  cronTitle: "Execução cron agendada",
  referenceTime: "Horário de referência: 08:00 UTC",
  lastRecorded: "Último registro:",
  noCronRuns: "Nenhuma execução cron registrada.",
  slotRecorded: "Há um registro no horário de referência.",
  slotMissing: "O horário de referência ainda não aparece no histórico.",
  slotMethod:
    "Comparação direta, sem janela de tolerância configurada; confirme atrasos e falhas nos logs do Cloudflare.",
  recentRuns: "Últimas execuções",
  started: "Início",
  origin: "Origem",
  status: "Estado",
  due: "Vencimentos",
  deletions: "Exclusões",
  workerRunbook:
    "Esta tela não envia alertas; revise os dados e os logs do Worker conforme o runbook operacional.",
  siteSettings: "Configurações do site",
  company: "Nome da empresa",
  supportEmail: "Email de suporte",
  supportEmailPlaceholder: "Email suporte",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  city: "Cidade",
  state: "UF",
  dpo: "DPO",
  dpoEmail: "Email DPO",
  save: "Salvar",
  newArticle: "Novo artigo",
  title: "Título",
  slug: "Slug (opcional)",
  slugPlaceholder: "slug opcional",
  summary: "Resumo",
  body: "Conteúdo",
  published: "Publicado",
  publish: "Publicar",
  motorcycleTemplate: "Template de moto",
  brand: "Marca",
  model: "Modelo",
  firstYear: "Ano inicial",
  lastYear: "Ano final",
  engine: "Cilindrada",
  country: "País",
  variant: "Versão",
  variantPlaceholder: "Versão (vazio = Linha)",
  templateHidden:
    "O template nasce invisível no catálogo; registre a fonte oficial e a tabela de manutenção antes de torná-lo visível.",
  createTemplate: "Criar template",
  dataRequests: "Solicitações de dados",
  markFulfilled: "Marcar cumprida",
  noRequests: "Sem solicitações abertas.",
  sourcesTitle: "Fontes do catálogo por verificação",
  sourceMethod:
    "Verificação mais antiga primeiro. Um modelo exato com 0 itens não gera agenda; um modelo Linha nunca gera — transcreva a tabela antes de torná-lo visível.",
  years: "Anos",
  document: "Documento",
  verifiedAt: "Verificado em",
  items: "Itens",
  exact: "Exata",
  noSources: "Nenhuma fonte registrada.",
  requestExport: "Exportação",
  requestDeletion: "Exclusão",
  requestOpen: "Aberta",
  requestFulfilled: "Cumprida",
  requestRejected: "Rejeitada",
  requestClosed: "Encerrada",
  failureReminders: "Falha na tarefa de lembretes",
  failureObjectTasks: "Falha na tarefa de exclusão de arquivos",
  failureEmail: "Falha no envio de email",
  failurePush: "Falha no envio de push",
  failureObjectDeletion: "Falha na exclusão de arquivo",
  failureWorker: "Falha na execução do Worker",
  staffOnly: "Acesso restrito à equipe.",
  requestNotFound: "Solicitação não encontrada.",
  requestProcessed: "Solicitação já processada.",
  requestChanged: "A solicitação deixou de estar aberta antes da exclusão.",
  previousBilling:
    "Confirme o encerramento da cobrança anterior antes de excluir esta conta.",
  billingEndedLocalFailed:
    "A cobrança foi encerrada, mas a exclusão local falhou. A solicitação continua aberta e pode ser tentada novamente.",
  deletionBillingFailed:
    "Não foi possível concluir a exclusão e encerrar a cobrança. Os dados locais foram preservados e a solicitação continua aberta.",
  brandModelRequired: "Informe marca e modelo.",
  firstYearInvalid: "Ano inicial inválido.",
  lastYearInvalid: "Ano final inválido.",
} as const;

const en: Record<keyof typeof pt, string> = {
  pageTitle: "Admin · Moto Track",
  admin: "Admin",
  consoleTitle: "Operations console",
  description:
    "Settings, blog, motorcycle templates, subscriptions and data requests.",
  operationComplete: "Operation completed.",
  operationFailed: "The operation could not be completed.",
  users: "Users",
  articles: "Articles",
  billingEvents: "Dodo Payments events",
  dataRequestsMetric: "Data requests",
  workerTitle: "Reminders and file cleanup",
  workerDescription:
    "Operational summary without account details or file identifiers.",
  workerUnavailable:
    "Operational history is unavailable. Check the migrations and Worker connection.",
  r2Queue: "R2 deletion queue",
  queued: "Queued",
  readyToRetry: "Ready to retry",
  highestAttempts: "Highest attempt count",
  oldestAge: "Oldest item age",
  latestRun: "Latest run",
  scheduled: "Scheduled",
  manual: "Manual",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  failures: "Failures",
  failureCount: "failures",
  runSummary:
    "Reminders: {emailed} emailed, {pushed} pushed; R2 deletions: {deleted}/{attempted} completed.",
  noRuns: "No runs recorded.",
  cronTitle: "Scheduled cron run",
  referenceTime: "Reference time: 08:00 UTC",
  lastRecorded: "Last recorded run:",
  noCronRuns: "No cron runs recorded.",
  slotRecorded: "A run is recorded for the reference time.",
  slotMissing: "The reference time does not appear in the history yet.",
  slotMethod:
    "Direct comparison with no configured grace window; check Cloudflare logs for delays and failures.",
  recentRuns: "Recent runs",
  started: "Started",
  origin: "Source",
  status: "Status",
  due: "Due reminders",
  deletions: "Deletions",
  workerRunbook:
    "This page does not send alerts. Review the data and Worker logs using the operations runbook.",
  siteSettings: "Site settings",
  company: "Company name",
  supportEmail: "Support email",
  supportEmailPlaceholder: "Support email",
  phone: "Phone",
  whatsapp: "WhatsApp",
  city: "City",
  state: "State",
  dpo: "DPO",
  dpoEmail: "DPO email",
  save: "Save",
  newArticle: "New article",
  title: "Title",
  slug: "Slug (optional)",
  slugPlaceholder: "optional slug",
  summary: "Summary",
  body: "Content",
  published: "Published",
  publish: "Publish",
  motorcycleTemplate: "Motorcycle template",
  brand: "Brand",
  model: "Model",
  firstYear: "First model year",
  lastYear: "Last model year",
  engine: "Engine capacity",
  country: "Country",
  variant: "Variant",
  variantPlaceholder: "Variant (blank = sales line)",
  templateHidden:
    "The template starts hidden in the catalog. Add the official source and maintenance table before making it visible.",
  createTemplate: "Create template",
  dataRequests: "Data requests",
  markFulfilled: "Mark fulfilled",
  noRequests: "No open requests.",
  sourcesTitle: "Catalog sources by verification date",
  sourceMethod:
    "Oldest verification first. An exact model with no items creates no schedule; a sales-line model never creates one. Transcribe the table before making it visible.",
  years: "Years",
  document: "Document",
  verifiedAt: "Verified on",
  items: "Items",
  exact: "Exact",
  noSources: "No sources recorded.",
  requestExport: "Data export",
  requestDeletion: "Account deletion",
  requestOpen: "Open",
  requestFulfilled: "Fulfilled",
  requestRejected: "Rejected",
  requestClosed: "Closed",
  failureReminders: "Reminder task failed",
  failureObjectTasks: "Object deletion task failed",
  failureEmail: "Email delivery failed",
  failurePush: "Push delivery failed",
  failureObjectDeletion: "Object deletion failed",
  failureWorker: "Worker execution failed",
  staffOnly: "Staff access required.",
  requestNotFound: "Request not found.",
  requestProcessed: "Request already processed.",
  requestChanged: "The request was no longer open when deletion was attempted.",
  previousBilling:
    "Confirm that previous billing has ended before deleting this account.",
  billingEndedLocalFailed:
    "Billing ended, but local deletion failed. The request remains open and can be retried.",
  deletionBillingFailed:
    "Account deletion and billing termination could not be completed. Local data was preserved and the request remains open.",
  brandModelRequired: "Enter a brand and model.",
  firstYearInvalid: "Invalid first model year.",
  lastYearInvalid: "Invalid last model year.",
};

export type AdminMessageKey = keyof typeof pt;

export function adminMessages(locale: Locale) {
  return locale === "en" ? en : pt;
}

export function adminText(
  locale: Locale,
  key: AdminMessageKey,
  params: Record<string, string | number>,
) {
  return adminMessages(locale)[key].replace(
    /\{(\w+)\}/g,
    (match, name: string) => (name in params ? String(params[name]) : match),
  );
}

type AdminValueKind = "origin" | "status" | "request" | "failure";

const enumKeys: Record<AdminValueKind, Record<string, AdminMessageKey>> = {
  origin: { scheduled: "scheduled", manual: "manual" },
  status: {
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    open: "requestOpen",
    fulfilled: "requestFulfilled",
    rejected: "requestRejected",
    closed: "requestClosed",
  },
  request: { export: "requestExport", deletion: "requestDeletion" },
  failure: {
    reminders_task_failed: "failureReminders",
    object_deletions_task_failed: "failureObjectTasks",
    email_delivery_failed: "failureEmail",
    push_delivery_failed: "failurePush",
    object_deletion_failed: "failureObjectDeletion",
    worker_execution_failed: "failureWorker",
  },
};

/** Translate known protocol labels only; unknown/source-authored values stay intact. */
export function adminValue(
  locale: Locale,
  kind: keyof typeof enumKeys,
  value: unknown,
) {
  const original = String(value ?? "");
  const values = enumKeys[kind];
  const key =
    values && Object.hasOwn(values, original) ? values[original] : undefined;
  if (!key) return original;
  const label = adminMessages(locale)[key];
  return kind === "failure" ? `${label} (${original})` : label;
}

const actionKeys: AdminMessageKey[] = [
  "requestNotFound",
  "requestProcessed",
  "requestChanged",
  "previousBilling",
  "brandModelRequired",
  "firstYearInvalid",
  "lastYearInvalid",
];

/** Presentation only: never rewrite persisted request notes or provider details. */
export function adminActionMessage(locale: Locale, message: string): string {
  if (message === "Staff only.") return adminMessages(locale).staffOnly;
  const known = actionKeys.find((key) => pt[key] === message);
  if (known) return adminMessages(locale)[known];
  for (const key of [
    "billingEndedLocalFailed",
    "deletionBillingFailed",
  ] as const) {
    if (message === pt[key]) return adminMessages(locale)[key];
    if (message.startsWith(`${pt[key]} `)) {
      return `${adminMessages(locale)[key]} ${adminActionMessage(locale, message.slice(pt[key].length + 1))}`;
    }
  }
  return actionMessage(locale, message);
}
