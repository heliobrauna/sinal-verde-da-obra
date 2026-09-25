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
  extras: Extra[];
  objetivo: "morar" | "vender";
  lucro: number;
  corretagem: number;
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
  cub: number,
  area: number,
): ClientExpense[] {
  const fees = objetivo === "vender" ? honorarios : 0;
  const common = {
    fonte: "Estimativa editável",
    observacao: "Confirme o valor real antes da contratação.",
  };
  const areaAte100 = Math.min(area, 100);
  const areaAte200 = Math.min(Math.max(area - 100, 0), 100);
  const areaAte300 = Math.min(Math.max(area - 200, 0), 100);
  const areaAcima300 = Math.max(area - 300, 0);
  const remuneracaoEstimada = cub * (
    areaAte100 * 0.04 +
    areaAte200 * 0.08 +
    areaAte300 * 0.14 +
    areaAcima300 * 0.2
  );
  const inssEstimado = remuneracaoEstimada * 0.368;
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
      valor: inssEstimado,
      fonte: "Receita Federal — Manual do Sero",
      fonteUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/sero/manual-do-sero",
      observacao: "Estimativa preliminar por área e CUB; o valor oficial depende da aferição no CNO/Sero e dos créditos comprovados.",
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
  const custoM2Minimo = input.cub;
  const custoM2Maximo = input.cub * 1.18;
  const areaViavelMaxima = custoM2Minimo > 0 ? disponivel / custoM2Minimo : 0;
  const areaViavelMinima = custoM2Maximo > 0 ? disponivel / custoM2Maximo : 0;
  const areaViavel = areaViavelMinima;
  const custoM2 = custoM2Maximo;
  const custoObra = areaViavel * custoM2 + extrasTotal + despesasTotal;
  const custoTotal = custoObra + jurosObra;
  const taxaCorretagem = input.objetivo === "vender" ? Math.min(Math.max(input.corretagem, 0), 99.99) / 100 : 0;
  const valorVenda = input.objetivo === "vender"
    ? (custoTotal + input.lucro) / (1 - taxaCorretagem)
    : input.credito;
  const cenarios = [-0.15, 0, 0.15].map((ajuste, i) => ({
    nome: ["Pessimista", "Realista", "Otimista"][i],
    ajuste,
    venda: valorVenda * (1 + ajuste),
    corretagem: valorVenda * (1 + ajuste) * taxaCorretagem,
    saldo:
      valorVenda * (1 + ajuste) -
      valorVenda * (1 + ajuste) * taxaCorretagem -
      custoObra -
      jurosObra,
  }));
  return {
    areaViavel,
    areaViavelMinima,
    areaViavelMaxima,
    custoM2,
    extrasTotal,
    despesasTotal,
    despesas: input.despesas,
    contingencia,
    disponivel,
    custoObra,
    custoTotal,
    jurosObra,
    valorVenda,
    corretagemPercentual: input.corretagem,
    corretagemValor: valorVenda * taxaCorretagem,
    lucroDesejado: input.lucro,
    cenarios,
    cronograma: input.stages.map((s) => ({ ...s, valor: (input.credito * s.percentual) / 100 })),
  };
}
