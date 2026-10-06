import { LIMITE_LOTE_CONTRATO, monthlyToAnnualRate, type SistemaAmortizacao } from "./finance";

// Pré-análise pela renda: quanto o cliente consegue financiar antes de abrir o simulador da Caixa.
// Tudo aqui é estimativa de planejamento; a aprovação depende da análise de crédito do banco.

// Comprometimento máximo da renda bruta familiar com a prestação.
export const COMPROMETIMENTO_RENDA = 0.3;
// Parte do valor do imóvel (terreno + obra) que a Caixa financia na construção.
export const COTA_FINANCIAMENTO = 0.8;
// Idade + prazo não podem passar de 80 anos e 6 meses.
export const IDADE_LIMITE_MESES = 80 * 12 + 6;
export const PRAZO_MAXIMO_MESES = 420;
// Desconto de juros para quem tem 3 anos ou mais de FGTS (faixas 1 a 3).
export const DESCONTO_COTISTA = 0.5;
// Teto do imóvel no SFH, usado quando a renda passa da faixa 4.
const TETO_SFH = 2_250_000;

export type Faixa = {
  id: "1" | "2" | "3" | "4" | "sbpe";
  rotulo: string;
  rendaAte: number;
  // Taxa nominal anual de referência (teto da faixa, para não prometer menos do que o banco cobra).
  juros: number;
  limiteImovel: number;
  observacao: string;
};

// Minha Casa, Minha Vida com os limites aprovados pelo Conselho Curador do FGTS em 24/03/2026.
// Acima da faixa 4, crédito de mercado (SBPE) com taxa de balcão estimada.
export const FAIXAS: Faixa[] = [
  { id: "1", rotulo: "MCMV Faixa 1", rendaAte: 3200, juros: 4.5, limiteImovel: 270_000, observacao: "Pode haver subsídio, que aumenta o valor possível; o limite do imóvel varia por município." },
  { id: "2", rotulo: "MCMV Faixa 2", rendaAte: 5000, juros: 6.5, limiteImovel: 270_000, observacao: "Pode haver subsídio, que aumenta o valor possível; o limite do imóvel varia por município." },
  { id: "3", rotulo: "MCMV Faixa 3", rendaAte: 9600, juros: 7.66, limiteImovel: 400_000, observacao: "Sem subsídio." },
  { id: "4", rotulo: "MCMV Faixa 4", rendaAte: 13000, juros: 10, limiteImovel: 600_000, observacao: "Sem subsídio e sem desconto de cotista do FGTS." },
  { id: "sbpe", rotulo: "Crédito de mercado (SBPE)", rendaAte: Infinity, juros: 11.5, limiteImovel: TETO_SFH, observacao: "Taxa de balcão estimada; varia com o relacionamento com o banco." },
];

export function faixaPorRenda(renda: number): Faixa {
  return FAIXAS.find((faixa) => renda <= faixa.rendaAte) ?? FAIXAS[FAIXAS.length - 1]!;
}

export function jurosSugeridos(faixa: Faixa, cotistaFgts: boolean) {
  const desconto = cotistaFgts && (faixa.id === "1" || faixa.id === "2" || faixa.id === "3") ? DESCONTO_COTISTA : 0;
  return faixa.juros - desconto;
}

// Prazo máximo pela idade do participante mais velho (idade + prazo ≤ 80 anos e 6 meses).
export function prazoMaximoPorIdade(idadeAnos: number) {
  return Math.max(0, Math.min(PRAZO_MAXIMO_MESES, IDADE_LIMITE_MESES - Math.ceil(Math.max(idadeAnos, 0) * 12)));
}

// Maior dívida cuja primeira prestação (juros + amortização + seguros e tarifa) cabe na parcela máxima.
// É o inverso de parcelasAmortizacao: no PRICE a parcela é constante; no SAC a primeira é a maior.
export function financiamentoPorParcela(parcela: number, taxaMensal: number, prazo: number, sistema: SistemaAmortizacao, seguroTarifa: number) {
  const disponivel = parcela - Math.max(seguroTarifa, 0);
  const n = Math.round(prazo);
  if (disponivel <= 0 || n <= 0) return 0;
  if (sistema === "SAC") return disponivel / (1 / n + taxaMensal);
  return taxaMensal > 0 ? disponivel * (1 - Math.pow(1 + taxaMensal, -n)) / taxaMensal : disponivel * n;
}

export type PreAnaliseInput = {
  rendaFormal: number;
  rendaInformal: number;
  idade: number;
  cotistaFgts: boolean;
  fgts: number;
  dinheiro: number;
  terreno: number;
  terrenoProprio: boolean;
  sistema: SistemaAmortizacao;
  // Taxa nominal anual; null usa a taxa sugerida da faixa.
  jurosAnuais: number | null;
  seguroTarifaMensal: number;
  // Preço médio do m² de casa pronta na região (terreno + construção), para traduzir o valor em tamanho.
  precoM2Pronto: number;
};

export function preAnalise(input: PreAnaliseInput) {
  const renda = Math.max(input.rendaFormal, 0) + Math.max(input.rendaInformal, 0);
  const faixa = faixaPorRenda(renda);
  const jurosAnuais = input.jurosAnuais ?? jurosSugeridos(faixa, input.cotistaFgts);
  // As taxas do programa são nominais: mensal = anual / 12. O simulador usa a efetiva equivalente.
  const taxaMensal = jurosAnuais / 12 / 100;
  const jurosEfetivos = monthlyToAnnualRate(jurosAnuais / 12);
  const prazo = prazoMaximoPorIdade(input.idade);
  const parcelaMaxima = renda * COMPROMETIMENTO_RENDA;
  const capacidade = financiamentoPorParcela(parcelaMaxima, taxaMensal, prazo, input.sistema, input.seguroTarifaMensal);
  // A entrada é formada pelo ágio do lote próprio, depois FGTS e dinheiro, como no simulador.
  const terreno = Math.max(input.terreno, 0);
  const agio = input.terrenoProprio ? terreno : 0;
  const fgts = Math.max(input.fgts, 0);
  const dinheiro = Math.max(input.dinheiro, 0);
  const recursosEntrada = agio + fgts + dinheiro;
  // Com lote próprio o banco financia só a obra: financiamento = menor entre 80% do imóvel e imóvel - lote.
  // O imóvel é limitado pela renda (financiamento ≤ capacidade), pela entrada (mínimo de 20%) e pelo teto da faixa.
  const limites = {
    renda: Math.max(capacidade / COTA_FINANCIAMENTO, capacidade + agio),
    entrada: recursosEntrada / (1 - COTA_FINANCIAMENTO),
    faixa: faixa.limiteImovel,
  };
  const valorImovel = Math.max(0, Math.min(limites.renda, limites.entrada, limites.faixa));
  const limitadoPor: keyof typeof limites = valorImovel === limites.faixa ? "faixa" : valorImovel === limites.renda ? "renda" : "entrada";
  const financiamento = Math.max(0, Math.min(valorImovel * COTA_FINANCIAMENTO, valorImovel - agio));
  const entrada = valorImovel - financiamento;
  const agioNaEntrada = Math.min(agio, entrada);
  const fgtsNaEntrada = Math.min(fgts, entrada - agioNaEntrada);
  const dinheiroNaEntrada = entrada - agioNaEntrada - fgtsNaEntrada;
  // A prestação cresce em linha reta com a dívida; seguros e tarifa entram inteiros.
  const seguroTarifa = Math.max(input.seguroTarifaMensal, 0);
  const prestacao = financiamento > 0 && capacidade > 0 ? seguroTarifa + (parcelaMaxima - seguroTarifa) * financiamento / capacidade : 0;
  // Verba da obra = imóvel - terreno. A área equivalente usa o preço de casa pronta, que já inclui o terreno.
  const verbaObra = Math.max(valorImovel - terreno, 0);
  const area = input.precoM2Pronto > 0 ? valorImovel / input.precoM2Pronto : 0;
  return {
    renda, faixa, jurosAnuais, jurosEfetivos, prazo, parcelaMaxima, capacidade,
    limites, limitadoPor, valorImovel, financiamento, entrada,
    agioNaEntrada, fgtsNaEntrada, dinheiroNaEntrada,
    // Lote que não é do cliente entra no valor do imóvel e é pago na operação.
    terrenoNaOperacao: input.terrenoProprio ? 0 : terreno,
    prestacao, verbaObra, area,
    terrenoMaiorQueImovel: terreno > valorImovel,
    // O banco quita o lote comprado até 30% do contrato; o restante precisa sair da entrada.
    loteAcimaDoLimiteBanco: !input.terrenoProprio && terreno > valorImovel * LIMITE_LOTE_CONTRATO,
  };
}
