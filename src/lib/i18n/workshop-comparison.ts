import type { Locale } from "$lib/i18n";

const pt = {
  title: "Comparativo de oficinas",
  subtitle:
    "Compare a mão de obra do mesmo serviço na mesma cidade com valores compartilhados voluntariamente.",
  back: "Manutenção",
  privacy:
    "Cada oficina só aparece com pelo menos cinco contas diferentes para o mesmo serviço, cidade e estado. Seus registros não são compartilhados automaticamente.",
  method:
    "Cada conta tem o mesmo peso: primeiro calculamos sua média por oficina. Os valores são históricos, sem ajuste de inflação, e não substituem um orçamento. Nomes de serviços diferentes não são combinados.",
  searchTitle: "Comparar preços de mão de obra",
  city: "Cidade da oficina",
  state: "Estado (UF)",
  chooseState: "Selecione o estado",
  service: "Serviço",
  serviceHelp:
    "Use o nome exato do serviço registrado. Acentos e maiúsculas são normalizados.",
  search: "Comparar oficinas",
  start: "Informe o serviço, a cidade e o estado para comparar.",
  invalidSearch:
    "Informe um serviço, uma cidade e um estado válidos para comparar.",
  insufficient:
    "Ainda não há oficinas com cinco contas distintas nessa comparação. Os preços permanecem ocultos até atingir esse mínimo.",
  workshop: "Oficina",
  average: "Média de mão de obra",
  accounts: "Contas participantes",
  participateTitle: "Compartilhar ou atualizar um valor",
  participateHelp:
    "Escolha um registro seu e confirme somente a mão de obra paga, sem peças. Oficina, serviço, data e custo total vêm do registro original. Você pode atualizar ou retirar sua contribuição a qualquer momento.",
  record: "Registro de manutenção",
  chooseRecord: "Selecione um registro",
  noRecords:
    "Registre uma manutenção concluída em BRL, com oficina, serviço específico, data e custo positivo para participar.",
  labor: "Mão de obra paga (R$)",
  laborHelp:
    "Informe apenas o valor confirmado de mão de obra, até o total registrado e no máximo R$ 10.000,00.",
  total: "Total registrado",
  consent:
    "Confirmo o valor e a região e autorizo seu uso neste comparativo agregado. Entendo que posso retirar minha contribuição.",
  save: "Confirmar compartilhamento",
  saved:
    "Contribuição salva. Ela só entra no comparativo enquanto o registro original continuar válido.",
  withdrawn: "Contribuição retirada do comparativo.",
  ownTitle: "Suas contribuições",
  noContributions: "Você ainda não compartilhou valores de mão de obra.",
  edit: "Revisar ou atualizar",
  withdraw: "Retirar contribuição",
  active: "Participação ativa",
  changed:
    "Registro alterado: fora do comparativo até revisar e confirmar novamente.",
  loadError:
    "Não foi possível carregar o comparativo. Tente novamente em instantes.",
  saveError:
    "Não foi possível salvar a contribuição. Tente novamente em instantes.",
  withdrawError:
    "Não foi possível retirar a contribuição. Tente novamente em instantes.",
  consentRequired: "Confirme o compartilhamento voluntário para continuar.",
  invalidRecord: "Registro de manutenção não encontrado na sua conta.",
  ineligibleRecord:
    "Use um registro concluído em BRL com oficina, serviço específico, data válida e custo positivo.",
  invalidLabor:
    "Informe uma mão de obra maior que zero, com até duas casas decimais e no máximo R$ 10.000,00.",
  laborExceedsTotal:
    "A mão de obra não pode ultrapassar o custo total do registro.",
  invalidRegion: "Informe a cidade da oficina e uma UF brasileira válida.",
};

const en: Record<keyof typeof pt, string> = {
  title: "Workshop comparison",
  subtitle:
    "Compare labor prices for the same service in the same city using voluntarily shared amounts.",
  back: "Maintenance",
  privacy:
    "A workshop only appears after at least five different accounts share the same service, city and state. Your records are never shared automatically.",
  method:
    "Every account has equal weight: we first average its records per workshop. Historical amounts are not adjusted for inflation and do not replace a quote. Different service names are not combined.",
  searchTitle: "Compare labor prices",
  city: "Workshop city",
  state: "Brazilian state (UF)",
  chooseState: "Select a state",
  service: "Service",
  serviceHelp:
    "Use the service name from the record. Accents and capitalization are normalized.",
  search: "Compare workshops",
  start: "Enter a service, city and state to compare.",
  invalidSearch: "Enter a valid service, city and state to compare.",
  insufficient:
    "No workshop has contributions from five distinct accounts for this comparison yet. Prices stay hidden until that minimum is reached.",
  workshop: "Workshop",
  average: "Average labor price",
  accounts: "Participating accounts",
  participateTitle: "Share or update an amount",
  participateHelp:
    "Choose your own record and confirm only the labor you paid, excluding parts. Workshop, service, date and total come from the original record. You can update or withdraw your contribution at any time.",
  record: "Maintenance record",
  chooseRecord: "Select a record",
  noRecords:
    "Add completed maintenance in BRL with a workshop, specific service, date and positive cost to participate.",
  labor: "Labor paid (R$)",
  laborHelp:
    "Enter only confirmed labor, no more than the record total or R$ 10,000.00.",
  total: "Recorded total",
  consent:
    "I confirm the amount and region and consent to their use in this aggregate comparison. I understand I can withdraw my contribution.",
  save: "Confirm sharing",
  saved:
    "Contribution saved. It only counts while the original record remains valid.",
  withdrawn: "Contribution withdrawn from the comparison.",
  ownTitle: "Your contributions",
  noContributions: "You have not shared any labor prices yet.",
  edit: "Review or update",
  withdraw: "Withdraw contribution",
  active: "Active contribution",
  changed: "Record changed: excluded until you review and confirm again.",
  loadError: "The comparison could not be loaded. Please try again shortly.",
  saveError: "The contribution could not be saved. Please try again shortly.",
  withdrawError:
    "The contribution could not be withdrawn. Please try again shortly.",
  consentRequired: "Confirm voluntary sharing to continue.",
  invalidRecord: "Maintenance record not found in your account.",
  ineligibleRecord:
    "Use completed maintenance in BRL with a workshop, specific service, valid date and positive cost.",
  invalidLabor:
    "Enter labor above zero, with up to two decimal places and no more than R$ 10,000.00.",
  laborExceedsTotal: "Labor cannot exceed the record's total cost.",
  invalidRegion: "Enter the workshop city and a valid Brazilian state.",
};

export function workshopMessages(locale: Locale) {
  return locale === "en" ? en : pt;
}
