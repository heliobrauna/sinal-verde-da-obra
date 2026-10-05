import { describe, expect, it } from "vitest";
import { annualToMonthlyRate, calculate, estimatedExpenses, parcelasAmortizacao, pciReleases, suggestedExecutionMonths, type SimulationInput } from "./finance";
import { registroEstimate } from "./emolumentos";

const input: SimulationInput = {
  credito: 400000, terreno: 200000, saldoDevedor: 100000,
  valorImovel: 500000, fgtsUtilizado: 20000,
  cub: 2500, maoDeObra: 1000, materiais: 1000, areaPlanejada: 120,
  extras: [], objetivo: "vender", lucro: 30000, corretagem: 5,
  prazo: 0, jurosAnuais: 10, stages: [], liberacoes: pciReleases(6),
  despesas: [{ id: "projetos", categoria: "Despesas iniciais", nome: "Projetos", valor: 10000, fonte: "Estimativa", observacao: "" }],
  participacaoInvestidor: 50, origemTerreno: "investidor", selicAnual: 13.75, premioInvestidor: 5,
  corretagemLote: 0, custoAquisicaoLote: 0, lucroConstrutor: null, trMensal: 0, seguroTarifaMensal: 0,
  sistemaAmortizacao: "SAC", prazoFinanciamento: 360,
};

describe("projeção financeira", () => {
  it("deriva a entrada do valor do imóvel e compõe com ágio antes do dinheiro", () => {
    const result = calculate(input);
    expect(result.valorOperacao).toBe(500000);
    expect(result.entradaExigida).toBe(100000);
    expect(result.agioNaEntrada).toBe(100000);
    expect(result.fgtsNaEntrada).toBe(0);
    expect(result.dinheiroEntrada).toBe(0);
    expect(result.quitacaoLote).toBe(100000);
    expect(result.orcamentoObraContrato).toBe(300000);
    expect(result.financiamentoConstrucao).toBe(300000);
    expect(result.recursosUtilizaveis).toBe(300000);
    expect(result.liberacoesMensais.reduce((sum, month) => sum + month.liberacao, 0)).toBeCloseTo(300000);
  });

  it("usa FGTS e dinheiro só para completar a entrada que o ágio não cobre", () => {
    const result = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 190000 });
    expect(result.agioNaEntrada).toBe(10000);
    expect(result.fgtsNaEntrada).toBe(20000);
    expect(result.dinheiroEntrada).toBe(70000);
    // Limite de 30% de R$ 500 mil: o banco quita R$ 150 mil e R$ 40 mil saem da entrada em dinheiro.
    expect(result.limiteFinanciavelLote).toBe(150000);
    expect(result.quitacaoLote).toBe(150000);
    expect(result.saldoLoteNaoCoberto).toBe(40000);
    expect(result.complementoLote).toBe(0);
    expect(result.recursosUtilizaveis).toBe(300000);
    expect(result.desembolsoAssinatura).toBe(70000);
  });

  it("não libera para a obra mais que o orçamento quando o ágio supera a entrada", () => {
    const result = calculate({ ...input, saldoDevedor: 0 });
    expect(result.dinheiroEntrada).toBe(0);
    expect(result.financiamentoConstrucao).toBe(300000);
    expect(result.financiamentoExcedente).toBe(100000);
  });

  it("inclui o terreno no preço de venda e separa o desembolso do cliente", () => {
    const result = calculate(input);
    expect(result.valorVenda * 0.95 - result.custoTotal - input.lucro).toBeCloseTo(input.terreno);
    expect(result.cenarios[1]?.saldo).toBeCloseTo(input.lucro);
    expect(result.desembolsoAntesContrato).toBe(10000);
    expect(result.desembolsoDuranteObra).toBeCloseTo(result.jurosObra);
  });

  it("converte taxa anual por equivalência composta e oferece áreas mínima e máxima", () => {
    const result = calculate(input);
    expect(annualToMonthlyRate(10)).toBeCloseTo(0.797414, 5);
    expect(result.areaViavelMinima).toBeCloseTo(result.areaViavelMaxima / 1.18);
    expect(result.jurosObra).toBeGreaterThan(0);
  });

  it("atualiza o preço com projetos, lucro e área sem duplicar honorários", () => {
    const initial = calculate(input);
    const extra = calculate({ ...input, despesas: input.despesas.map((item) => ({ ...item, valor: item.valor + 5000 })) });
    expect(extra.valorVenda - initial.valorVenda).toBeCloseTo(5000 / 0.95);
    expect(calculate({ ...input, lucro: 35000 }).valorVenda - initial.valorVenda).toBeCloseTo(5000 / 0.95);
    expect(calculate({ ...input, areaPlanejada: 125 }).valorVenda - initial.valorVenda).toBeCloseTo(10000 / 0.95);
    expect(estimatedExpenses(0, 0, 0, 0, 0, 0, 100).find((item) => item.id === "alvara")?.valor).toBe(252);
  });

  it("exige caixa de 10% da obra para começar; o FGTS da entrada só sai com as medições", () => {
    // Lote quitado de R$ 150 mil cobre R$ 100 mil da entrada; nada a comprovar em dinheiro.
    const quitado = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 0, terreno: 150000 });
    expect(quitado.dinheiroEntrada).toBe(0);
    expect(quitado.capitalGiro).toBeCloseTo((quitado.custoConstrucao + quitado.extrasTotal) * 0.1);
    expect(quitado.dinheiroParaComecar).toBeCloseTo(quitado.desembolsoAntesContrato + quitado.desembolsoAssinatura + quitado.capitalGiro);
    // Ágio de R$ 50 mil + FGTS de R$ 20 mil + R$ 30 mil em dinheiro: só o dinheiro reduz o caixa inicial.
    const misto = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 100000, terreno: 150000, fgtsUtilizado: 20000, areaPlanejada: 200 });
    expect(misto.fgtsNaEntrada).toBe(20000);
    expect(misto.dinheiroEntrada).toBe(30000);
    expect(misto.capitalGiro).toBeCloseTo((misto.custoConstrucao + misto.extrasTotal) * 0.1 - 30000);
  });

  it("não usa FGTS em obra para vender", () => {
    const venda = calculate({ ...input, saldoDevedor: 150000, fgtsUtilizado: 50000 });
    expect(venda.fgtsUtilizado).toBe(0);
    expect(venda.fgtsNaEntrada).toBe(0);
    expect(venda.dinheiroEntrada).toBe(venda.entradaExigida - venda.agioNaEntrada);
    const morar = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 150000, fgtsUtilizado: 50000 });
    expect(morar.fgtsNaEntrada).toBe(50000);
  });

  it("data o capital do investidor e divide o lucro em cascata", () => {
    const result = calculate(input);
    // Patrimônio do lote + despesas pré-obra + 10% da obra + juros de obra.
    expect(result.capitalAportadoInvestidor).toBeCloseTo(100000 + 10000 + 24000 + result.jurosObra);
    expect(result.capitalGiro).toBe(24000);
    const realista = result.cenarios[1]!;
    expect(realista.lucroInvestidor + realista.lucroConstrutor).toBeCloseTo(realista.saldo);
    expect(realista.preferencialPago).toBeCloseTo(Math.min(realista.saldo, result.retornoPreferencial));
    expect(realista.lucroConstrutor).toBeCloseTo(Math.max(realista.saldo - result.retornoPreferencial, 0) / 2);
  });

  it("com participação zero, o investidor rende exatamente a taxa preferencial", () => {
    const result = calculate({ ...input, participacaoInvestidor: 0, lucro: 200000 });
    expect(result.aliquotaIr).toBe(22.5);
    expect(result.selicLiquida).toBeCloseTo(13.75 * 0.775);
    expect(result.cenarios[1]?.rentabilidadeInvestidor).toBeCloseTo(result.taxaPreferencial, 1);
  });

  it("trata lote comprado na operação sem ágio e sem patrimônio do investidor", () => {
    const result = calculate({ ...input, origemTerreno: "compra" });
    expect(result.agioLote).toBe(0);
    expect(result.patrimonioTerreno).toBe(0);
    // Venda não usa FGTS: a entrada inteira vem de dinheiro.
    expect(result.fgtsNaEntrada).toBe(0);
    expect(result.dinheiroEntrada).toBe(100000);
    const sem = estimatedExpenses(100000, 400000, 0, 0, 0, 2500, 100, "SP", false, false);
    expect(sem.find((item) => item.id === "itbi")?.valor).toBe(0);
    expect(sem.find((item) => item.id === "registro-compra")?.valor).toBe(0);
  });

  it("conta o lote próprio pelo valor líquido de corretagem e IR sobre o ganho", () => {
    const result = calculate({ ...input, corretagemLote: 5, custoAquisicaoLote: 120000 });
    expect(result.corretagemLoteValor).toBe(10000);
    expect(result.irGanhoLote).toBeCloseTo((200000 - 10000 - 120000) * 0.15);
    expect(result.patrimonioTerreno).toBeCloseTo(100000 - 10000 - 10500);
  });

  it("forma o preço para o construtor ganhar o valor desejado no cenário realista", () => {
    const result = calculate({ ...input, lucroConstrutor: 40000, prazo: 6 });
    const realista = result.cenarios[1]!;
    expect(realista.lucroConstrutor).toBeCloseTo(40000, 0);
    expect(realista.lucroInvestidor).toBeCloseTo(result.retornoPreferencial + 40000, 0);
    expect(result.lucroDesejado).toBeCloseTo(result.jurosPosObra + result.retornoPreferencial + 80000, 0);
    expect(realista.superaSelic).toBe(true);
  });

  it("na venda, o lucro vem do preço e não reduz a área viável; para morar, é reservado da verba", () => {
    expect(calculate({ ...input, lucro: 90000 }).areaViavelMaxima).toBeCloseTo(calculate({ ...input, lucro: 0 }).areaViavelMaxima);
    const morar = (lucro: number) => calculate({ ...input, objetivo: "morar", lucro }).areaViavelMaxima;
    expect(morar(0) - morar(20000)).toBeCloseTo(20000 / 2000);
  });

  it("usa todos os recursos operacionais, sem reserva fixa", () => {
    const result = calculate({ ...input, despesas: [], lucro: 0 });
    expect(result.disponivel).toBeCloseTo(result.recursosUtilizaveis);
    expect(result.areaViavelMaxima).toBeCloseTo(result.disponivel / 2000);
    expect(result.saldoRecursos).toBeCloseTo(result.recursosUtilizaveis - result.custoObra);
  });

  it("aplica o desconto do SFH e a tabela oficial do CE nos registros", () => {
    const despesas = (sfh: boolean) => estimatedExpenses(100000, 400000, 0, 0, 0, 2500, 100, "CE", sfh);
    const valor = (items: ReturnType<typeof despesas>, id: string) => items.find((item) => item.id === id)?.valor ?? 0;
    // Faixa até R$ 6.917,21: emolumento R$ 472,51, total R$ 600,22 na tabela do TJCE.
    expect(registroEstimate("CE", 5000, false).valor).toBeCloseTo(600.22, 1);
    expect(valor(despesas(true), "registro-compra")).toBeCloseTo(valor(despesas(false), "registro-compra") / 2, 2);
    expect(valor(despesas(true), "alienacao")).toBeCloseTo(valor(despesas(false), "alienacao") / 2, 2);
    expect(registroEstimate("XX", 100000, false).oficial).toBe(false);
  });

  it("cobra encargos de obra sobre o lote quitado na assinatura, somando TR, juros e seguros", () => {
    const result = calculate({ ...input, trMensal: 0.15, seguroTarifaMensal: 80 });
    const i = annualToMonthlyRate(10) / 100;
    // Mês 1: só o lote (R$ 100 mil) já é dívida; a 1ª parcela da obra é liberada ao fim do mês.
    const mes1 = result.liberacoesMensais[0]!;
    expect(mes1.saldoBase).toBe(100000);
    expect(mes1.encargo).toBeCloseTo(100000 * 0.0015 + 100000 * 1.0015 * i + 80);
    // Mês 2 já inclui a 1ª liberação da obra.
    expect(result.liberacoesMensais[1]?.saldoBase).toBeCloseTo(100000 + result.liberacoesMensais[0]!.liberacao);
    expect(result.dividaFinal).toBeCloseTo(400000);
    expect(result.jurosObra).toBeCloseTo(result.jurosObraJuros + result.jurosObraTr + result.jurosObraSeguros);
  });

  it("sem lote financiado, o primeiro mês só paga seguros e tarifa", () => {
    const result = calculate({ ...input, saldoDevedor: 0, seguroTarifaMensal: 80 });
    expect(result.liberacoesMensais[0]?.encargo).toBe(80);
  });

  it("sugere redistribuir lote e obra no contrato só quando o saldo passa de 80% do lote", () => {
    const acima = calculate({ ...input, terreno: 150000, saldoDevedor: 135000 });
    expect(acima.quitacaoLote).toBe(135000);
    expect(acima.redistribuicaoContrato).toBe(true);
    expect(acima.loteContrato).toBeCloseTo(135000 / 0.8);
    expect(acima.obraContrato).toBeCloseTo(500000 - 135000 / 0.8);
    const dentro = calculate({ ...input, terreno: 150000, saldoDevedor: 100000 });
    expect(dentro.redistribuicaoContrato).toBe(false);
    expect(dentro.loteContrato).toBe(150000);
    expect(dentro.obraContrato).toBe(350000);
  });

  it("estima a primeira prestação depois da obra sobre a dívida inteira, sem TR", () => {
    const i = annualToMonthlyRate(10) / 100;
    const sac = calculate({ ...input, trMensal: 0.15, seguroTarifaMensal: 80 });
    expect(sac.prestacaoInicial).toBeCloseTo(400000 / 360 + 400000 * i + 80);
    const price = calculate({ ...input, trMensal: 0.15, seguroTarifaMensal: 80, sistemaAmortizacao: "PRICE", prazoFinanciamento: 420 });
    expect(price.prestacaoInicial).toBeCloseTo(400000 * i / (1 - Math.pow(1 + i, -420)) + 80);
  });

  it("reproduz a parcela PRICE do simulador da Caixa (R$ 217,6 mil, 8,47% a.a., 420 meses)", () => {
    const i = annualToMonthlyRate(8.47) / 100;
    const [primeira] = parcelasAmortizacao(217600, i, 420, "PRICE", 0, 1);
    expect(primeira!.parcela).toBeGreaterThan(1550);
    expect(primeira!.parcela).toBeLessThan(1600);
    // No PRICE a parcela é constante; no SAC a amortização é que é constante.
    const price = parcelasAmortizacao(217600, i, 420, "PRICE", 0, 3);
    expect(price[2]!.parcela).toBeCloseTo(price[0]!.parcela);
    const sac = parcelasAmortizacao(217600, i, 420, "SAC", 0, 3);
    expect(sac[2]!.amortizacao).toBeCloseTo(217600 / 420);
  });

  it("pré-preenche PCI até 320 m² e sugere 18 meses acima dessa área", () => {
    expect(suggestedExecutionMonths(70)).toBe(6);
    expect(suggestedExecutionMonths(320)).toBe(13);
    expect(suggestedExecutionMonths(321)).toBe(18);
    for (const months of [6, 7, 8, 9, 10, 11, 12, 13, 18]) {
      expect(pciReleases(months).reduce((sum, item) => sum + item.percentual, 0)).toBeCloseTo(100);
    }
  });
});