import type { Locale } from "$lib/i18n";

export const APP_ENGLISH_COPY: Record<string, string> = {
  Moto: "Motorcycle",
  Marca: "Brand",
  Modelo: "Model",
  Ano: "Year",
  Odômetro: "Odometer",
  "Donos anteriores": "Previous owners",
  "Perfil de uso": "Riding profile",
  Combustível: "Fuel",
  Manutenção: "Maintenance",
  Pneus: "Tires",
  Taxas: "Fees",
  Despesas: "Expenses",
  Trabalho: "Work",
  Documentos: "Documents",
  Seguradora: "Insurer",
  "Ex: Porto Seguro": "e.g. Porto Seguro",
  Apólice: "Policy",
  "Número da apólice": "Policy number",
  "Início da cobertura": "Coverage starts",
  "Fim da cobertura": "Coverage ends",
  "Prêmio (R$)": "Premium (BRL)",
  "Avisar antes (dias)": "Advance notice (days)",
  Seguro: "Insurance policy",
  "Data do sinistro": "Claim date",
  Descrição: "Description",
  "Ex: Queda lateral, reparo carenagem": "e.g. Side fall, fairing repair",
  "Valor (R$)": "Amount (BRL)",
  Aberto: "Open",
  Resolvido: "Settled",
  "Limpar filtros": "Clear filters",
  "Reserva de manutenção por km": "Maintenance reserve per km",
  "Depreciação por km": "Depreciation per km",
  "Custo fixo diário": "Fixed daily cost",
  "Salvar custos": "Save costs",
  "Linha do tempo e dossiê de venda": "Timeline and sale report",
  "Histórico comprovado de manutenção e eventos da sua moto para valorizar a venda":
    "Recorded motorcycle maintenance and events to support a sale",
  "Link público gerado com sucesso!": "Public link created successfully!",
  "Abrir dossiê": "Open report",
  "Escolha uma moto": "Choose a motorcycle",
  "Validade do link (dias)": "Link lifetime (days)",
  "Após este prazo, o link expirará automaticamente. Você pode revogá-lo a qualquer momento.":
    "The link expires automatically after this period. You can revoke it at any time.",
  "Criar link seguro": "Create secure link",
  "Dossiês públicos ativos": "Active public reports",
  "acessos · expira": "views · expires",
  Revogar: "Revoke",
  Revogado: "Revoked",
  "Eventos da linha do tempo": "Timeline events",
  "eventos encontrados": "events found",
  Fonte: "Source",
  "Todas as fontes": "All sources",
  Abastecimento: "Fill-up",
  "Data inicial": "Start date",
  "Data final": "End date",
  Limpar: "Clear",
  "Aplicar filtros": "Apply filters",
  "Sem eventos para este filtro.": "No events match these filters.",
  "Tente ajustar as datas ou a fonte selecionada.":
    "Try changing the dates or selected source.",
  "Baixe cópias completas em formato CSV dos seus dados para backup ou análise em planilhas.":
    "Download complete CSV copies of your data for backup or spreadsheet analysis.",
  Abastecimentos: "Fill-ups",
  Manutenções: "Maintenance",
  "Revogar este link público? Quem tiver o link perderá o acesso.":
    "Revoke this public link? Anyone with the link will lose access.",
  "Dossiê de venda ·": "Sale report ·",
  "Dossiê de venda": "Sale report",
  "Moto Track · dossiê de venda": "Moto Track · sale report",
  "Salvar como PDF": "Save as PDF",
  "Histórico da moto": "Motorcycle history",
  "Histórico registrado no Moto Track e compartilhado pelo proprietário.":
    "History recorded in Moto Track and shared by the owner.",
  "Custo registrado": "Recorded cost",
  "Somatório de tudo que o proprietário lançou para esta moto.":
    "Total of the costs the owner recorded for this motorcycle.",
  "Total investido": "Total recorded spending",
  "Serviços registrados": "Recorded services",
  "Histórico de manutenção": "Maintenance history",
  "Exibindo os": "Showing the",
  "serviços mais recentes de": "most recent services out of",
  Data: "Date",
  Serviço: "Service",
  Custo: "Cost",
  "Nenhuma manutenção registrada para esta moto.":
    "No maintenance recorded for this motorcycle.",
  "Link válido até": "Link valid until",
  ". O proprietário pode revogá-lo a qualquer momento.":
    ". The owner can revoke it at any time.",
  "Criar meu histórico no Moto Track": "Start my history in Moto Track",
};

export function appCopy(locale: Locale, source: string) {
  if (locale !== "en") return source;
  const normalized = source.replace(/\s+/g, " ").trim();
  const translation = Object.hasOwn(APP_ENGLISH_COPY, normalized)
    ? APP_ENGLISH_COPY[normalized]
    : undefined;
  if (!translation) return source;
  return `${/^\s/.test(source) ? " " : ""}${translation}${/\s$/.test(source) ? " " : ""}`;
}
