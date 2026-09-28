import { describe, expect, it } from "vitest";
import { annualToMonthlyRate, calculate, pciReleases, suggestedExecutionMonths, type SimulationInput } from "./finance";

const input: SimulationInput = {
  credito: 400000, terreno: 200000, saldoDevedor: 100000,
  entradaDinheiro: 50000, fgtsUtilizado: 20000, percentualFinanciavelLote: 80,
  cub: 2500, maoDeObra: 1000, materiais: 1000, areaPlanejada: 120,
  extras: [], objetivo: "vender", lucro: 30000, corretagem: 5,
  prazo: 0, jurosAnuais: 10, stages: [], liberacoes: pciReleases(6),
  despesas: [{ id: "projetos", categoria: "Despesas iniciais", nome: "Projetos", valor: 10000, fonte: "Estimativa", observacao: "" }],
  participacaoInvestidor: 50,
};

describe("projeção financeira", () => {
  it("separa ágio e quitação do lote das liberações de construção", () => {
    const result = calculate(input);
    expect(result.agioLote).toBe(100000);
    expect(result.entradaTotalReconhecida).toBe(170000);
    expect(result.quitacaoLote).toBe(100000);
    expect(result.financiamentoConstrucao).toBe(300000);
    expect(result.liberacoesMensais.reduce((sum, month) => sum + month.liberacao, 0)).toBeCloseTo(300000);
    expect(result.entradaLivreInicioObra).toBe(40000);
  });

  it("não transforma saldo não coberto em verba para obra", () => {
    const result = calculate({ ...input, saldoDevedor: 190000 });
    expect(result.quitacaoLote).toBe(160000);
    expect(result.saldoLoteNaoCoberto).toBe(30000);
    expect(result.recursosUtilizaveis).toBe(280000);
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
    expect(initial.capitalAportadoInvestidor).toBeCloseTo(10000 + initial.jurosObra);
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