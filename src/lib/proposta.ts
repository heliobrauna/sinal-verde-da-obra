import type { PropostaData } from "@/components/app/PropostaCliente";
import type { ClientExpense } from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";

// Remuneração e despesas do responsável entram em "Construção da casa": a proposta nunca as mostra à parte.
export const DESPESAS_DO_CONSTRUTOR = new Set(["honorarios-entrada", "honorarios-saldo", "administracao", "acompanhamento"]);

type ResultadoProposta = {
  areaViavel: number;
  areaViavelMinima?: number;
  areaViavelMaxima?: number;
  areaPlanejada?: number;
  custoConstrucao?: number;
  custoTotal?: number;
  custoComTerreno?: number;
  extrasTotal: number;
  despesas?: ClientExpense[];
  saldoRecursos?: number;
  lucroDesejado?: number;
  remuneracaoResponsavel?: number;
  quitacaoLote?: number;
  financiamentoConstrucao?: number;
  fgtsNaEntrada?: number;
  agioNaEntrada?: number;
  desembolsoProprio?: number;
  dinheiroEntrada?: number;
  complementoLote?: number;
  aporteParaAreaPlanejada?: number;
  desembolsoAntesContrato?: number;
  desembolsoAssinatura?: number;
  capitalGiro?: number;
  jurosObra?: number;
  prazoExecucaoMeses?: number;
  liberacoesMensais?: { encargo: number }[];
  prestacaoInicial?: number;
  sistemaAmortizacao?: "PRICE" | "SAC";
  prazoFinanciamento?: number;
};

// Monta a proposta ao cliente (modo morar) a partir da simulação salva. Devolve null para venda ou
// para simulações salvas com uma versão anterior do cálculo, que precisam ser abertas e salvas de novo.
export function montarProposta(item: Tables<"simulacoes">): PropostaData | null {
  if (item.objetivo === "vender") return null;
  const r = item.resultado as unknown as ResultadoProposta;
  const custoComTerreno = r.custoComTerreno ?? (r.custoTotal !== undefined ? r.custoTotal + item.terreno_valor : undefined);
  if (r.prestacaoInicial === undefined || r.desembolsoProprio === undefined || r.financiamentoConstrucao === undefined || !custoComTerreno) return null;
  const areaMin = r.areaViavelMinima ?? r.areaViavel;
  const areaMax = r.areaViavelMaxima ?? r.areaViavel;
  const sobra = Math.max(r.saldoRecursos ?? 0, 0);
  const remuneracao = r.remuneracaoResponsavel ?? r.lucroDesejado ?? item.lucro_desejado ?? 0;
  const despesas = r.despesas ?? [];
  const despesasConstrutor = despesas.filter((x) => DESPESAS_DO_CONSTRUTOR.has(x.id)).reduce((sum, x) => sum + x.valor, 0);
  const liberacoes = r.liberacoesMensais ?? [];
  return {
    nome: item.nome,
    areaMin,
    areaMax,
    areaPlanejada: r.areaPlanejada ?? areaMin,
    renda: item.renda_declarada,
    custos: {
      terreno: item.terreno_valor,
      construcao: (r.custoConstrucao ?? 0) + r.extrasTotal + remuneracao + despesasConstrutor,
      documentos: despesas.reduce((sum, x) => sum + x.valor, 0) - despesasConstrutor,
      juros: r.jurosObra ?? 0,
    },
    // A verba do banco que sobra não é liberada: o banco entra só com o que a obra usa.
    pagamento: {
      banco: (r.quitacaoLote ?? 0) + r.financiamentoConstrucao - sobra,
      fgts: r.fgtsNaEntrada ?? 0,
      terreno: r.agioNaEntrada ?? 0,
      bolso: r.desembolsoProprio,
    },
    // O que sai do bolso, por destino: a entrada em dinheiro vai para a obra (faz parte do valor do imóvel);
    // taxas e documentos vêm por fora, como os juros da obra e o acréscimo para a área planejada.
    bolsoDetalhe: {
      entrada: r.dinheiroEntrada ?? 0,
      terreno: r.complementoLote ?? 0,
      taxas: Math.max((r.desembolsoAntesContrato ?? 0) + (r.desembolsoAssinatura ?? 0) - (r.dinheiroEntrada ?? 0) - (r.complementoLote ?? 0), 0),
      juros: r.jurosObra ?? 0,
      area: r.aporteParaAreaPlanejada ?? 0,
    },
    folgaBanco: sobra,
    aporteArea: r.aporteParaAreaPlanejada ?? 0,
    antesContrato: r.desembolsoAntesContrato ?? 0,
    assinatura: r.desembolsoAssinatura ?? 0,
    caixaInicio: r.capitalGiro ?? 0,
    mesesObra: r.prazoExecucaoMeses ?? liberacoes.length,
    encargoInicial: liberacoes[0]?.encargo ?? 0,
    encargoFinal: liberacoes[liberacoes.length - 1]?.encargo ?? 0,
    prestacao: r.prestacaoInicial,
    sistema: r.sistemaAmortizacao ?? "SAC",
    prazoMeses: r.prazoFinanciamento ?? 360,
  };
}
