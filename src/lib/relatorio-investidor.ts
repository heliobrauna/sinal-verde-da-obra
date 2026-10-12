import type { Tables } from "@/integrations/supabase/types";

// Relatório para o investidor (modo vender): quanto ele coloca, quando volta, quanto rende e o que pode dar
// errado. Mostra só o lado dele da operação, nunca a margem nem os custos internos do construtor.

type Cenario = {
  nome: string;
  venda: number;
  corretagem?: number;
  ir?: number;
  saldo: number;
  lucroInvestidor: number;
  rentabilidadeInvestidor: number | null;
  mesVenda?: number;
  ajuste?: number;
  atraso?: number;
};

type ResultadoVenda = {
  areaPlanejada?: number;
  areaViavelMinima?: number;
  areaViavel?: number;
  custoComTerreno?: number;
  valorVenda?: number;
  capitalMaximo?: number;
  capitalAportadoInvestidor?: number;
  aportesInvestidor?: { mes: number; rotulo: string; valor: number; retornoMes?: number; patrimonio?: boolean }[];
  prazoExecucaoMeses?: number;
  mesVenda?: number;
  mesesAposObra?: number;
  temInvestidor?: boolean;
  participacaoInvestidor?: number;
  selicLiquida?: number;
  taxaPreferencial?: number;
  retornoPreferencial?: number;
  premioInvestidor?: number;
  precoMinimo?: number;
  precoEquilibrio?: number;
  prestacaoInicial?: number;
  patrimonioTerreno?: number;
  origemTerreno?: string;
  capitalDevolvidoVenda?: number;
  entradaDepositada?: boolean;
  dividaNaVenda?: number;
  folgaFinanciamento?: number;
  despesasVenda?: number;
  cenarios?: Cenario[];
};

export type SinalInvestidor = "verde" | "amarelo" | "vermelho";

export type RelatorioInvestidorData = {
  nome: string;
  area: number;
  mesesObra: number;
  mesVenda: number;
  precoVenda: number;
  custoTotal: number;
  capitalMaximo: number;
  capitalTotal: number;
  // Seu terreno, quando entra na operação: não é dinheiro novo, mas é capital que volta na venda.
  terreno: number;
  fases: { assinatura: number; obra: number; aposObra: number };
  devolvidoFimObra: number;
  recebeNaVenda: number;
  lucro: number;
  rentabilidade: number | null;
  selicLiquida: number;
  taxaMinima: number;
  participacao: number;
  // Quanto o preço pode cair antes de o investidor deixar de receber o retorno mínimo ou perder dinheiro.
  folgaRetornoMinimo: number;
  folgaPrejuizo: number;
  parcelaAtraso: number;
  entradaDepositada: boolean;
  // Para onde vai o dinheiro da venda esperada.
  venda: { corretagem: number; ir: number; despesas: number; banco: number; capital: number; lucro: number; construtor: number };
  cenarios: { nome: string; lucro: number; rentabilidade: number | null; mesVenda: number }[];
  status: SinalInvestidor;
};

export function montarRelatorioInvestidor(item: Tables<"simulacoes">): RelatorioInvestidorData | null {
  if (item.objetivo !== "vender") return null;
  const r = item.resultado as unknown as ResultadoVenda;
  // Só o cálculo atual (preço de mercado e capital real) e só com investidor parceiro.
  if (r.capitalMaximo === undefined || r.temInvestidor === false || !r.cenarios?.length || !r.valorVenda) return null;
  const mesesObra = r.prazoExecucaoMeses ?? 0;
  const aportes = r.aportesInvestidor ?? [];
  const ehTerreno = (flow: (typeof aportes)[number]) => flow.patrimonio === true || flow.rotulo.startsWith("Terreno (valor");
  const terreno = aportes.filter(ehTerreno).reduce((sum, flow) => sum + flow.valor, 0);
  const dinheiro = aportes.filter((flow) => !ehTerreno(flow));
  const soma = (filtro: (mes: number) => boolean) => dinheiro.filter((flow) => filtro(flow.mes)).reduce((sum, flow) => sum + flow.valor, 0);
  const esperado = r.cenarios[0]!;
  const selicLiquida = r.selicLiquida ?? 0;
  const capitalDevolvidoVenda = r.capitalDevolvidoVenda ?? 0;
  const abaixoDaSelic = (c: Cenario) => c.rentabilidadeInvestidor === null || c.rentabilidadeInvestidor < selicLiquida || c.lucroInvestidor < 0;
  const status: SinalInvestidor = abaixoDaSelic(esperado) ? "vermelho" : r.cenarios.slice(1).some(abaixoDaSelic) ? "amarelo" : "verde";
  return {
    nome: item.nome,
    area: r.areaPlanejada ?? r.areaViavelMinima ?? r.areaViavel ?? 0,
    mesesObra,
    mesVenda: r.mesVenda ?? mesesObra,
    precoVenda: r.valorVenda,
    custoTotal: r.custoComTerreno ?? 0,
    capitalMaximo: r.capitalMaximo,
    capitalTotal: r.capitalAportadoInvestidor ?? 0,
    terreno,
    fases: {
      assinatura: soma((mes) => mes === 0),
      obra: soma((mes) => mes > 0 && mes <= mesesObra),
      aposObra: soma((mes) => mes > mesesObra),
    },
    devolvidoFimObra: aportes.filter((flow) => flow.retornoMes !== undefined).reduce((sum, flow) => sum + flow.valor, 0),
    recebeNaVenda: capitalDevolvidoVenda + esperado.lucroInvestidor,
    lucro: esperado.lucroInvestidor,
    rentabilidade: esperado.rentabilidadeInvestidor,
    selicLiquida,
    taxaMinima: r.taxaPreferencial ?? 0,
    participacao: r.participacaoInvestidor ?? 0,
    folgaRetornoMinimo: r.precoMinimo ? Math.max(1 - r.precoMinimo / r.valorVenda, 0) * 100 : 0,
    folgaPrejuizo: r.precoEquilibrio ? Math.max(1 - r.precoEquilibrio / r.valorVenda, 0) * 100 : 0,
    parcelaAtraso: r.prestacaoInicial ?? 0,
    entradaDepositada: r.entradaDepositada === true,
    venda: {
      corretagem: esperado.corretagem ?? 0,
      ir: esperado.ir ?? 0,
      despesas: r.despesasVenda ?? 0,
      banco: Math.max((r.dividaNaVenda ?? 0) - (r.folgaFinanciamento ?? 0), 0),
      capital: capitalDevolvidoVenda,
      lucro: esperado.lucroInvestidor,
      construtor: Math.max(esperado.saldo - esperado.lucroInvestidor, 0),
    },
    cenarios: r.cenarios.map((c) => ({ nome: c.nome, lucro: c.lucroInvestidor, rentabilidade: c.rentabilidadeInvestidor, mesVenda: c.mesVenda ?? r.mesVenda ?? 0 })),
    status,
  };
}
