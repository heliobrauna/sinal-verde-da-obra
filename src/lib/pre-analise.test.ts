import { describe, expect, it } from "vitest";
import { annualToMonthlyRate, parcelasAmortizacao } from "./finance";
import { faixaPorRenda, financiamentoPorParcela, jurosSugeridos, preAnalise, prazoMaximoPorIdade, type PreAnaliseInput } from "./pre-analise";

const base: PreAnaliseInput = {
  rendaFormal: 6000, rendaInformal: 0, idade: 30, cotistaFgts: false, fgts: 0, dinheiro: 1_000_000,
  terreno: 0, terrenoProprio: false, sistema: "PRICE", jurosAnuais: null, seguroTarifaMensal: 100, custoM2: 0,
};

describe("pré-análise pela renda", () => {
  it("enquadra a renda nas faixas de 2026", () => {
    expect(faixaPorRenda(3200).id).toBe("1");
    expect(faixaPorRenda(3200.01).id).toBe("2");
    expect(faixaPorRenda(9600).id).toBe("3");
    expect(faixaPorRenda(13000).id).toBe("4");
    expect(faixaPorRenda(13000.01).id).toBe("sbpe");
    expect(jurosSugeridos(faixaPorRenda(8000), true)).toBeCloseTo(7.16);
    expect(jurosSugeridos(faixaPorRenda(12000), true)).toBe(10);
  });

  it("limita o prazo pela idade (até 80 anos e 6 meses)", () => {
    expect(prazoMaximoPorIdade(30)).toBe(420);
    expect(prazoMaximoPorIdade(50)).toBe(366);
    expect(prazoMaximoPorIdade(81)).toBe(0);
  });

  it("a dívida máxima gera exatamente a parcela máxima no PRICE e no SAC", () => {
    const taxa = annualToMonthlyRate(10) / 100;
    for (const sistema of ["PRICE", "SAC"] as const) {
      const divida = financiamentoPorParcela(3000, taxa, 420, sistema, 100);
      expect(parcelasAmortizacao(divida, taxa, 420, sistema, 100, 1)[0]!.parcela).toBeCloseTo(3000, 6);
    }
  });

  it("com entrada sobrando, o imóvel é a capacidade de financiamento / 80%", () => {
    const r = preAnalise(base);
    expect(r.limitadoPor).toBe("renda");
    expect(r.financiamento).toBeCloseTo(r.capacidade, 6);
    expect(r.valorImovel).toBeCloseTo(r.capacidade / 0.8, 6);
    expect(r.prestacao).toBeCloseTo(1800, 6);
    expect(r.dinheiroNaEntrada).toBeCloseTo(r.valorImovel * 0.2, 6);
  });

  it("com pouca entrada, o imóvel fica em 5 vezes os recursos e a prestação cai", () => {
    const r = preAnalise({ ...base, dinheiro: 20_000, fgts: 10_000 });
    expect(r.limitadoPor).toBe("entrada");
    expect(r.valorImovel).toBeCloseTo(150_000, 6);
    expect(r.fgtsNaEntrada).toBeCloseTo(10_000, 6);
    expect(r.dinheiroNaEntrada).toBeCloseTo(20_000, 6);
    expect(r.prestacao).toBeLessThan(1800);
  });

  it("lote próprio forma a entrada e o banco financia só a obra", () => {
    const r = preAnalise({ ...base, rendaFormal: 15000, dinheiro: 0, terreno: 200_000, terrenoProprio: true, custoM2: 2500 });
    expect(r.limitadoPor).toBe("renda");
    expect(r.valorImovel).toBeCloseTo(r.capacidade + 200_000, 6);
    expect(r.financiamento).toBeCloseTo(r.capacidade, 6);
    expect(r.agioNaEntrada).toBe(200_000);
    expect(r.area).toBeCloseTo(r.capacidade / 2500, 6);
  });

  it("respeita o teto do imóvel da faixa", () => {
    const r = preAnalise({ ...base, rendaFormal: 3000 });
    expect(r.faixa.id).toBe("1");
    expect(r.valorImovel).toBeLessThanOrEqual(270_000);
    const alta = preAnalise({ ...base, rendaFormal: 9000, rendaInformal: 600, jurosAnuais: 1 });
    expect(alta.limitadoPor).toBe("faixa");
    expect(alta.valorImovel).toBe(400_000);
  });
});
