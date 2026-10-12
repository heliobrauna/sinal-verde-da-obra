import { registroEstimate } from "./emolumentos";

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export type Extra = { descricao: string; valor: number };
export type Stage = { nome: string; percentual: number };
export type MonthlyRelease = { mes: number; percentual: number };
export type ExpenseCategory = "Despesas iniciais" | "Assinatura do contrato" | "Durante a obra" | "Na venda";
export type ClientExpense = {
  id: string;
  categoria: ExpenseCategory;
  nome: string;
  valor: number;
  fonte: string;
  fonteUrl?: string;
  observacao: string;
};
export type OrigemTerreno = "investidor" | "construtor" | "compra";
// patrimonio: bem que já é do investidor (o lote), conta como capital mas não é dinheiro a separar.
type InvestorFlow = { mes: number; rotulo: string; valor: number; retornoMes?: number; patrimonio?: boolean };

// Alíquota regressiva de IR da renda fixa (Tesouro Selic) pelo prazo em meses.
export function irAliquota(meses: number) {
  const dias = meses * 30;
  if (dias <= 180) return 22.5;
  if (dias <= 360) return 20;
  if (dias <= 720) return 17.5;
  return 15;
}

// Taxa interna de retorno mensal por bisseção; fluxos negativos são aportes e positivos, retornos.
function irr(flows: { mes: number; valor: number }[]) {
  const npv = (rate: number) => flows.reduce((sum, flow) => sum + flow.valor / Math.pow(1 + rate, flow.mes), 0);
  let low = -0.99;
  let high = 1;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export type SimulationInput = {
  credito: number;
  terreno: number;
  saldoDevedor: number;
  valorImovel: number;
  fgtsUtilizado: number;
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
  // Atualização monetária (TR, % ao mês) e seguros MIP/DFI + tarifa de administração (R$ por mês).
  trMensal: number;
  seguroTarifaMensal: number;
  // Fase de amortização, como no simulador da Caixa: sistema e prazo em meses.
  sistemaAmortizacao: SistemaAmortizacao;
  prazoFinanciamento: number;
  stages: Stage[];
  liberacoes: MonthlyRelease[];
  despesas: ClientExpense[];
  participacaoInvestidor: number;
  origemTerreno: OrigemTerreno;
  selicAnual: number;
  premioInvestidor: number;
  // Custos de vender o lote hoje: definem o valor líquido que o investidor abre mão ao usá-lo na obra.
  corretagemLote: number;
  custoAquisicaoLote: number;
  // Na venda, quanto o construtor gostaria de ganhar: só referência para o "preço para o seu lucro".
  lucroConstrutor: number | null;
  // Remuneração do construtor além da margem (lucro): todas saem da verba da obra, nos dois modos.
  administracao?: number;
  projetos?: number;
  honorarios?: number;
  // Preço de venda esperado (mercado). Zero usa o preço de equilíbrio (simulações antigas).
  // Preço fixo de venda: não vem do formulário (lá o preço é sugerido pelo app); serve ao cenário de
  // atraso, que mantém o preço, e aos testes da cascata. Registros antigos também o guardam.
  precoVenda?: number;
  // Preço do m² de casa pronta na região (opcional): só confere o preço sugerido com o mercado.
  precoM2Mercado?: number;
  // Sem investidor parceiro, o próprio construtor financia e fica com todo o resultado.
  temInvestidor?: boolean;
  // Algumas agências exigem depositar a entrada em dinheiro; sem isso ela é só comprovação de recursos.
  entradaDepositada?: boolean;
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
  transferenciaLote = true,
  venda = false,
): ClientExpense[] {
  // Projetos, administração e honorários são remuneração do construtor (saem da verba da obra), não despesas.
  void projetos;
  void administracao;
  void honorarios;
  const common = { fonte: "Estimativa editável", observacao: "Confirme o valor real antes da contratação." };
  const areaAte100 = Math.min(area, 100);
  const areaAte200 = Math.min(Math.max(area - 100, 0), 100);
  const areaAte300 = Math.min(Math.max(area - 200, 0), 100);
  const areaAcima300 = Math.max(area - 300, 0);
  const remuneracaoEstimada = cub * (areaAte100 * 0.04 + areaAte200 * 0.08 + areaAte300 * 0.14 + areaAcima300 * 0.2);
  const inssEstimado = remuneracaoEstimada * 0.368;
  const registroCompra = registroEstimate(estado, transferenciaLote ? terreno : 0, primeiroImovelSfh);
  const registroAlienacao = registroEstimate(estado, credito, primeiroImovelSfh, "garantia");
  const descontoSfh = primeiroImovelSfh ? " Inclui 50% de desconto do Art. 290 da Lei 6.015/73 (primeiro imóvel pelo SFH)." : "";
  const registroObservacao = (registro: typeof registroCompra, base: string) =>
    (registro.oficial ? `Tabela oficial da UF por faixa de ${base}; não inclui prenotação e taxas adicionais.` : `Estimativa sobre ${base}; consulte os emolumentos da UF.`) + descontoSfh;
  return [
    { id: "matricula-inicial", categoria: "Despesas iniciais", nome: "Certidão de matrícula", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "art", categoria: "Despesas iniciais", nome: "ART/RRT", valor: 285.59, fonte: "Confea / CREA ou CAU da UF", fonteUrl: "https://www.confea.org.br/profissional/taxas", observacao: "Referência; a tabela anual varia por conselho e UF." },
    { id: "plotagens", categoria: "Despesas iniciais", nome: "Plotagens", valor: 300, ...common },
    { id: "alvara", categoria: "Despesas iniciais", nome: "Alvará de construção", valor: area * 2 + 52, fonte: "Prefeitura do município", observacao: "Base de R$ 2,00 por m² + R$ 52,00; confirme a taxa municipal." },
    { id: "numeracao", categoria: "Despesas iniciais", nome: "Numeração do imóvel", valor: 100, fonte: "Prefeitura do município", observacao: "Taxa municipal; estimativa editável." },
    { id: "matricula-renovacao", categoria: "Assinatura do contrato", nome: "Renovação da certidão", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "taxa-caixa", categoria: "Assinatura do contrato", nome: "Taxa de contratação Caixa", valor: 750, fonte: "Caixa Habitação", fonteUrl: "https://www.caixa.gov.br/voce/habitacao/construcao/Paginas/default.aspx", observacao: "Valor solicitado como referência; confirme na tabela vigente." },
    { id: "relacionamento", categoria: "Assinatura do contrato", nome: "Produtos de relacionamento", valor: credito * 0.01, fonte: "Sugestão de 1% do valor financiado", observacao: "Não é taxa obrigatória; depende da negociação." },
    { id: "itbi", categoria: "Assinatura do contrato", nome: "ITBI do lote", valor: transferenciaLote ? terreno * 0.02 : 0, fonte: "Prefeitura do município", observacao: "Estimativa de 2% apenas sobre o lote; a alíquota é municipal." },
    { id: "registro-compra", categoria: "Assinatura do contrato", nome: "Registro de compra e venda", valor: registroCompra.valor, fonte: registroCompra.fonte, fonteUrl: registroCompra.fonteUrl, observacao: registroObservacao(registroCompra, "valor do terreno") },
    { id: "alienacao", categoria: "Assinatura do contrato", nome: "Registro de alienação fiduciária", valor: registroAlienacao.valor, fonte: registroAlienacao.fonte, fonteUrl: registroAlienacao.fonteUrl, observacao: registroObservacao(registroAlienacao, "valor financiado") },
    { id: "matricula-contrato", categoria: "Assinatura do contrato", nome: "Certidão atualizada", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    { id: "vistorias", categoria: "Durante a obra", nome: "Vistorias Caixa (2 × R$ 750)", valor: 1500, fonte: "Valor informado para esta estimativa", observacao: "Quantidade e tarifa podem variar conforme o contrato." },
    { id: "inss", categoria: "Durante a obra", nome: "INSS da obra", valor: inssEstimado, fonte: "Receita Federal — Manual do Sero", fonteUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/sero/manual-do-sero", observacao: "Estimativa preliminar por área e CUB; o valor oficial depende da aferição no CNO/Sero e dos créditos comprovados." },
    { id: "averbacao", categoria: "Durante a obra", nome: "Averbação da construção", valor: credito * 0.003, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Estimativa de 0,3%; consulte os emolumentos da UF." },
    { id: "matricula-final", categoria: "Durante a obra", nome: "Certidão atualizada", valor: 100, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Emolumentos variam por estado." },
    // Na venda do imóvel pronto, ITBI e registro são do comprador; ao vendedor cabem a baixa da alienação
    // fiduciária (o financiamento é quitado com o dinheiro da venda) e as certidões. Corretagem e IR são calculados.
    ...(venda
      ? [
          { id: "baixa-alienacao", categoria: "Na venda" as const, nome: "Baixa da alienação fiduciária", valor: 600, fonte: "RI Digital — tabela estadual", fonteUrl: "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx", observacao: "Averbação do termo de quitação do financiamento; estimativa, varia por estado." },
          { id: "certidoes-venda", categoria: "Na venda" as const, nome: "Certidões do vendedor", valor: 300, ...common },
        ]
      : []),
  ];
}

// Parte do contrato que pode quitar o lote.
export const LIMITE_LOTE_CONTRATO = 0.3;
// Parte do lote e da obra que a Caixa financia.
const PERCENTUAL_FINANCIADO_PARTE = 0.8;

// IR sobre ganho de capital de pessoa física, por faixas (Lei 13.259/2016): 15% até R$ 5 milhões,
// 17,5% até R$ 10 milhões, 20% até R$ 30 milhões e 22,5% acima.
export function irGanhoCapital(ganho: number) {
  const faixas: [number, number][] = [[5e6, 0.15], [10e6, 0.175], [30e6, 0.2], [Infinity, 0.225]];
  let imposto = 0;
  let anterior = 0;
  for (const [limite, aliquota] of faixas) {
    if (ganho <= anterior) break;
    imposto += (Math.min(ganho, limite) - anterior) * aliquota;
    anterior = limite;
  }
  return imposto;
}
// Fator de redução FR2 (Lei 11.196/2005, art. 40): 1 / 1,0035 elevado aos meses entre a aquisição e a venda.
export const fatorReducaoFr2 = (meses: number) => 1 / Math.pow(1.0035, Math.max(meses, 0));
export type SistemaAmortizacao = "PRICE" | "SAC";

// Parcelas da fase de amortização, sem TR (como o simulador da Caixa, que a deixa de fora por ser variável):
// juros sobre o saldo + amortização (fixa no SAC; parcela constante no PRICE) + seguros e tarifa.
export function parcelasAmortizacao(divida: number, taxaMensal: number, prazo: number, sistema: SistemaAmortizacao, seguroTarifa: number, meses: number) {
  const n = Math.max(1, Math.round(prazo));
  const pmt = taxaMensal > 0 ? divida * taxaMensal / (1 - Math.pow(1 + taxaMensal, -n)) : divida / n;
  let saldo = divida;
  return Array.from({ length: Math.max(0, meses) }, () => {
    const juros = saldo * taxaMensal;
    const amortizacao = Math.min(saldo, sistema === "SAC" ? divida / n : pmt - juros);
    saldo -= amortizacao;
    return { juros, amortizacao, parcela: juros + amortizacao + seguroTarifa };
  });
}

// Na venda, o preço sugerido cobre custos, retorno mínimo do investidor e o lucro desejado do construtor; o
// resultado é dividido em cascata. O cenário de atraso refaz a conta com mais meses de parcelas, mantendo o preço.
export function calculate(input: SimulationInput) {
  const result = calcular(input);
  if (input.objetivo !== "vender") return result;
  const atraso = calcular({ ...input, prazo: Math.max(0, Math.floor(input.prazo)) + MESES_ATRASO_VENDA, precoVenda: result.valorVenda });
  const esperado = atraso.cenarios[0];
  return {
    ...result,
    cenarios: esperado ? [...result.cenarios, { ...esperado, nome: `Venda ${MESES_ATRASO_VENDA} meses depois`, atraso: MESES_ATRASO_VENDA }] : result.cenarios,
  };
}

export const MESES_ATRASO_VENDA = 6;
export const QUEDA_PRECO_CENARIO = 0.1;

function calcular(input: SimulationInput) {
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
  // Lote comprado na operação (do construtor ou de terceiro): o preço inteiro é pago ao vendedor e não há ágio.
  const saldoDevedor = input.origemTerreno === "investidor" ? Math.max(0, input.saldoDevedor) : Math.max(0, input.terreno);
  const agioLote = Math.max(input.terreno - saldoDevedor, 0);
  // Ágio e FGTS compõem a entrada e reduzem o dinheiro necessário; nenhum dos dois vira caixa extra.
  const agioNaEntrada = Math.min(agioLote, entradaExigida);
  // FGTS é para a moradia própria do titular: obra para vender não usa FGTS.
  const fgtsUtilizado = input.objetivo === "vender" ? 0 : Math.max(input.fgtsUtilizado, 0);
  const fgtsNaEntrada = Math.min(fgtsUtilizado, entradaExigida - agioNaEntrada);
  const dinheiroEntrada = entradaExigida - agioNaEntrada - fgtsNaEntrada;
  // O banco quita o saldo do lote até 30% do valor do contrato (aceito sem laudo do lote).
  const limiteFinanciavelLote = valorOperacao * LIMITE_LOTE_CONTRATO;
  const quitacaoLote = Math.min(credito, saldoDevedor, limiteFinanciavelLote);
  const saldoLoteNaoCoberto = Math.max(saldoDevedor - quitacaoLote, 0);
  const orcamentoObraContrato = Math.max(valorOperacao - input.terreno, 0);
  // Quando o ágio supera a entrada, o banco não libera para a obra mais do que o orçamento contratado.
  const financiamentoDisponivelObra = Math.max(credito - quitacaoLote, 0);
  const financiamentoConstrucao = Math.min(financiamentoDisponivelObra, orcamentoObraContrato);
  const financiamentoExcedente = financiamentoDisponivelObra - financiamentoConstrucao;
  // Saldo do lote que o banco não quita e que a entrada em dinheiro/FGTS não cobre sai do bolso na assinatura.
  const complementoLote = Math.max(saldoLoteNaoCoberto - dinheiroEntrada - fgtsNaEntrada, 0);
  // Sugestão para preencher o contrato: o banco financia 80% de cada parte (lote e obra). Quando o
  // pagamento do lote passa de 80% do valor informado, o lote vai ao papel como pagamento ÷ 0,8 e a obra
  // fica com o restante. Valor do imóvel e financiamento total não mudam; só a divisão entre as partes.
  const loteContrato = Math.max(input.terreno, quitacaoLote / PERCENTUAL_FINANCIADO_PARTE);
  const obraContrato = Math.max(valorOperacao - loteContrato, 0);
  const redistribuicaoContrato = loteContrato > input.terreno + 0.005;
  const verbaContrato = Math.min(financiamentoConstrucao + fgtsNaEntrada + dinheiroEntrada, orcamentoObraContrato);
  const recursosUtilizaveis = verbaContrato;

  const taxaMensalPercentual = annualToMonthlyRate(input.jurosAnuais);
  const taxaMensal = taxaMensalPercentual / 100;
  const trMensal = Math.max(input.trMensal, 0) / 100;
  const seguroTarifaMensal = Math.max(input.seguroTarifaMensal, 0);
  // Encargos da fase de obra (cartilha Caixa): sobre a dívida já liberada incidem atualização monetária
  // AM = SD × TR e juros = (SD + AM) × taxa mensal, mais seguros e tarifa. Não há amortização.
  // A parte do lote paga pelo banco é liberada na assinatura e já compõe a dívida desde o 1º encargo;
  // as parcelas da obra são liberadas ao fim de cada mês, após a medição.
  let saldoLiberado = quitacaoLote;
  let jurosObra = 0;
  let jurosObraJuros = 0;
  let jurosObraTr = 0;
  let jurosObraSeguros = 0;
  const liberacoesMensais = input.liberacoes.map((item) => {
    const saldoBase = saldoLiberado;
    const atualizacao = saldoBase * trMensal;
    const juros = (saldoBase + atualizacao) * taxaMensal;
    const encargo = atualizacao + juros + seguroTarifaMensal;
    jurosObra += encargo;
    jurosObraJuros += juros;
    jurosObraTr += atualizacao;
    jurosObraSeguros += seguroTarifaMensal;
    const liberacao = financiamentoConstrucao * item.percentual / 100;
    saldoLiberado += liberacao;
    return { ...item, liberacao, saldoLiberado, saldoBase, juros, atualizacao, encargo };
  });

  // A verba da obra paga construção, extras e despesas durante a obra. Despesas antes do contrato,
  // da assinatura e os juros mensais de obra saem do bolso do cliente.
  const custoM2 = input.maoDeObra + input.materiais;
  // Remuneração do construtor (margem + administração + projetos + honorários) sai da verba da obra nos dois
  // modos: o imóvel é o mesmo e a área viável também, seja para morar, seja para vender.
  const remuneracaoDetalhe = {
    margem: Math.max(input.lucro, 0),
    administracao: Math.max(input.administracao ?? 0, 0),
    projetos: Math.max(input.projetos ?? 0, 0),
    honorarios: Math.max(input.honorarios ?? 0, 0),
  };
  const reservaLucro = remuneracaoDetalhe.margem + remuneracaoDetalhe.administracao + remuneracaoDetalhe.projetos + remuneracaoDetalhe.honorarios;
  const disponivel = Math.max(0, recursosUtilizaveis - extrasTotal - despesasObra - reservaLucro);
  const areaViavelMaxima = custoM2 > 0 ? disponivel / custoM2 : 0;
  const areaViavelMinima = custoM2 > 0 ? disponivel / (custoM2 * 1.18) : 0;
  const areaViavel = areaViavelMinima;
  const areaPlanejada = input.areaPlanejada > 0 ? input.areaPlanejada : areaViavelMinima;
  const custoConstrucao = areaPlanejada * custoM2;
  const custoObra = custoConstrucao + extrasTotal + despesasObra;
  const custoTotal = custoConstrucao + extrasTotal + despesasTotal + jurosObra;
  const custoComTerreno = custoTotal + input.terreno;
  // Custo do imóvel com a remuneração do construtor: é o que o cliente (ou o investidor) paga no total.
  const custoImovel = custoComTerreno + reservaLucro;
  // Positivo: sobra na verba da obra; negativo: aporte necessário para a área planejada.
  const saldoRecursos = recursosUtilizaveis - custoObra - reservaLucro;
  const aporteParaAreaPlanejada = Math.max(-saldoRecursos, 0);

  const desembolsoAntesContrato = despesasPreContrato;
  const desembolsoAssinatura = dinheiroEntrada + complementoLote + despesasAssinatura;
  // Área planejada acima da viável: a diferença sai do bolso do cliente.
  const desembolsoDuranteObra = jurosObra + aporteParaAreaPlanejada;
  const desembolsoProprio = desembolsoAntesContrato + desembolsoAssinatura + desembolsoDuranteObra;
  const maiorEncargoMensal = liberacoesMensais.reduce((max, item) => Math.max(max, item.encargo), 0);

  const vender = input.objetivo === "vender";
  const taxaCorretagem = vender ? Math.min(Math.max(input.corretagem, 0), 99.99) / 100 : 0;
  const mesesAposObra = Math.max(0, Math.floor(input.prazo));
  // Após a obra a dívida inteira (lote + obra) entra em amortização; a TR só é considerada na fase de obra.
  const sistemaAmortizacao: SistemaAmortizacao = input.sistemaAmortizacao === "SAC" ? "SAC" : "PRICE";
  const prazoFinanciamento = Math.max(1, Math.round(input.prazoFinanciamento));
  const posObra = parcelasAmortizacao(saldoLiberado, taxaMensal, prazoFinanciamento, sistemaAmortizacao, seguroTarifaMensal, Math.max(mesesAposObra, 1));
  const ateVenda = posObra.slice(0, mesesAposObra);
  const jurosPosObra = ateVenda.reduce((sum, item) => sum + item.juros + seguroTarifaMensal, 0);
  const amortizacaoEstimada = ateVenda.reduce((sum, item) => sum + item.amortizacao, 0);
  const prestacaoInicial = saldoLiberado > 0 ? posObra[0]?.parcela ?? 0 : 0;
  // Investidor: quem financia no próprio nome. Cada aporte tem um mês (0 = assinatura).
  const mesesObra = input.liberacoes.length;
  const mesVenda = mesesObra + mesesAposObra;
  // Lote próprio entra como capital pelo valor informado; a valorização dele paga IR na venda da casa pronta.
  const loteProprio = input.origemTerreno === "investidor" && agioLote > 0;
  const corretagemLoteValor = 0;
  const irGanhoLote = 0;
  const patrimonioTerreno = loteProprio ? agioLote : 0;
  // O banco e o FGTS só liberam após cada medição (Manual FGTS Moradia Própria, 8.5.2): para começar a obra
  // é preciso caixa de 10% da construção. Para morar, a entrada em dinheiro que sobra depois de completar o
  // lote já é esse caixa. Na venda, a entrada é só comprovação de recursos, a menos que a agência exija o depósito.
  const entradaDepositada = vender && input.entradaDepositada === true;
  const dinheiroEntradaNaObra = Math.max(dinheiroEntrada - saldoLoteNaoCoberto, 0);
  const entradaComoCaixa = !vender || entradaDepositada ? dinheiroEntradaNaObra : 0;
  const capitalGiro = Math.max((custoConstrucao + extrasTotal) * 0.1 - entradaComoCaixa, 0);
  // Venda: o que a obra real custa além do que o banco libera para ela sai do investidor, mês a mês, na
  // proporção das medições; se o banco libera mais do que a obra custa, a folga fica em caixa até a venda.
  // A remuneração do construtor é paga com a verba da obra, como a construção.
  const obraAlemFinanciamento = vender ? Math.max(custoObra + reservaLucro - financiamentoConstrucao, 0) : 0;
  const folgaFinanciamento = vender ? Math.max(financiamentoConstrucao - custoObra - reservaLucro, 0) : 0;
  const entradaAplicada = entradaDepositada ? Math.min(dinheiroEntradaNaObra, obraAlemFinanciamento) : 0;
  const obraAlemNovoDinheiro = obraAlemFinanciamento - entradaAplicada;
  // Dinheiro em mãos até a primeira medição.
  const dinheiroParaComecar = vender
    ? despesasPreContrato + despesasAssinatura + saldoLoteNaoCoberto + (entradaDepositada ? dinheiroEntradaNaObra : 0) + capitalGiro
    : desembolsoAntesContrato + desembolsoAssinatura + capitalGiro;
  const parcelaPosObra = mesesAposObra > 0 ? (jurosPosObra + amortizacaoEstimada) / mesesAposObra : 0;
  const aportesInvestidor: InvestorFlow[] = [
    { mes: 0, rotulo: "Terreno", valor: patrimonioTerreno, patrimonio: true },
    { mes: 0, rotulo: "Despesas antes da obra e na assinatura", valor: despesasPreContrato + despesasAssinatura },
    { mes: 0, rotulo: "Terreno: parte que o banco não paga", valor: saldoLoteNaoCoberto },
    { mes: 0, rotulo: "Entrada depositada aplicada na obra", valor: entradaAplicada },
    { mes: 0, rotulo: "Entrada depositada (volta no fim da obra)", valor: entradaDepositada ? dinheiroEntradaNaObra - entradaAplicada : 0, retornoMes: mesesObra },
    { mes: 0, rotulo: "Caixa para começar (10% da obra)", valor: capitalGiro, retornoMes: mesesObra },
    ...input.liberacoes.map((item) => ({ mes: item.mes, rotulo: "Obra além do financiamento", valor: obraAlemNovoDinheiro * item.percentual / 100 })),
    ...liberacoesMensais.map((item) => ({ mes: item.mes, rotulo: "Juros de obra", valor: item.encargo })),
    ...Array.from({ length: mesesAposObra }, (_, index) => ({ mes: mesesObra + index + 1, rotulo: "Parcelas até a venda", valor: parcelaPosObra })),
  ].filter((flow) => flow.valor > 0.005);
  const capitalAportadoInvestidor = aportesInvestidor.reduce((sum, flow) => sum + flow.valor, 0);
  // Capital que volta só na venda (o caixa inicial e a entrada não usada retornam ao fim da obra).
  const capitalDevolvidoVenda = aportesInvestidor.filter((flow) => flow.retornoMes === undefined).reduce((sum, flow) => sum + flow.valor, 0);
  // Maior volume de dinheiro do investidor aplicado ao mesmo tempo: é quanto ele precisa ter disponível
  // (o lote próprio fica de fora: já é dele e não precisa ser separado em dinheiro).
  const fluxosDinheiro = aportesInvestidor.filter((flow) => !flow.patrimonio);
  let acumulado = 0;
  let capitalMaximo = 0;
  for (let mes = 0; mes <= mesVenda; mes++) {
    acumulado += fluxosDinheiro.filter((flow) => flow.mes === mes).reduce((sum, flow) => sum + flow.valor, 0);
    capitalMaximo = Math.max(capitalMaximo, acumulado);
    acumulado -= fluxosDinheiro.filter((flow) => flow.retornoMes === mes).reduce((sum, flow) => sum + flow.valor, 0);
  }
  const temInvestidor = vender && input.temInvestidor !== false;
  const selicAnual = Math.max(input.selicAnual, 0);
  const aliquotaIr = irAliquota(mesVenda);
  const selicLiquida = selicAnual * (1 - aliquotaIr / 100);
  const taxaPreferencial = temInvestidor ? selicLiquida + Math.max(input.premioInvestidor, 0) : 0;
  const taxaPreferencialMensal = Math.pow(1 + taxaPreferencial / 100, 1 / 12) - 1;
  const retornoPreferencial = aportesInvestidor.reduce(
    (sum, flow) => sum + flow.valor * (Math.pow(1 + taxaPreferencialMensal, (flow.retornoMes ?? mesVenda) - flow.mes) - 1),
    0,
  );
  const recebimentoConstrutorLote = input.origemTerreno === "construtor" ? input.terreno : 0;
  const participacaoInvestidor = temInvestidor ? Math.min(100, Math.max(0, input.participacaoInvestidor)) : 0;
  // Na venda, o banco recebe o saldo devedor e a folga do financiamento volta ao caixa. O vendedor paga
  // corretagem, IR sobre o ganho de capital e as despesas da venda; ITBI e registro são do comprador.
  const dividaNaVenda = Math.max(saldoLiberado - amortizacaoEstimada, 0);
  const despesasVenda = soma(input.despesas.filter((item) => item.categoria === "Na venda"));
  // Custo de aquisição para o IR (IN SRF 84/2001, art. 17): lote (preço pago), ITBI e registro, construção com
  // projeto aprovado (inclui a remuneração do construtor), demais despesas comprovadas e juros pagos.
  const relacionamento = input.despesas.filter((item) => item.id === "relacionamento").reduce((sum, item) => sum + item.valor, 0);
  const baseLote = input.origemTerreno === "investidor" && input.custoAquisicaoLote > 0 ? input.custoAquisicaoLote : input.terreno;
  const custoAquisicaoItens = [
    { mes: 0, valor: baseLote + despesasPreContrato + despesasAssinatura - relacionamento },
    ...input.liberacoes.map((item) => ({ mes: item.mes, valor: (custoObra + reservaLucro) * item.percentual / 100 })),
    ...liberacoesMensais.map((item) => ({ mes: item.mes, valor: item.encargo })),
    ...ateVenda.map((item, index) => ({ mes: mesesObra + index + 1, valor: item.juros + seguroTarifaMensal })),
  ];
  const custoAquisicaoIr = custoAquisicaoItens.reduce((sum, item) => sum + item.valor, 0);
  // Fator de redução ponderado pelo mês de cada gasto (o lote conta desde a assinatura: estimativa conservadora).
  const fatorReducao = custoAquisicaoIr > 0
    ? custoAquisicaoItens.reduce((sum, item) => sum + item.valor * fatorReducaoFr2(mesVenda - item.mes), 0) / custoAquisicaoIr
    : 1;
  const ganhoCapital = (venda: number) => Math.max(venda * (1 - taxaCorretagem) - custoAquisicaoIr, 0);
  const irNaVenda = (venda: number) => (vender ? irGanhoCapital(ganhoCapital(venda) * fatorReducao) : 0);
  const caixaSemVenda = folgaFinanciamento - dividaNaVenda - capitalDevolvidoVenda - despesasVenda;
  const lucroNaVenda = (venda: number) => venda * (1 - taxaCorretagem) - irNaVenda(venda) + caixaSemVenda;
  // O lucro cresce com o preço (o IR leva no máximo 22,5% do ganho): acha o preço por bisseção.
  const precoPara = (lucro: number) => {
    let baixo = 0;
    let alto = Math.max(1, (lucro - caixaSemVenda) / Math.max(1 - taxaCorretagem, 0.01) * 2 + 1);
    for (let i = 0; i < 100; i++) {
      const meio = (baixo + alto) / 2;
      if (lucroNaVenda(meio) < lucro) baixo = meio;
      else alto = meio;
    }
    return alto;
  };
  // Preço sugerido: o lucro da venda precisa pagar o retorno mínimo do investidor e deixar ao construtor o lucro
  // desejado depois de o investidor levar a parte dele no excedente. Sem parceiro, o lucro todo é do construtor.
  const lucroAlvoConstrutor = vender ? Math.max(input.lucroConstrutor ?? 0, 0) : 0;
  const lucroNecessario = !temInvestidor
    ? lucroAlvoConstrutor
    : retornoPreferencial + (participacaoInvestidor < 100 ? lucroAlvoConstrutor / (1 - participacaoInvestidor / 100) : 0);
  const precoSugerido = vender ? precoPara(lucroNecessario) : 0;
  // Referências internas (relatório do investidor): preço que só devolve o capital e o que paga o retorno mínimo.
  const precoEquilibrio = vender ? precoPara(0) : 0;
  const precoMinimo = vender ? precoPara(retornoPreferencial) : 0;
  const precoFixo = vender && (input.precoVenda ?? 0) > 0 ? input.precoVenda ?? 0 : 0;
  const valorVenda = vender ? precoFixo || precoSugerido : recursosUtilizaveis;
  const precoInformado = vender && custoM2 > 0;
  const precoParaLucroConstrutor = vender ? precoSugerido : null;
  // Conferência com o mercado: m² de casa pronta na região × área planejada.
  const precoMercadoEstimado = vender && (input.precoM2Mercado ?? 0) > 0 ? (input.precoM2Mercado ?? 0) * areaPlanejada : 0;
  const cenarios = [0, -QUEDA_PRECO_CENARIO].map((ajuste) => {
    const venda = valorVenda * (1 + ajuste);
    const corretagem = venda * taxaCorretagem;
    const ir = irNaVenda(venda);
    const saldo = lucroNaVenda(venda);
    // Cascata: 1) devolve o capital; 2) paga o retorno preferencial; 3) divide o excedente.
    const preferencialPago = Math.min(Math.max(saldo, 0), retornoPreferencial);
    const excedente = Math.max(saldo - retornoPreferencial, 0);
    const excedenteInvestidor = excedente * participacaoInvestidor / 100;
    // Sem parceiro, o construtor é quem financia: o resultado, positivo ou negativo, é todo dele.
    const lucroInvestidor = !temInvestidor ? 0 : saldo < 0 ? saldo : preferencialPago + excedenteInvestidor;
    const lucroConstrutor = !temInvestidor ? saldo : excedente - excedenteInvestidor;
    const fluxos = [
      ...aportesInvestidor.map((flow) => ({ mes: flow.mes, valor: -flow.valor })),
      ...aportesInvestidor.filter((flow) => flow.retornoMes !== undefined).map((flow) => ({ mes: flow.retornoMes ?? 0, valor: flow.valor })),
      { mes: mesVenda, valor: capitalDevolvidoVenda + lucroInvestidor },
    ];
    const tirMensal = capitalAportadoInvestidor > 0 ? irr(fluxos) : null;
    const rentabilidade = tirMensal === null ? null : (Math.pow(1 + tirMensal, 12) - 1) * 100;
    return {
      nome: ajuste === 0 ? "Venda como esperado" : `Venda ${Math.round(QUEDA_PRECO_CENARIO * 100)}% abaixo`, ajuste, atraso: 0,
      venda, corretagem, ir, saldo, preferencialPago, excedente, lucroInvestidor, lucroConstrutor, mesVenda,
      // Ganho total do construtor: remuneração (paga durante a obra) + parte no lucro da venda.
      ganhoConstrutor: reservaLucro + lucroConstrutor,
      rentabilidadeInvestidor: rentabilidade,
      superaSelic: rentabilidade === null ? null : rentabilidade >= selicLiquida,
    };
  });
  const lucroOperacao = vender ? lucroNaVenda(valorVenda) : reservaLucro;
  return {
    areaViavel, areaViavelMinima, areaViavelMaxima, areaPlanejada, aporteParaAreaPlanejada, custoM2,
    maoDeObra: input.maoDeObra, materiais: input.materiais,
    cubReferenciaValor: input.cub, cubMaisDez: input.cub * 1.1,
    extrasTotal, despesasTotal, despesasPreContrato, despesasAssinatura, despesasObra, despesas: input.despesas,
    saldoRecursos, disponivel, custoObra, custoConstrucao, custoTotal, custoComTerreno, jurosObra,
    valorVenda, corretagemPercentual: input.corretagem, corretagemValor: valorVenda * taxaCorretagem,
    lucroDesejado: lucroOperacao, mesesAposObra, precoInformado, custoImovel, remuneracaoDetalhe,
    despesasVenda, custoAquisicaoIr, fatorReducao, irVenda: vender ? irNaVenda(valorVenda) : 0, ganhoCapitalVenda: vender ? ganhoCapital(valorVenda) : 0,
    precoEquilibrio, precoMinimo, precoParaLucroConstrutor, lucroAlvoConstrutor, precoSugerido, precoMercadoEstimado, temInvestidor, entradaDepositada,
    obraAlemFinanciamento, folgaFinanciamento, entradaAplicada, dividaNaVenda, capitalMaximo, jurosPosObra, amortizacaoEstimada,
    parcelasEstimadas: jurosPosObra + amortizacaoEstimada,
    capitalAportadoInvestidor, capitalDevolvidoVenda, capitalGiro, dinheiroParaComecar, patrimonioTerreno, aportesInvestidor, participacaoInvestidor, cenarios,
    origemTerreno: input.origemTerreno, selicAnual, aliquotaIr, selicLiquida, premioInvestidor: input.premioInvestidor,
    taxaPreferencial, retornoPreferencial, mesVenda, recebimentoConstrutorLote,
    corretagemLoteValor, ganhoCapitalLote: 0, irGanhoLote,
    lucroConstrutorDesejado: lucroAlvoConstrutor > 0 ? lucroAlvoConstrutor : null,
    construtorSemExcedente: vender && temInvestidor && participacaoInvestidor >= 100,
    terreno: input.terreno, saldoDevedor, credito, valorOperacao, entradaExigida,
    agioLote, agioNaEntrada, fgtsUtilizado, fgtsNaEntrada, dinheiroEntrada,
    limiteFinanciavelLote, loteContrato, obraContrato, redistribuicaoContrato,
    quitacaoLote, saldoLoteNaoCoberto, complementoLote, orcamentoObraContrato,
    financiamentoConstrucao, financiamentoExcedente, recursosUtilizaveis,
    desembolsoAntesContrato, desembolsoAssinatura, desembolsoDuranteObra, desembolsoProprio, maiorEncargoMensal,
    taxaJurosAnual: input.jurosAnuais, taxaJurosMensalEquivalente: taxaMensalPercentual,
    trMensal: input.trMensal, seguroTarifaMensal, jurosObraJuros, jurosObraTr, jurosObraSeguros, dividaFinal: saldoLiberado, prestacaoInicial, sistemaAmortizacao, prazoFinanciamento, remuneracaoResponsavel: reservaLucro,
    prazoExecucaoMeses: input.liberacoes.length, liberacoesMensais,
    cronograma: input.stages.map((stage) => ({ ...stage, valor: financiamentoConstrucao * stage.percentual / 100 })),
  };
}

// Semáforo do resumo em tempo real. Morar: prestação até 30% da renda e área dentro da verba.
// Vender: rendimento de quem financia acima da Selic líquida, inclusive vendendo 10% abaixo ou 6 meses depois.
export type SinalStatus = "verde" | "amarelo" | "vermelho" | "neutro";
type CenarioSinal = { saldo: number; rentabilidadeInvestidor: number | null };
export function sinalDaSimulacao(
  r: { custoM2: number; prestacaoInicial: number; aporteParaAreaPlanejada: number; precoInformado: boolean; selicLiquida: number; cenarios: CenarioSinal[] },
  objetivo: "morar" | "vender",
  renda: number,
): { status: SinalStatus; texto: string } {
  if (r.custoM2 <= 0) return { status: "neutro", texto: "Informe os custos da obra" };
  if (objetivo === "morar") {
    if (renda > 0 && (r.prestacaoInicial / renda) * 100 > 30) return { status: "vermelho", texto: "Prestação acima de 30% da renda" };
    if (r.aporteParaAreaPlanejada > 0.005) return { status: "amarelo", texto: "A área planejada pede dinheiro extra" };
    return { status: "verde", texto: "Cabe na verba e na renda" };
  }
  if (!r.precoInformado) return { status: "neutro", texto: "Informe o preço de venda" };
  const ruim = (c: CenarioSinal) => c.saldo < 0 || c.rentabilidadeInvestidor === null || c.rentabilidadeInvestidor < r.selicLiquida;
  const [esperado, ...outros] = r.cenarios;
  if (!esperado || ruim(esperado)) return { status: "vermelho", texto: "Rende menos que a Selic líquida" };
  if (outros.some(ruim)) return { status: "amarelo", texto: "Abaixo da Selic se a venda atrasar ou cair" };
  return { status: "verde", texto: "Rende acima da Selic, mesmo com imprevistos" };
}
