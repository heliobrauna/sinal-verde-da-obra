import { describe, expect, it } from "vitest";
import { irGanhoCapital, fatorReducaoFr2, annualToMonthlyRate, calculate, estimatedExpenses, parcelasAmortizacao, pciReleases, suggestedExecutionMonths, type SimulationInput } from "./finance";
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
    // O FGTS paga R$ 20 mil do lote na assinatura; o banco quita R$ 150 mil (30% de R$ 500 mil) e R$ 20 mil saem da entrada em dinheiro.
    expect(result.fgtsNoLote).toBe(20000);
    expect(result.limiteFinanciavelLote).toBe(150000);
    expect(result.quitacaoLote).toBe(150000);
    expect(result.saldoLoteNaoCoberto).toBe(20000);
    expect(result.complementoLote).toBe(0);
    expect(result.recursosUtilizaveis).toBe(300000);
    expect(result.desembolsoAssinatura).toBe(70000);
  });

  it("FGTS paga o lote antes do banco: dívida menor na assinatura e menos juros de obra", () => {
    const sem = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 150000, fgtsUtilizado: 0 });
    const com = calculate({ ...input, objetivo: "morar", lucro: 0, saldoDevedor: 150000, fgtsUtilizado: 30000 });
    expect(com.fgtsNoLote).toBe(30000);
    expect(com.quitacaoLote).toBe(sem.quitacaoLote - 30000);
    expect(com.financiamentoConstrucao).toBe(sem.financiamentoConstrucao + 30000);
    expect(com.recursosUtilizaveis).toBeCloseTo(sem.recursosUtilizaveis, 6);
    expect(com.jurosObra).toBeLessThan(sem.jurosObra);
  });

  it("não libera para a obra mais que o orçamento quando o ágio supera a entrada", () => {
    const result = calculate({ ...input, saldoDevedor: 0 });
    expect(result.dinheiroEntrada).toBe(0);
    expect(result.financiamentoConstrucao).toBe(300000);
    expect(result.financiamentoExcedente).toBe(100000);
  });

  it("soma terreno e remuneração do construtor no custo do imóvel e separa o desembolso do cliente", () => {
    // Para morar, margem e serviços do construtor saem da verba e entram no custo do imóvel.
    const result = calculate({ ...input, objetivo: "morar", administracao: 5000, projetos: 7000, honorarios: 8000 });
    expect(result.remuneracaoResponsavel).toBe(30000 + 5000 + 7000 + 8000);
    expect(result.custoImovel).toBeCloseTo(result.custoComTerreno + 50000);
    expect(result.custoComTerreno - result.custoTotal).toBeCloseTo(input.terreno);
    expect(result.desembolsoAntesContrato).toBe(10000);
    expect(result.desembolsoDuranteObra).toBeCloseTo(result.jurosObra);
  });
  it("converte taxa anual por equivalência composta e oferece áreas mínima e máxima", () => {
    const result = calculate(input);
    expect(annualToMonthlyRate(10)).toBeCloseTo(0.797414, 5);
    expect(result.areaViavelMinima).toBeCloseTo(result.areaViavelMaxima / 1.18);
    expect(result.jurosObra).toBeGreaterThan(0);
  });

  it("sugere o preço que paga o retorno mínimo do investidor e o lucro desejado do construtor", () => {
    // O lucro desejado (margem) de R$ 40 mil é dividido 50/50 depois do retorno mínimo do investidor.
    const parceiro = calculate({ ...input, prazo: 3, participacaoInvestidor: 50, lucro: 40000 });
    const c = parceiro.cenarios[0]!;
    expect(parceiro.valorVenda).toBeCloseTo(parceiro.precoSugerido);
    expect(c.lucroConstrutor).toBeCloseTo(20000, 0);
    expect(c.lucroInvestidor).toBeCloseTo(parceiro.retornoPreferencial + 20000, 0);
    expect(c.preferencialPago).toBeCloseTo(parceiro.retornoPreferencial, 0);
    expect(parceiro.precoSugerido).toBeGreaterThan(parceiro.precoMinimo);
    const sozinho = calculate({ ...input, prazo: 3, temInvestidor: false, lucro: 40000 });
    expect(sozinho.cenarios[0]!.lucroConstrutor).toBeCloseTo(40000, 0);
    // O cenário de atraso mantém o preço sugerido; vender 10% abaixo derruba o lucro.
    expect(parceiro.cenarios[2]?.venda).toBeCloseTo(parceiro.valorVenda);
    expect(parceiro.cenarios[1]!.lucroConstrutor).toBeLessThan(c.lucroConstrutor);
  });

  it("confere o preço sugerido com o m² de casa pronta na região", () => {
    const result = calculate({ ...input, precoM2Mercado: 4000 });
    expect(result.precoMercadoEstimado).toBeCloseTo(4000 * result.areaPlanejada);
    expect(calculate(input).precoMercadoEstimado).toBe(0);
  });

  it("atualiza o preço com projetos, lucro e área sem duplicar honorários", () => {
    const initial = calculate(input);
    const extra = calculate({ ...input, despesas: input.despesas.map((item) => ({ ...item, valor: item.valor + 5000 })) });
    expect(extra.precoEquilibrio - initial.precoEquilibrio).toBeCloseTo(5000 / 0.95);
    // Serviços do construtor são custo; o lucro desejado não muda o preço que só devolve o capital, só o sugerido.
    expect(calculate({ ...input, administracao: 5000 }).precoEquilibrio - initial.precoEquilibrio).toBeCloseTo(5000 / 0.95);
    expect(calculate({ ...input, lucro: 35000 }).precoEquilibrio).toBeCloseTo(initial.precoEquilibrio);
    expect(calculate({ ...input, lucro: 35000 }).precoSugerido).toBeGreaterThan(initial.precoSugerido);
    expect(calculate({ ...input, areaPlanejada: 125 }).precoEquilibrio - initial.precoEquilibrio).toBeCloseTo(10000 / 0.95);
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
    const realista = result.cenarios[0]!;
    expect(realista.lucroInvestidor + realista.lucroConstrutor).toBeCloseTo(realista.saldo);
    expect(realista.preferencialPago).toBeCloseTo(Math.min(realista.saldo, result.retornoPreferencial));
    expect(realista.lucroConstrutor).toBeCloseTo(Math.max(realista.saldo - result.retornoPreferencial, 0) / 2);
  });

  it("com participação zero, o investidor rende exatamente a taxa preferencial", () => {
    const result = calculate({ ...input, participacaoInvestidor: 0, precoVenda: 800000 });
    expect(result.aliquotaIr).toBe(22.5);
    expect(result.selicLiquida).toBeCloseTo(13.75 * 0.775);
    expect(result.cenarios[0]?.rentabilidadeInvestidor).toBeCloseTo(result.taxaPreferencial, 1);
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

  it("conta o lote próprio pelo valor cheio; a valorização dele paga IR na venda", () => {
    const sem = calculate({ ...input, precoVenda: 600000 });
    const comCusto = calculate({ ...input, precoVenda: 600000, custoAquisicaoLote: 120000 });
    expect(comCusto.patrimonioTerreno).toBe(100000);
    // Lote pago por R$ 120 mil e lançado a R$ 200 mil: R$ 80 mil a mais de ganho tributável.
    expect(comCusto.custoAquisicaoIr).toBeCloseTo(sem.custoAquisicaoIr - 80000);
    expect(comCusto.irVenda).toBeGreaterThan(sem.irVenda);
  });
  it("usa o preço de mercado: o investidor não encarece o imóvel", () => {
    const sozinho = calculate({ ...input, precoVenda: 520000, temInvestidor: false, lucroConstrutor: 40000 });
    const parceiro = calculate({ ...input, precoVenda: 520000, participacaoInvestidor: 50, lucroConstrutor: 40000 });
    expect(sozinho.valorVenda).toBe(520000);
    expect(parceiro.valorVenda).toBe(520000);
    // Sem investidor, todo o lucro fica com o construtor e não há retorno preferencial.
    expect(sozinho.retornoPreferencial).toBe(0);
    expect(sozinho.cenarios[0]?.lucroInvestidor).toBe(0);
    expect(sozinho.cenarios[0]?.lucroConstrutor).toBeCloseTo(sozinho.cenarios[0]!.saldo);
    // Com parceiro, o mesmo lucro é dividido em cascata: o construtor recebe menos, o preço não muda.
    expect(parceiro.cenarios[0]?.saldo).toBeCloseTo(sozinho.cenarios[0]!.saldo);
    expect(parceiro.cenarios[0]!.lucroConstrutor).toBeLessThan(sozinho.cenarios[0]!.lucroConstrutor);
  });

  it("fecha a venda: banco, IR, despesas, capital devolvido e as duas partes somam o caixa da venda", () => {
    const despesas = [...input.despesas, { id: "baixa-alienacao", categoria: "Na venda" as const, nome: "Baixa", valor: 600, fonte: "", observacao: "" }];
    const result = calculate({ ...input, despesas, precoVenda: 560000, prazo: 4, trMensal: 0.1, seguroTarifaMensal: 90, custoAquisicaoLote: 120000 });
    const c = result.cenarios[0]!;
    expect(c.ir).toBeGreaterThan(0);
    const caixa = c.venda - c.corretagem - c.ir - 600 - result.dividaNaVenda + result.folgaFinanciamento;
    expect(result.capitalDevolvidoVenda + c.lucroInvestidor + c.lucroConstrutor).toBeCloseTo(caixa, 6);
  });
  it("calcula o preço que devolve o capital e o preço mínimo com o retorno do investidor", () => {
    const base = calculate({ ...input, precoVenda: 500000, prazo: 3 });
    const minimo = calculate({ ...input, precoVenda: base.precoMinimo, prazo: 3 }).cenarios[0]!;
    expect(minimo.lucroConstrutor).toBeCloseTo(0, 2);
    expect(minimo.lucroInvestidor).toBeCloseTo(base.retornoPreferencial, 2);
    const equilibrio = calculate({ ...input, precoVenda: base.precoEquilibrio, prazo: 3 }).cenarios[0]!;
    expect(equilibrio.saldo).toBeCloseTo(0, 2);
    expect(base.precoEquilibrio).toBeLessThan(base.precoMinimo);
  });
  it("cobra 15% de IR sobre o ganho, com corretagem dedutível e fator de redução", () => {
    expect(irGanhoCapital(1000000)).toBeCloseTo(150000);
    expect(irGanhoCapital(6000000)).toBeCloseTo(5000000 * 0.15 + 1000000 * 0.175);
    expect(fatorReducaoFr2(12)).toBeCloseTo(1 / Math.pow(1.0035, 12));
    const result = calculate({ ...input, precoVenda: 600000, prazo: 3 });
    const ganho = 600000 * 0.95 - result.custoAquisicaoIr;
    expect(result.ganhoCapitalVenda).toBeCloseTo(ganho);
    expect(result.fatorReducao).toBeLessThan(1);
    expect(result.fatorReducao).toBeGreaterThan(fatorReducaoFr2(result.mesVenda));
    expect(result.irVenda).toBeCloseTo(ganho * result.fatorReducao * 0.15);
  });
  it("na venda, a entrada em dinheiro é só comprovação, salvo se a agência exigir depósito", () => {
    const compra = { ...input, origemTerreno: "compra" as const, precoVenda: 560000 };
    const comprova = calculate(compra);
    expect(comprova.dinheiroEntrada).toBe(100000);
    expect(comprova.aportesInvestidor.some((f) => f.rotulo.startsWith("Entrada"))).toBe(false);
    expect(comprova.capitalGiro).toBeCloseTo((comprova.custoConstrucao + comprova.extrasTotal) * 0.1);
    const deposita = calculate({ ...compra, entradaDepositada: true });
    expect(deposita.capitalGiro).toBe(0);
    expect(deposita.dinheiroParaComecar).toBeGreaterThan(comprova.dinheiroParaComecar);
    // A entrada depositada que a obra não usa volta no fim da obra.
    const devolvida = deposita.aportesInvestidor.find((f) => f.rotulo.includes("volta no fim"));
    expect(devolvida?.retornoMes).toBe(deposita.prazoExecucaoMeses);
  });

  it("cobra do investidor só o que a obra real custa além do financiamento, mês a mês", () => {
    const result = calculate({ ...input, precoVenda: 600000, areaPlanejada: 170 });
    // Na venda, o lucro desejado vem do preço e não sai da verba da obra.
    expect(result.obraAlemFinanciamento).toBeCloseTo(170 * 2000 - 300000);
    const alem = result.aportesInvestidor.filter((f) => f.rotulo === "Obra além do financiamento");
    expect(alem.reduce((sum, f) => sum + f.valor, 0)).toBeCloseTo(result.obraAlemFinanciamento);
    expect(result.capitalMaximo).toBeGreaterThan(result.dinheiroParaComecar);
    // O lote próprio é capital, mas não é dinheiro a separar: fica fora do máximo necessário.
    expect(result.capitalMaximo).toBeLessThanOrEqual(result.capitalAportadoInvestidor - result.patrimonioTerreno + 1e-6);
  });

  it("mostra o efeito de vender 10% abaixo e 6 meses depois", () => {
    const result = calculate({ ...input, precoVenda: 560000, prazo: 3, seguroTarifaMensal: 90 });
    const [esperado, abaixo, atraso] = result.cenarios;
    expect(abaixo!.venda).toBeCloseTo(560000 * 0.9);
    expect(atraso!.atraso).toBe(6);
    expect(atraso!.mesVenda).toBe(esperado!.mesVenda + 6);
    expect(atraso!.venda).toBe(560000);
    expect(atraso!.lucroConstrutor).toBeLessThan(esperado!.lucroConstrutor);
  });

  it("serviços do construtor reduzem a área nos dois modos; o lucro desejado só para morar", () => {
    const area = (objetivo: "morar" | "vender", extra: Partial<typeof input>) => calculate({ ...input, objetivo, ...extra }).areaViavelMaxima;
    const servicos = { lucro: 0, administracao: 10000, projetos: 5000, honorarios: 5000 };
    expect(area("vender", servicos)).toBeCloseTo(area("morar", servicos));
    expect(area("vender", { lucro: 0 })).toBeCloseTo(area("vender", { lucro: 20000 }));
    expect(area("morar", { lucro: 0 }) - area("morar", { lucro: 20000 })).toBeCloseTo(20000 / 2000);
    expect(area("morar", servicos)).toBeCloseTo(area("morar", { lucro: 20000 }));
    // Projetos, administração e honorários não aparecem mais como despesas.
    const ids = estimatedExpenses(100000, 400000, 9000, 9000, 9000, 2500, 100).map((item) => item.id);
    expect(ids).not.toContain("projetos");
    expect(ids).not.toContain("administracao");
    expect(estimatedExpenses(100000, 400000, 0, 0, 0, 2500, 100, "SP", false, true, true).some((item) => item.categoria === "Na venda")).toBe(true);
  });
  it("para morar, a corretagem incide só sobre a construção do contrato e sai da verba", () => {
    const sem = calculate({ ...input, objetivo: "morar", lucro: 0 });
    const com = calculate({ ...input, objetivo: "morar", lucro: 0, corretagemConstrucao: 5 });
    expect(com.corretagemConstrucao).toBeCloseTo(sem.orcamentoObraContrato * 0.05);
    expect(sem.areaViavelMaxima - com.areaViavelMaxima).toBeCloseTo(com.corretagemConstrucao / 2000);
    expect(com.remuneracaoDetalhe.corretagem).toBeCloseTo(com.corretagemConstrucao);
    // Na venda a corretagem é sobre o preço de venda, não sobre a construção.
    expect(calculate({ ...input, corretagemConstrucao: 5 }).corretagemConstrucao).toBe(0);
  });

  it("separa o que o investidor precisa ter: entrada, custos fora da obra e aporte só acima da área viável", () => {
    const dentro = calculate({ ...input, saldoDevedor: 190000, prazo: 3, seguroTarifaMensal: 90 });
    expect(dentro.areaPlanejada).toBeLessThanOrEqual(dentro.areaViavelMaxima);
    expect(dentro.investidorAlemEntrada).toBe(0);
    expect(dentro.investidorEntrada).toBeCloseTo(dentro.dinheiroEntrada + dentro.complementoLote);
    expect(dentro.investidorTotal).toBeCloseTo(dentro.investidorEntrada + dentro.investidorCustos);
    expect(dentro.reservaAtraso).toBeCloseTo(dentro.prestacaoInicial * 6);
    const acima = calculate({ ...input, saldoDevedor: 190000, prazo: 3, areaPlanejada: dentro.areaViavelMaxima + 10 });
    expect(acima.investidorAlemEntrada).toBeCloseTo(10 * 2000, 0);
  });

  it("aquisição de terreno e construção: o que já foi pago é ágio e capital; o construtor vendedor recebe o pagamento do lote", () => {
    // Lote de R$ 200 mil com R$ 50 mil já pagos ao construtor: banco paga R$ 150 mil (limite de 30% de R$ 500 mil).
    const atc = calculate({ ...input, origemTerreno: "construtor", terreno: 200000, saldoDevedor: 150000 });
    expect(atc.agioLote).toBe(50000);
    expect(atc.agioNaEntrada).toBe(50000);
    expect(atc.patrimonioTerreno).toBe(50000);
    expect(atc.quitacaoLote).toBe(150000);
    expect(atc.recebimentoConstrutorLote).toBe(150000);
    // Construção em terreno próprio: lote quitado inteiro como ágio, sem pagamento ao vendedor.
    const ctp = calculate({ ...input, terreno: 200000, saldoDevedor: 0 });
    expect(ctp.agioLote).toBe(200000);
    expect(ctp.quitacaoLote).toBe(0);
    expect(ctp.recebimentoConstrutorLote).toBe(0);
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