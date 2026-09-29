import { describe, expect, it } from "vitest";
import { annualToMonthlyRate, calculate, estimatedExpenses, pciReleases, suggestedExecutionMonths, type SimulationInput } from "./finance";
import { registroEstimate } from "./emolumentos";

const input: SimulationInput = {
  credito: 400000, terreno: 200000, saldoDevedor: 100000,
  valorImovel: 500000, aporteProprioObra: 0, fgtsUtilizado: 20000, percentualFinanciavelLote: 80,
  cub: 2500, maoDeObra: 1000, materiais: 1000, areaPlanejada: 120,
  extras: [], objetivo: "vender", lucro: 30000, corretagem: 5,
  prazo: 0, jurosAnuais: 10, stages: [], liberacoes: pciReleases(6),
  despesas: [{ id: "projetos", categoria: "Despesas iniciais", nome: "Projetos", valor: 10000, fonte: "Estimativa", observacao: "" }],
  participacaoInvestidor: 50,
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
    const result = calculate({ ...input, saldoDevedor: 190000 });
    expect(result.agioNaEntrada).toBe(10000);
    expect(result.fgtsNaEntrada).toBe(20000);
    expect(result.dinheiroEntrada).toBe(70000);
    expect(result.quitacaoLote).toBe(160000);
    expect(result.saldoLoteNaoCoberto).toBe(30000);
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
    expect(result.liberacoesMensais[0]?.encargo).toBe(0);
  });

  it("atualiza o preço com projetos, lucro e área sem duplicar honorários", () => {
    const initial = calculate(input);
    const extra = calculate({ ...input, despesas: input.despesas.map((item) => ({ ...item, valor: item.valor + 5000 })) });
    expect(extra.valorVenda - initial.valorVenda).toBeCloseTo(5000 / 0.95);
    expect(calculate({ ...input, lucro: 35000 }).valorVenda - initial.valorVenda).toBeCloseTo(5000 / 0.95);
    expect(calculate({ ...input, areaPlanejada: 125 }).valorVenda - initial.valorVenda).toBeCloseTo(10000 / 0.95);
    expect(initial.capitalAportadoInvestidor).toBeCloseTo(10000 + 120 * 2000 * 0.1);
    expect(estimatedExpenses(0, 0, 0, 0, 0, 0, 100).find((item) => item.id === "alvara")?.valor).toBe(252);
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
    expect(registroEstimate("SP", 100000, false).oficial).toBe(false);
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