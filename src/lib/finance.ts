import { registroEstimate } from "./emolumentos";

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export type Extra = { descricao: string; valor: number };
export type Stage = { nome: string; percentual: number };
export type MonthlyRelease = { mes: number; percentual: number };
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
  terreno: number;
  saldoDevedor: number;
  valorImovel: number;
  aporteProprioObra: number;
  fgtsUtilizado: number;
  percentualFinanciavelLote: number;
  cub: number;
  maoDeObra: number;
  materiais: number;
  areaPlanejada: number;
  extras: Extra[];
  objetivo: "morar" | "vender";
  lucro: number;
  corretagem: number;
  prazo: number;
  jurosAnuais: number;
  stages: Stage[];
  liberacoes: MonthlyRelease[];
  despesas: ClientExpense[];
  participacaoInvestidor: number;
};

const PCI_PRESETS: Record<number, number[]> = {
  6: [9, 16, 20, 20, 20, 15],
  7: [8, 14, 17, 17, 17, 15, 12],
  8: [8, 12, 15, 15, 15, 14, 11, 10],
  9: [7, 11, 14, 14, 14, 13, 11, 9, 7],
  10: [7, 10, 12, 12, 12, 12, 11, 9, 8, 7],
  11: [6, 9, 11, 11, 11, 11, 10, 9, 8, 7, 7],
  12: [6, 8, 10, 10, 10, 10, 10, 9, 8, 7, 6, 6],
  13: [5, 8, 9, 9, 9, 9, 9, 9, 8, 7, 6, 6, 6],
};

export function suggestedExecutionMonths(area: number) {
  if (area <= 70) return 6;
  if (area <= 90) return 7;
  if (area <= 120) return 8;
  if (area <= 150) return 9;
  if (area <= 180) return 10;
  if (area <= 220) return 11;
  if (area <= 260) return 12;
  if (area <= 320) return 13;
  return 18;
}

function resample(values: number[], count: number) {
  if (values.length === 0) return Array.from({ length: count }, () => 100 / count);
  const sampled = Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : index * (values.length - 1) / (count - 1);
    const low = Math.floor(position);
    const high = Math.min(values.length - 1, Math.ceil(position));
    const fraction = position - low;
    return (values[low] ?? 0) * (1 - fraction) + (values[high] ?? 0) * fraction;
  });
  const total = sampled.reduce((sum, value) => sum + value, 0);
  const rounded = sampled.map((value) => Math.round(value / total * 10000) / 100);
  const last = rounded.length - 1;
  rounded[last] = (rounded[last] ?? 0) + Math.round((100 - rounded.reduce((sum, value) => sum + value, 0)) * 100) / 100;
  return rounded;
}

export function pciReleases(months: number): MonthlyRelease[] {
  const safeMonths = Math.min(24, Math.max(1, Math.round(months)));
  const percentages = PCI_PRESETS[safeMonths] ?? resample(PCI_PRESETS[13] ?? [100], safeMonths);
  return percentages.map((percentual, index) => ({ mes: index + 1, percentual }));
}

export function annualToMonthlyRate(annualPercent: number) {
  return (Math.pow(1 + Math.max(annualPercent, 0) / 100, 1 / 12) - 1) * 100;
}

export function monthlyToAnnualRate(monthlyPercent: number) {
  return (Math.pow(1 + Math.max(monthlyPercent, 0) / 100, 12) - 1) * 100;
}

export function estimatedExpenses(
  terreno: number,
  credito: number,
  projetos: number,
  administracao: number,
  honorarios: number,
  cub: number,
  area: number,
  estado = "",
  primeiroImovelSfh = false,
): ClientExpense[] {
  const common = { fonte: "Estimativa editável", observacao: "Confirme o valor real antes da contratação." };
  const areaAte100 = Math.min(area, 100);
  const areaAte200 = Math.min(Math.max(area - 100, 0), 100);
  const areaAte300 = Math.min(Math.max(area - 200, 0), 100);
  const areaAcima300 = Math.max(area - 300, 0);
  const remuneracaoEstimada = cub * (areaAte100 * 0.04 + areaAte200 * 0.08 + areaAte300 * 0.14 + areaAcima300 * 0.2);
  const inssEstimado = remuneracaoEstimada * 0.368;
  const registroCompra = registroEstimate(estado, terreno, primeiroImovelSfh);
  const registroAlienacao = registroEstimate(estado, credito, primeiroImovelSfh);
  const descontoSfh = primeiroImovelSfh ? " Inclui 50% de desconto do Art. 290 da Lei 6.015/73 (primeiro imóvel pelo SFH)." : "";
  const registroObservacao = (registro: typeof registroCompra, base: string) =>
    (registro.oficial ? `Tabela oficial da UF por faixa de ${base}; não inclui prenotação e taxas adicionais.` : `Estimativa sobre ${base}; consulte os emolumentos da UF.`) + descontoSfh;
  return [
    { id: "honorarios-entrada", categoria: "Despesas iniciais", nome: "Honorários — entrada (30%)", valor: honorarios * 0.3, fonte: "Condição informada pelo responsável técnico", observacao: "30% dos honorários desejados." },
    { id: "projetos", categoria: "Despesas iniciais", nome: "Projetos", valor: projetos, ...common },
    { id: "matricula-inicial", categoria: "Despesas iniciais", nome: "Certidão de matrícula", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "art", categoria: "Despesas iniciais", nome: "ART/RRT", valor: 285.59, fonte: "Confea / CREA ou CAU da UF", fonteUrl: "https://www.confea.org.br/profissional/taxas", observacao: "Referência; a tabela anual varia por conselho e UF." },
    { id: "plotagens", categoria: "Despesas iniciais", nome: "Plotagens", valor: 300, ...common },
    { id: "alvara", categoria: "Despesas iniciais", nome: "Alvará de construção", valor: area * 2 + 52, fonte: "Prefeitura do município", observacao: "Base de R$ 2,00 por m² + R$ 52,00; confirme a taxa municipal." },
    { id: "numeracao", categoria: "Despesas iniciais", nome: "Numeração do imóvel", valor: 100, fonte: "Prefeitura do município", observacao: "Taxa municipal; estimativa editável." },
    { id: "matricula-renovacao", categoria: "Assinatura do contrato", nome: "Renovação da certidão", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "taxa-caixa", categoria: "Assinatura do contrato", nome: "Taxa de contratação Caixa", valor: 750, fonte: "Caixa Habitação", fonteUrl: "https://www.caixa.gov.br/voce/habitacao/construcao/Paginas/default.aspx", observacao: "Valor solicitado como referência; confirme na tabela vigente." },
    { id: "relacionamento", categoria: "Assinatura do contrato", nome: "Produtos de relacionamento", valor: credito * 0.01, fonte: "Sugestão de 1% do valor financiado", observacao: "Não é taxa obrigatória; depende da negociação." },
    { id: "itbi", categoria: "Assinatura do contrato", nome: "ITBI do lote", valor: terreno * 0.02, fonte: "Prefeitura do município", observacao: "Estimativa de 2% apenas sobre o lote; a alíquota é municipal." },
    { id: "registro-compra", categoria: "Assinatura do contrato", nome: "Registro de compra e venda", valor: registroCompra.valor, fonte: registroCompra.fonte, fonteUrl: registroCompra.fonteUrl, observacao: registroObservacao(registroCompra, "valor do terreno") },
    { id: "alienacao", categoria: "Assinatura do contrato", nome: "Registro de alienação fiduciária", valor: registroAlienacao.valor, fonte: registroAlienacao.fonte, fonteUrl: registroAlienacao.fonteUrl, observacao: registroObservacao(registroAlienacao, "valor financiado") },
    { id: "matricula-contrato", categoria: "Assinatura do contrato", nome: "Certidão atualizada", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "honorarios-saldo", categoria: "Durante a obra", nome: "Honorários — restante (70%)", valor: honorarios * 0.7, fonte: "Condição informada pelo responsável técnico", observacao: "70% dos honorários desejados." },
    { id: "administracao", categoria: "Durante a obra", nome: "Administração do processo", valor: administracao, ...common },
    { id: "acompanhamento", categoria: "Durante a obra", nome: "Acompanhamento de obra", valor: 0, ...common },
    { id: "vistorias", categoria: "Durante a obra", nome: "Vistorias Caixa (2 × R$ 750)", valor: 1500, fonte: "Valor informado para esta estimativa", observacao: "Quantidade e tarifa podem variar conforme o contrato." },
    { id: "inss", categoria: "Durante a obra", nome: "INSS da obra", valor: inssEstimado, fonte: "Receita Federal — Manual do Sero", fonteUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/sero/manual-do-sero", observacao: "Estimativa preliminar por área e CUB; o valor oficial depende da aferição no CNO/Sero e dos créditos comprovados." },
    { id: "averbacao", categoria: "Durante a obra", nome: "Averbação da construção", valor: credito * 0.003, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Estimativa de 0,3%; consulte os emolumentos da UF." },
    { id: "matricula-final", categoria: "Durante a obra", nome: "Certidão atualizada", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
  ];
}

export function calculate(input: SimulationInput) {
  const soma = (items: { valor: number }[]) => items.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const extrasTotal = soma(input.extras);
  const despesasTotal = soma(input.despesas);
  const despesasPreContrato = soma(input.despesas.filter((item) => item.categoria === "Despesas iniciais"));
  const despesasAssinatura = soma(input.despesas.filter((item) => item.categoria === "Assinatura do contrato"));
  const despesasObra = soma(input.despesas.filter((item) => item.categoria === "Durante a obra"));

  // Contrato, como no simulador da Caixa: valor do imóvel = entrada + financiamento.
  const credito = Math.max(0, input.credito);
  const valorOperacao = Math.max(input.valorImovel, credito);
  const entradaExigida = Math.max(valorOperacao - credito, 0);
  const saldoDevedor = Math.max(0, input.saldoDevedor);
  const agioLote = Math.max(input.terreno - saldoDevedor, 0);
  // Ágio e FGTS compõem a entrada e reduzem o dinheiro necessário; nenhum dos dois vira caixa extra.
  const agioNaEntrada = Math.min(agioLote, entradaExigida);
  const fgtsNaEntrada = Math.min(Math.max(input.fgtsUtilizado, 0), entradaExigida - agioNaEntrada);
  const dinheiroEntrada = entradaExigida - agioNaEntrada - fgtsNaEntrada;
  const percentualFinanciavelLote = Math.min(100, Math.max(0, input.percentualFinanciavelLote));
  const limiteFinanciavelLote = input.terreno * percentualFinanciavelLote / 100;
  const quitacaoLote = Math.min(credito, saldoDevedor, limiteFinanciavelLote);
  const saldoLoteNaoCoberto = Math.max(saldoDevedor - quitacaoLote, 0);
  const avaliacaoMinimaLote = percentualFinanciavelLote > 0 ? saldoDevedor / (percentualFinanciavelLote / 100) : 0;
  const orcamentoObraContrato = Math.max(valorOperacao - input.terreno, 0);
  // Quando o ágio supera a entrada, o banco não libera para a obra mais do que o orçamento contratado.
  const financiamentoDisponivelObra = Math.max(credito - quitacaoLote, 0);
  const financiamentoConstrucao = Math.min(financiamentoDisponivelObra, orcamentoObraContrato);
  const financiamentoExcedente = financiamentoDisponivelObra - financiamentoConstrucao;
  // Saldo do lote que o banco não quita e que a entrada em dinheiro/FGTS não cobre sai do bolso na assinatura.
  const complementoLote = Math.max(saldoLoteNaoCoberto - dinheiroEntrada - fgtsNaEntrada, 0);
  const aporteProprioObra = Math.max(input.aporteProprioObra, 0);
  const verbaContrato = Math.min(financiamentoConstrucao + fgtsNaEntrada + dinheiroEntrada, orcamentoObraContrato);
  const recursosUtilizaveis = verbaContrato + aporteProprioObra;

  const taxaMensalPercentual = annualToMonthlyRate(input.jurosAnuais);
  const taxaMensal = taxaMensalPercentual / 100;
  let saldoLiberado = 0;
  let jurosObra = 0;
  const liberacoesMensais = input.liberacoes.map((item) => {
    // A medição libera recursos ao fim do mês; os encargos incidem sobre o saldo já liberado.
    const encargo = saldoLiberado * taxaMensal;
    jurosObra += encargo;
    const liberacao = financiamentoConstrucao * item.percentual / 100;
    saldoLiberado += liberacao;
    return { ...item, liberacao, saldoLiberado, encargo };
  });

  // A verba da obra paga construção, extras e despesas durante a obra. Despesas antes do contrato,
  // da assinatura e os juros mensais de obra saem do bolso do cliente.
  const custoM2 = input.maoDeObra + input.materiais;
  const disponivel = Math.max(0, recursosUtilizaveis - extrasTotal - despesasObra - input.lucro);
  const areaViavelMaxima = custoM2 > 0 ? disponivel / custoM2 : 0;
  const areaViavelMinima = custoM2 > 0 ? disponivel / (custoM2 * 1.18) : 0;
  const areaViavel = areaViavelMinima;
  const areaPlanejada = input.areaPlanejada > 0 ? input.areaPlanejada : areaViavelMinima;
  const custoConstrucao = areaPlanejada * custoM2;
  const custoObra = custoConstrucao + extrasTotal + despesasObra;
  const custoTotal = custoConstrucao + extrasTotal + despesasTotal + jurosObra;
  const custoComTerreno = custoTotal + input.terreno;
  // Positivo: sobra na verba da obra; negativo: aporte necessário para a área planejada.
  const saldoRecursos = recursosUtilizaveis - custoObra - input.lucro;
  const aporteParaAreaPlanejada = Math.max(-saldoRecursos, 0);

  const desembolsoAntesContrato = despesasPreContrato;
  const desembolsoAssinatura = dinheiroEntrada + complementoLote + despesasAssinatura;
  const desembolsoDuranteObra = jurosObra + aporteProprioObra + aporteParaAreaPlanejada;
  const desembolsoProprio = desembolsoAntesContrato + desembolsoAssinatura + desembolsoDuranteObra;
  const maiorEncargoMensal = liberacoesMensais.reduce((max, item) => Math.max(max, item.encargo), 0);

  // Na venda, o terreno (ágio + saldo quitado) também precisa ser recuperado.
  const taxaCorretagem = input.objetivo === "vender" ? Math.min(Math.max(input.corretagem, 0), 99.99) / 100 : 0;
  const valorVenda = input.objetivo === "vender" ? (custoComTerreno + input.lucro) / (1 - taxaCorretagem) : recursosUtilizaveis;
  const mesesAposObra = Math.max(0, Math.floor(input.prazo));
  const jurosPosObra = saldoLiberado * taxaMensal * mesesAposObra;
  const amortizacaoEstimada = Math.min(saldoLiberado, saldoLiberado / 360 * mesesAposObra);
  // O investidor banca as despesas pré-obra (antes do contrato e assinatura) e 10% da obra para o início,
  // antes da primeira liberação. A entrada não entra: é comprovação de recursos, não aporte.
  const capitalAportadoInvestidor = despesasPreContrato + despesasAssinatura + (custoConstrucao + extrasTotal) * 0.1;
  const participacaoInvestidor = Math.min(100, Math.max(0, input.participacaoInvestidor));
  const cenarios = [-0.15, 0, 0.15].map((ajuste, index) => {
    const venda = valorVenda * (1 + ajuste);
    const corretagem = venda * taxaCorretagem;
    const saldo = venda - corretagem - custoComTerreno - jurosPosObra;
    // Sem participação, evita "-R$ 0,00" quando o saldo é negativo.
    const lucroInvestidor = participacaoInvestidor > 0 ? saldo * participacaoInvestidor / 100 : 0;
    return {
      nome: ["Pessimista", "Realista", "Otimista"][index], ajuste, venda, corretagem, saldo,
      lucroInvestidor, lucroConstrutor: saldo - lucroInvestidor,
      rentabilidadeInvestidor: capitalAportadoInvestidor > 0 ? lucroInvestidor / capitalAportadoInvestidor * 100 : null,
    };
  });
  return {
    areaViavel, areaViavelMinima, areaViavelMaxima, areaPlanejada, aporteParaAreaPlanejada, custoM2,
    maoDeObra: input.maoDeObra, materiais: input.materiais,
    cubReferenciaValor: input.cub, cubMaisDez: input.cub * 1.1,
    extrasTotal, despesasTotal, despesasPreContrato, despesasAssinatura, despesasObra, despesas: input.despesas,
    saldoRecursos, disponivel, custoObra, custoConstrucao, custoTotal, custoComTerreno, jurosObra,
    valorVenda, corretagemPercentual: input.corretagem, corretagemValor: valorVenda * taxaCorretagem,
    lucroDesejado: input.lucro, mesesAposObra, jurosPosObra, amortizacaoEstimada,
    parcelasEstimadas: jurosPosObra + amortizacaoEstimada,
    capitalAportadoInvestidor, participacaoInvestidor, cenarios,
    terreno: input.terreno, saldoDevedor, credito, valorOperacao, entradaExigida,
    agioLote, agioNaEntrada, fgtsUtilizado: input.fgtsUtilizado, fgtsNaEntrada, dinheiroEntrada,
    percentualFinanciavelLote, limiteFinanciavelLote, avaliacaoMinimaLote,
    quitacaoLote, saldoLoteNaoCoberto, complementoLote, orcamentoObraContrato,
    financiamentoConstrucao, financiamentoExcedente, aporteProprioObra, recursosUtilizaveis,
    desembolsoAntesContrato, desembolsoAssinatura, desembolsoDuranteObra, desembolsoProprio, maiorEncargoMensal,
    taxaJurosAnual: input.jurosAnuais, taxaJurosMensalEquivalente: taxaMensalPercentual,
    prazoExecucaoMeses: input.liberacoes.length, liberacoesMensais,
    cronograma: input.stages.map((stage) => ({ ...stage, valor: financiamentoConstrucao * stage.percentual / 100 })),
  };
}
