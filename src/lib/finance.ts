export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export type Extra = { descricao: string; valor: number };
export type Stage = { nome: string; percentual: number };
export type ExpenseCategory = "Despesas iniciais" | "Assinatura do contrato" | "Durante a obra";
export type ClientExpense = {
  id: string;
  categoria: ExpenseCategory;
  nome: string;
  valor: number;
  fonte: string;
  fonteUrl?: string;
  observacao: string;
};
export type SimulationInput = {
  credito: number;
  cub: number;
  bdi: number;
  extras: Extra[];
  objetivo: "morar" | "vender";
  valorVenda: number;
  prazo: number;
  juros: number;
  stages: Stage[];
  despesas: ClientExpense[];
};

export function estimatedExpenses(
  terreno: number,
  credito: number,
  projetos: number,
  administracao: number,
  honorarios: number,
  objetivo: "morar" | "vender",
): ClientExpense[] {
  const fees = objetivo === "vender" ? honorarios : 0;
  const common = {
    fonte: "Estimativa editável",
    observacao: "Confirme o valor real antes da contratação.",
  };
  const expenses: ClientExpense[] = [
    {
      id: "honorarios-entrada",
      categoria: "Despesas iniciais",
      nome: "Honorários — entrada (30%)",
      valor: fees * 0.3,
      fonte: "Condição informada pelo responsável técnico",
      observacao: "30% dos honorários desejados.",
    },
    {
      id: "projetos",
      categoria: "Despesas iniciais",
      nome: "Projetos",
      valor: projetos,
      ...common,
    },
    {
      id: "matricula-inicial",
      categoria: "Despesas iniciais",
      nome: "Certidão de matrícula",
      valor: 100,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Emolumentos variam por estado.",
    },
    {
      id: "art",
      categoria: "Despesas iniciais",
      nome: "ART/RRT",
      valor: 285.59,
      fonte: "Confea / CREA ou CAU da UF",
      fonteUrl: "https://www.confea.org.br/profissional/taxas",
      observacao: "Referência; a tabela anual varia por conselho e UF.",
    },
    { id: "plotagens", categoria: "Despesas iniciais", nome: "Plotagens", valor: 300, ...common },
    {
      id: "alvara",
      categoria: "Despesas iniciais",
      nome: "Alvará de construção",
      valor: 1000,
      fonte: "Prefeitura do município",
      observacao: "Taxa municipal; estimativa editável.",
    },
    {
      id: "numeracao",
      categoria: "Despesas iniciais",
      nome: "Numeração do imóvel",
      valor: 100,
      fonte: "Prefeitura do município",
      observacao: "Taxa municipal; estimativa editável.",
    },
    {
      id: "matricula-renovacao",
      categoria: "Assinatura do contrato",
      nome: "Renovação da certidão",
      valor: 100,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Emolumentos variam por estado.",
    },
    {
      id: "taxa-caixa",
      categoria: "Assinatura do contrato",
      nome: "Taxa de contratação Caixa",
      valor: 750,
      fonte: "Caixa Habitação",
      fonteUrl: "https://www.caixa.gov.br/voce/habitacao/construcao/Paginas/default.aspx",
      observacao: "Valor solicitado como referência; confirme na tabela vigente.",
    },
    {
      id: "relacionamento",
      categoria: "Assinatura do contrato",
      nome: "Produtos de relacionamento",
      valor: credito * 0.01,
      fonte: "Sugestão de 1% do valor financiado",
      observacao: "Não é taxa obrigatória; depende da negociação.",
    },
    {
      id: "itbi",
      categoria: "Assinatura do contrato",
      nome: "ITBI do lote",
      valor: terreno * 0.02,
      fonte: "Prefeitura do município",
      observacao: "Estimativa de 2% apenas sobre o lote; a alíquota é municipal.",
    },
    {
      id: "registro-compra",
      categoria: "Assinatura do contrato",
      nome: "Registro de compra e venda",
      valor: terreno * 0.005,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Estimativa de 0,5%; consulte os emolumentos da UF.",
    },
    {
      id: "alienacao",
      categoria: "Assinatura do contrato",
      nome: "Registro de alienação fiduciária",
      valor: credito * 0.005,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Estimativa de 0,5%; consulte os emolumentos da UF.",
    },
    {
      id: "matricula-contrato",
      categoria: "Assinatura do contrato",
      nome: "Certidão atualizada",
      valor: 100,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Emolumentos variam por estado.",
    },
    {
      id: "honorarios-saldo",
      categoria: "Durante a obra",
      nome: "Honorários — restante (70%)",
      valor: fees * 0.7,
      fonte: "Condição informada pelo responsável técnico",
      observacao: "70% dos honorários desejados.",
    },
    {
      id: "administracao",
      categoria: "Durante a obra",
      nome: "Administração do processo",
      valor: administracao,
      ...common,
    },
    {
      id: "acompanhamento",
      categoria: "Durante a obra",
      nome: "Acompanhamento de obra",
      valor: 0,
      ...common,
    },
    {
      id: "vistorias",
      categoria: "Durante a obra",
      nome: "Vistorias Caixa (2 × R$ 750)",
      valor: 1500,
      fonte: "Valor informado para esta estimativa",
      observacao: "Quantidade e tarifa podem variar conforme o contrato.",
    },
    {
      id: "inss",
      categoria: "Durante a obra",
      nome: "INSS da obra",
      valor: 0,
      fonte: "Receita Federal — CNO/Sero",
      fonteUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil",
      observacao: "Depende da aferição da obra; confirme com contador.",
    },
    {
      id: "averbacao",
      categoria: "Durante a obra",
      nome: "Averbação da construção",
      valor: credito * 0.003,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Estimativa de 0,3%; consulte os emolumentos da UF.",
    },
    {
      id: "matricula-final",
      categoria: "Durante a obra",
      nome: "Certidão atualizada",
      valor: 100,
      fonte: "RI Digital — tabela estadual",
      fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx",
      observacao: "Emolumentos variam por estado.",
    },
  ];
  return objetivo === "morar"
    ? expenses.filter((item) => !item.id.startsWith("honorarios-"))
    : expenses;
}

export function calculate(input: SimulationInput) {
  const extrasTotal = input.extras.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const despesasTotal = input.despesas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const contingencia = input.credito * 0.2;
  const jurosObra = input.credito * (input.juros / 100);
  const disponivel = Math.max(
    0,
    input.credito - extrasTotal - despesasTotal - contingencia - jurosObra,
  );
  const custoM2 = input.cub * (1 + input.bdi / 100);
  const areaViavel = custoM2 > 0 ? disponivel / custoM2 : 0;
  const custoObra = areaViavel * custoM2 + extrasTotal + despesasTotal
  const cenarios = [-0.15, 0, 0.15].map((ajuste, i) => ({
    nome: ["Pessimista", "Realista", "Otimista"][i],
    ajuste,
    venda:
      input.objetivo === "vender" ? input.valorVenda * (1 + ajuste) : input.credito * (1 + ajuste),
    saldo:
      (input.objetivo === "vender"
        ? input.valorVenda * (1 + ajuste)
        : input.credito * (1 + ajuste)) -
      custoObra -
      jurosObra,
  }));
  return {
    areaViavel,
    custoM2,
    extrasTotal,
    despesasTotal,
    despesas: input.despesas,
    contingencia,
    disponivel,
    custoObra,
    jurosObra,
    cenarios,
    cronograma: input.stages.map((s) => ({ ...s, valor: (input.credito * s.percentual) / 100 })),
  };
}
