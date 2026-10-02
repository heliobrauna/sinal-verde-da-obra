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
export type OrigemTerreno = "investidor" | "construtor" | "compra";
type InvestorFlow = { mes: number; rotulo: string; valor: number; retornoMes?: number };

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
  // Na venda, quanto o construtor quer ganhar; null usa o lucro informado diretamente.
  lucroConstrutor: number | null;
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
): ClientExpense[] {
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
    { id: "itbi", categoria: "Assinatura do contrato", nome: "ITBI do lote", valor: transferenciaLote ? terreno * 0.02 : 0, fonte: "Prefeitura do município", observacao: "Estimativa de 2% apenas sobre o lote; a alíquota é municipal." },
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

// Parte do contrato que pode quitar o lote.
export const LIMITE_LOTE_CONTRATO = 0.3;
// Parte do lote e da obra que a Caixa financia.
const PERCENTUAL_FINANCIADO_PARTE = 0.8;

// Imposto de renda sobre ganho de capital de pessoa física (sem fatores de redução).
const IR_GANHO_CAPITAL = 0.15;

// Na venda com lucro do construtor definido, o lucro total precisa cobrir encargos até a venda,
// o retorno preferencial e as duas partes do excedente. Como o lucro também muda área e capital,
// o valor é encontrado por aproximações sucessivas.
export function calculate(input: SimulationInput) {
  if (input.objetivo !== "vender" || input.lucroConstrutor === null) return calcular(input);
  const lucroConstrutor = Math.max(input.lucroConstrutor, 0);
  const participacao = Math.min(100, Math.max(0, input.participacaoInvestidor));
  const excedenteNecessario = participacao < 100 ? lucroConstrutor / (1 - participacao / 100) : 0;
  let lucro = Math.max(input.lucro, 0);
  let result = calcular({ ...input, lucro });
  for (let i = 0; i < 40; i++) {
    const necessario = result.jurosPosObra + result.retornoPreferencial + excedenteNecessario;
    if (Math.abs(necessario - lucro) < 0.01) break;
    lucro = necessario;
    result = calcular({ ...input, lucro });
  }
  return {
    ...result,
    lucroConstrutorDesejado: lucroConstrutor,
    excedenteNecessario,
    construtorSemExcedente: participacao >= 100 && lucroConstrutor > 0,
  };
}

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
  const fgtsNaEntrada = Math.min(Math.max(input.fgtsUtilizado, 0), entradaExigida - agioNaEntrada);
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
  // Para morar, a remuneração do responsável sai da verba da obra; na venda, o lucro vem do preço.
  const reservaLucro = input.objetivo === "morar" ? Math.max(input.lucro, 0) : 0;
  const disponivel = Math.max(0, recursosUtilizaveis - extrasTotal - despesasObra - reservaLucro);
  const areaViavelMaxima = custoM2 > 0 ? disponivel / custoM2 : 0;
  const areaViavelMinima = custoM2 > 0 ? disponivel / (custoM2 * 1.18) : 0;
  const areaViavel = areaViavelMinima;
  const areaPlanejada = input.areaPlanejada > 0 ? input.areaPlanejada : areaViavelMinima;
  const custoConstrucao = areaPlanejada * custoM2;
  const custoObra = custoConstrucao + extrasTotal + despesasObra;
  const custoTotal = custoConstrucao + extrasTotal + despesasTotal + jurosObra;
  const custoComTerreno = custoTotal + input.terreno;
  // Positivo: sobra na verba da obra; negativo: aporte necessário para a área planejada.
  const saldoRecursos = recursosUtilizaveis - custoObra - reservaLucro;
  const aporteParaAreaPlanejada = Math.max(-saldoRecursos, 0);

  const desembolsoAntesContrato = despesasPreContrato;
  const desembolsoAssinatura = dinheiroEntrada + complementoLote + despesasAssinatura;
  // Área planejada acima da viável: a diferença sai do bolso do cliente.
  const desembolsoDuranteObra = jurosObra + aporteParaAreaPlanejada;
  const desembolsoProprio = desembolsoAntesContrato + desembolsoAssinatura + desembolsoDuranteObra;
  const maiorEncargoMensal = liberacoesMensais.reduce((max, item) => Math.max(max, item.encargo), 0);

  // Na venda, o terreno (ágio + saldo quitado) também precisa ser recuperado.
  const taxaCorretagem = input.objetivo === "vender" ? Math.min(Math.max(input.corretagem, 0), 99.99) / 100 : 0;
  const valorVenda = input.objetivo === "vender" ? (custoComTerreno + input.lucro) / (1 - taxaCorretagem) : recursosUtilizaveis;
  const mesesAposObra = Math.max(0, Math.floor(input.prazo));
  // Após a obra: juros e TR sobre a dívida inteira (lote + obra), mais seguros e tarifa, até a venda.
  const jurosPosObra = (saldoLiberado * (trMensal + (1 + trMensal) * taxaMensal) + seguroTarifaMensal) * mesesAposObra;
  const amortizacaoEstimada = Math.min(saldoLiberado, saldoLiberado / 360 * mesesAposObra);
  // Investidor: quem financia no próprio nome. Cada aporte tem um mês (0 = assinatura).
  const mesesObra = input.liberacoes.length;
  const mesVenda = mesesObra + mesesAposObra;
  // Lote próprio: vale o que o investidor receberia vendendo-o hoje (menos corretagem e IR sobre o ganho).
  const loteProprio = input.origemTerreno === "investidor" && agioLote > 0;
  const corretagemLoteValor = loteProprio ? input.terreno * Math.min(Math.max(input.corretagemLote, 0), 100) / 100 : 0;
  const ganhoCapitalLote = loteProprio && input.custoAquisicaoLote > 0 ? Math.max(input.terreno - corretagemLoteValor - input.custoAquisicaoLote, 0) : 0;
  const irGanhoLote = ganhoCapitalLote * IR_GANHO_CAPITAL;
  const patrimonioTerreno = loteProprio ? Math.max(agioLote - corretagemLoteValor - irGanhoLote, 0) : 0;
  // O banco e o FGTS só liberam após cada medição (Manual FGTS Moradia Própria, 8.5.2): para começar a obra
  // é preciso caixa de 10% da construção. A entrada em dinheiro que sobra depois de completar o lote já
  // é esse caixa; o FGTS não, porque também sai com as medições. O caixa inicial volta com as liberações.
  const dinheiroEntradaNaObra = Math.max(dinheiroEntrada - saldoLoteNaoCoberto, 0);
  const capitalGiro = Math.max((custoConstrucao + extrasTotal) * 0.1 - dinheiroEntradaNaObra, 0);
  // Dinheiro em mãos até a primeira medição: despesas antes do contrato, assinatura e caixa inicial da obra.
  const dinheiroParaComecar = desembolsoAntesContrato + desembolsoAssinatura + capitalGiro;
  const parcelaPosObra = mesesAposObra > 0 ? (jurosPosObra + amortizacaoEstimada) / mesesAposObra : 0;
  const aportesInvestidor: InvestorFlow[] = [
    { mes: 0, rotulo: "Terreno (valor líquido se vendido)", valor: patrimonioTerreno },
    { mes: 0, rotulo: "Entrada · FGTS", valor: fgtsNaEntrada },
    { mes: 0, rotulo: "Entrada · dinheiro", valor: dinheiroEntrada + complementoLote },
    { mes: 0, rotulo: "Despesas pré-obra", valor: despesasPreContrato + despesasAssinatura },
    { mes: 0, rotulo: "Aporte para a área planejada", valor: aporteParaAreaPlanejada },
    { mes: 0, rotulo: "Capital de giro inicial (10% da obra)", valor: capitalGiro, retornoMes: mesesObra },
    ...liberacoesMensais.map((item) => ({ mes: item.mes, rotulo: "Juros de obra", valor: item.encargo })),
    ...Array.from({ length: mesesAposObra }, (_, index) => ({ mes: mesesObra + index + 1, rotulo: "Parcelas até a venda", valor: parcelaPosObra })),
  ].filter((flow) => flow.valor > 0.005);
  const capitalAportadoInvestidor = aportesInvestidor.reduce((sum, flow) => sum + flow.valor, 0);
  // Capital que volta só na venda (o capital de giro retorna com as liberações, ao fim da obra).
  const capitalDevolvidoVenda = aportesInvestidor.filter((flow) => flow.retornoMes === undefined).reduce((sum, flow) => sum + flow.valor, 0);
  const selicAnual = Math.max(input.selicAnual, 0);
  const aliquotaIr = irAliquota(mesVenda);
  const selicLiquida = selicAnual * (1 - aliquotaIr / 100);
  const taxaPreferencial = selicLiquida + Math.max(input.premioInvestidor, 0);
  const taxaPreferencialMensal = Math.pow(1 + taxaPreferencial / 100, 1 / 12) - 1;
  const retornoPreferencial = aportesInvestidor.reduce(
    (sum, flow) => sum + flow.valor * (Math.pow(1 + taxaPreferencialMensal, (flow.retornoMes ?? mesVenda) - flow.mes) - 1),
    0,
  );
  const recebimentoConstrutorLote = input.origemTerreno === "construtor" ? input.terreno : 0;
  const participacaoInvestidor = Math.min(100, Math.max(0, input.participacaoInvestidor));
  const cenarios = [-0.15, 0, 0.15].map((ajuste, index) => {
    const venda = valorVenda * (1 + ajuste);
    const corretagem = venda * taxaCorretagem;
    // Lucro econômico: venda menos todos os custos, inclusive terreno e encargos até a venda.
    const saldo = venda - corretagem - custoComTerreno - jurosPosObra;
    // Cascata: 1) devolve o capital; 2) paga o retorno preferencial; 3) divide o excedente.
    const preferencialPago = Math.min(Math.max(saldo, 0), retornoPreferencial);
    const excedente = Math.max(saldo - retornoPreferencial, 0);
    const excedenteInvestidor = excedente * participacaoInvestidor / 100;
    const lucroInvestidor = saldo < 0 ? saldo : preferencialPago + excedenteInvestidor;
    const lucroConstrutor = excedente - excedenteInvestidor;
    const fluxos = [
      ...aportesInvestidor.map((flow) => ({ mes: flow.mes, valor: -flow.valor })),
      ...aportesInvestidor.filter((flow) => flow.retornoMes !== undefined).map((flow) => ({ mes: flow.retornoMes ?? 0, valor: flow.valor })),
      { mes: mesVenda, valor: capitalDevolvidoVenda + lucroInvestidor },
    ];
    const tirMensal = capitalAportadoInvestidor > 0 ? irr(fluxos) : null;
    return {
      nome: ["Pessimista", "Realista", "Otimista"][index], ajuste, venda, corretagem, saldo,
      preferencialPago, excedente, lucroInvestidor, lucroConstrutor,
      rentabilidadeInvestidor: tirMensal === null ? null : (Math.pow(1 + tirMensal, 12) - 1) * 100,
      superaSelic: tirMensal === null ? null : (Math.pow(1 + tirMensal, 12) - 1) * 100 >= selicLiquida,
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
    capitalAportadoInvestidor, capitalDevolvidoVenda, capitalGiro, dinheiroParaComecar, patrimonioTerreno, aportesInvestidor, participacaoInvestidor, cenarios,
    origemTerreno: input.origemTerreno, selicAnual, aliquotaIr, selicLiquida, premioInvestidor: input.premioInvestidor,
    taxaPreferencial, retornoPreferencial, mesVenda, recebimentoConstrutorLote,
    corretagemLoteValor, ganhoCapitalLote, irGanhoLote,
    lucroConstrutorDesejado: null as number | null, excedenteNecessario: 0, construtorSemExcedente: false,
    terreno: input.terreno, saldoDevedor, credito, valorOperacao, entradaExigida,
    agioLote, agioNaEntrada, fgtsUtilizado: input.fgtsUtilizado, fgtsNaEntrada, dinheiroEntrada,
    limiteFinanciavelLote, loteContrato, obraContrato, redistribuicaoContrato,
    quitacaoLote, saldoLoteNaoCoberto, complementoLote, orcamentoObraContrato,
    financiamentoConstrucao, financiamentoExcedente, recursosUtilizaveis,
    desembolsoAntesContrato, desembolsoAssinatura, desembolsoDuranteObra, desembolsoProprio, maiorEncargoMensal,
    taxaJurosAnual: input.jurosAnuais, taxaJurosMensalEquivalente: taxaMensalPercentual,
    trMensal: input.trMensal, seguroTarifaMensal, jurosObraJuros, jurosObraTr, jurosObraSeguros, dividaFinal: saldoLiberado,
    prazoExecucaoMeses: input.liberacoes.length, liberacoesMensais,
    cronograma: input.stages.map((stage) => ({ ...stage, valor: financiamentoConstrucao * stage.percentual / 100 })),
  };
}
