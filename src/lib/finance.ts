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
  maoDeObra: number;
  materiais: number;
  extras: Extra[];
  objetivo: "morar" | "vender";
  lucro: number;
  corretagem: number;
  prazo: number;
  juros: number;
  stages: Stage[];
  despesas: ClientExpense[];
  capitalInvestidor: number;
  participacaoInvestidor: number;
};

export function estimatedExpenses(
  terreno: number,
  credito: number,
  projetos: number,
  administracao: number,
  honorarios: number,
  cub: number,
  area: number,
): ClientExpense[] {
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
      valor: honorarios * 0.3,
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
      valor: honorarios * 0.7,
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
  return expenses;
}

export function calculate(input: SimulationInput) {
  const extrasTotal = input.extras.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const despesasTotal = input.despesas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const contingencia = input.credito * 0.2;
  const jurosObra = input.credito * (input.juros / 100);
  const custoM2 = input.maoDeObra + input.materiais;
  const disponivel = Math.max(
    0,
    input.credito - extrasTotal - despesasTotal - contingencia - jurosObra - input.lucro,
  );
  const areaViavel = custoM2 > 0 ? disponivel / custoM2 : 0;
  const areaViavelMinima = areaViavel;
  const areaViavelMaxima = areaViavel;
  const custoConstrucao = areaViavel * custoM2;
  const custoObra = custoConstrucao + extrasTotal + despesasTotal;
  const custoTotal = custoObra + jurosObra + contingencia;
  const taxaCorretagem = input.objetivo === "vender" ? Math.min(Math.max(input.corretagem, 0), 99.99) / 100 : 0;
  const valorVenda = input.objetivo === "vender"
    ? (custoTotal + input.lucro) / (1 - taxaCorretagem)
    : input.credito;
  const mesesAposObra = Math.max(0, Math.floor(input.prazo));
  const jurosPosObra = input.credito * (input.juros / 100) * mesesAposObra;
  const amortizacaoEstimada = Math.min(input.credito, input.credito / 360 * mesesAposObra);
  const participacaoInvestidor = Math.min(100, Math.max(0, input.participacaoInvestidor));
  const cenarios = [-0.15, 0, 0.15].map((ajuste, i) => {
    const venda = valorVenda * (1 + ajuste);
    const corretagem = venda * taxaCorretagem;
    const saldo = venda - corretagem - custoTotal - jurosPosObra;
    const lucroInvestidor = saldo * participacaoInvestidor / 100;
    return {
      nome: ["Pessimista", "Realista", "Otimista"][i], ajuste, venda, corretagem,
      saldo, lucroInvestidor, lucroConstrutor: saldo - lucroInvestidor,
      rentabilidadeInvestidor: input.capitalInvestidor > 0 ? lucroInvestidor / input.capitalInvestidor * 100 : null,
    };
  });
  return {
    areaViavel,
    areaViavelMinima,
    areaViavelMaxima,
    custoM2,
    maoDeObra: input.maoDeObra,
    materiais: input.materiais,
    cubReferenciaValor: input.cub,
    cubMaisDez: input.cub * 1.1,
    extrasTotal,
    despesasTotal,
    despesas: input.despesas,
    contingencia,
    disponivel,
    custoObra,
    custoConstrucao,
    custoTotal,
    jurosObra,
    valorVenda,
    corretagemPercentual: input.corretagem,
    corretagemValor: valorVenda * taxaCorretagem,
    lucroDesejado: input.lucro,
    mesesAposObra,
    jurosPosObra,
    amortizacaoEstimada,
    parcelasEstimadas: jurosPosObra + amortizacaoEstimada,
    capitalInvestidor: input.capitalInvestidor,
    participacaoInvestidor,
    cenarios,
    cronograma: input.stages.map((s) => ({ ...s, valor: (input.credito * s.percentual) / 100 })),
  };
}
