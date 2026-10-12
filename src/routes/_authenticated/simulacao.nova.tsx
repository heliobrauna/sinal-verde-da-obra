import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { NumericInput } from "@/components/app/NumericInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  calculate,
  BRL,
  annualToMonthlyRate,
  estimatedExpenses,
  monthlyToAnnualRate,
  pciReleases,
  suggestedExecutionMonths,
  NUMBER,
  MESES_ATRASO_VENDA,
  QUEDA_PRECO_CENARIO,
  sinalDaSimulacao,
  type SinalStatus,
  type ClientExpense,
  type OrigemTerreno,
  type SistemaAmortizacao,
  type Extra,
  type MonthlyRelease,
  type Stage,
} from "@/lib/finance";
import { getResidentialCub } from "@/lib/cub.functions";
import { getSelicMeta, getTrMensal } from "@/lib/selic.functions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

const stages: Stage[] = [
  ["Fundação", 15],
  ["Estrutura", 20],
  ["Alvenaria", 20],
  ["Cobertura", 15],
  ["Instalações", 10],
  ["Revestimento", 10],
  ["Acabamento", 10],
].map(([nome, percentual]) => ({ nome: String(nome), percentual: Number(percentual) }));
const suggestions = [
  "Muro",
  "Piscina",
  "Paisagismo",
  "Cerca elétrica",
  "Motor para portão",
  "Painéis solares",
];
const ufs = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const STEP_LABELS = ["Partida", "Orçamento", "Viabilidade", "Cronograma"];
// Etapas: 1 ponto de partida, 2 orçamento, 3 viabilidade, 4 cronograma (com a área planejada definida).
const categories = ["Despesas iniciais", "Assinatura do contrato", "Durante a obra", "Na venda"] as const;
const ORIGEM_NOTA: Record<OrigemTerreno, string> = {
  investidor: "O ágio do lote compõe a entrada e conta como capital do investidor, com retorno preferencial. Lote quitado e registrado no nome dele não paga ITBI nem registro de compra.",
  construtor: "O construtor vende o lote ao investidor: há ITBI e registro, e o ágio não serve de entrada: ela vem de dinheiro (ou de FGTS, só ao construir para morar). O construtor recebe o preço do lote na assinatura e pode usá-lo para iniciar a obra.",
  compra: "O lote é comprado de terceiro na operação: há ITBI e registro, não existe ágio e a entrada precisa vir de dinheiro (ou de FGTS, só ao construir para morar).",
};
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const HELP = {
  sistema: "Use o mesmo do simulador da Caixa. No PRICE a parcela é fixa; no SAC a primeira é a maior e as seguintes diminuem. Vale para depois da obra.",
  prazo: "Prazo de pagamento do financiamento no simulador da Caixa (até 420 meses). A prestação estimada usa este prazo, sem a TR, como o simulador.",
  juros: "Taxa efetiva anual mostrada pelo simulador da Caixa. Na fase de obra, os juros mensais são a taxa nominal ÷ 12, cobrados sobre a dívida já liberada (lote + parcelas medidas).",
  tr: "Atualização monetária cobrada junto com os juros na fase de obra: dívida liberada × TR. Consultada automaticamente no Banco Central; edite se quiser outra premissa.",
  seguros: "Seguro Morte e Invalidez (MIP), Danos Físicos (DFI) e tarifa de administração cobrados todo mês desde a assinatura. Copie os valores da 1ª prestação no simulador da Caixa.",
  remuneracao: "Administração, projetos e honorários saem da verba da obra nos dois modos e reduzem a área viável. O lucro desejado (margem) também sai da verba para morar; para vender, vem do preço de venda e é dividido com o investidor. Detalhe cada parte para ela aparecer no relatório do construtor; na proposta ao cliente tudo fica dentro de \"Construção da casa\".",
  corretagemConstrucao: "Comissão do corretor que trouxe o cliente, sobre o valor da construção no contrato (sem o terreno). É paga na assinatura e sai da verba da obra; na proposta ao cliente, fica dentro de \"Construção da casa\".",
  parteConstrutor: "Quanto do lucro desejado fica com o construtor. Antes da divisão, o investidor recebe o capital de volta e o retorno mínimo. Ex.: 50% de um lucro de R$ 40 mil = R$ 20 mil para cada um.",
  precoM2Mercado: "Opcional, só para conferir se o preço sugerido é realista. Veja anúncios de casas parecidas no bairro e divida o preço pela área (ex.: 120 m² por R$ 480 mil = R$ 4.000/m²). Use a média de 3 ou 4 anúncios.",
  entradaDepositada: "Na maioria das operações a entrada em dinheiro é só comprovação de recursos: fica na conta, e o investidor aplica apenas o que a obra real pedir além do financiamento. Marque se a agência exigir o depósito; aí a entrada sai na assinatura e o que a obra não usar volta no fim.",
  corretagemLote: "Comissão que o investidor pagaria para vender o lote hoje. O lote entra no capital pelo valor líquido, que é o que ele de fato receberia.",
  custoAquisicaoLote: "Quanto foi pago pelo lote, como consta na declaração de IR. A diferença até o valor de hoje também é ganho e paga IR na venda da casa. Em branco, o app considera o valor informado do lote.",
  selic: "Meta Selic anual, consultada automaticamente no Banco Central. É a referência de renda fixa segura (Tesouro Selic) que a operação precisa superar.",
  premio: "Pontos percentuais ao ano acima da Selic líquida de IR para compensar a falta de liquidez e os riscos de obra, de venda e da dívida no nome do investidor.",
  participacao: "Parte do investidor no que sobrar depois de devolvido o capital dele e pago o retorno preferencial (Selic líquida + prêmio).",
  imovel: "Valor total informado no simulador da Caixa: terreno + orçamento da obra. É a base que o banco avalia para definir o financiamento.",
  entrada: "Diferença entre o valor do imóvel e o financiamento. Não é um pagamento ao banco: é o valor que você precisa comprovar que tem (ágio do lote, FGTS e dinheiro em conta) para o banco considerar o contrato viável. O FGTS fica com o banco e é liberado com as medições, como o financiamento; para começar a obra, tenha em mãos pelo menos 10% da construção, que volta com as liberações.",
  financiamento: "Valor que o banco empresta. Primeiro quita o saldo devedor do lote, se houver; o restante é liberado em parcelas conforme a medição da obra, nunca de uma vez.",
};

// Preço sugerido = custos + retorno mínimo do investidor + lucro desejado; o m² da região só confere com o mercado.
function PrecoReferencias({ result }: { result: ReturnType<typeof calculate> }) {
  if (!result.precoInformado) return null;
  const mercado = result.precoMercadoEstimado;
  const diferenca = mercado > 0 ? (result.precoSugerido / mercado - 1) * 100 : 0;
  const status = mercado <= 0 ? null
    : diferenca > 0 ? { cor: "border-destructive/40 bg-destructive/10 text-destructive", texto: `O preço sugerido está ${pct(diferenca)} acima do mercado estimado (${BRL.format(mercado)}): pode ser difícil vender. Reduza o lucro desejado, a área ou os custos.` }
    : { cor: "border-primary/40 bg-primary/10 text-primary", texto: `O preço sugerido está ${pct(-diferenca)} abaixo do mercado estimado (${BRL.format(mercado)}): há margem para vender.` };
  return (
    <div className="rounded-md border px-4 py-3 text-sm md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-muted-foreground">Preço de venda sugerido</span>
        <strong className="whitespace-nowrap text-lg">{BRL.format(result.precoSugerido)}</strong>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Custos da obra e do terreno, juros, corretagem, IR{result.temInvestidor ? ", retorno mínimo do investidor" : ""} e o lucro desejado de {BRL.format(result.lucroAlvoConstrutor)}{result.temInvestidor ? `, dividido: ${pct(100 - result.participacaoInvestidor)} seu e ${pct(result.participacaoInvestidor)} do investidor` : ""}. Vender por menos reduz o seu lucro (veja o cenário {Math.round(QUEDA_PRECO_CENARIO * 100)}% abaixo).
      </p>
      {status && <p className={`mt-3 rounded-md border p-2.5 text-xs ${status.cor}`}>{status.texto}</p>}
    </div>
  );
}

// Para onde vai o dinheiro da venda esperada: custos da venda, banco, capital de volta e o lucro em cascata.
function CascataVenda({ result }: { result: ReturnType<typeof calculate> }) {
  const c = result.cenarios[0];
  if (!c) return null;
  const destino: [string, number][] = [
    ["Corretagem", -c.corretagem],
    ["IR de 15% sobre o ganho", -c.ir],
    ["Baixa do financiamento e certidões", -result.despesasVenda],
    ["Quitação do financiamento", -(result.dividaNaVenda - result.folgaFinanciamento)],
    [result.temInvestidor ? "Capital do investidor de volta" : "Seu capital de volta", -result.capitalDevolvidoVenda],
  ];
  const divisao: [string, number][] = result.temInvestidor
    ? [
        ["Investidor", c.lucroInvestidor],
        ["Construtor (parte no lucro)", c.lucroConstrutor],
      ]
    : [];
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 md:col-span-2">
      <p className="text-sm font-semibold">Para onde vai o dinheiro da venda</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        <li className="flex justify-between gap-3 text-foreground"><span>Venda</span><span className="whitespace-nowrap">{BRL.format(c.venda)}</span></li>
        {destino.filter(([, valor]) => Math.abs(valor) > 0.005).map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3"><span>{rotulo}</span><span className="whitespace-nowrap">{BRL.format(valor)}</span></li>
        ))}
        <li className="flex justify-between gap-3 border-t pt-1 font-semibold text-foreground"><span>Lucro da venda</span><span className={`whitespace-nowrap ${c.saldo < 0 ? "text-destructive" : ""}`}>{BRL.format(c.saldo)}</span></li>
        {divisao.filter(([, valor]) => Math.abs(valor) > 0.005).map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3 pl-3"><span>{rotulo}</span><span className="whitespace-nowrap">{BRL.format(valor)}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Construtor: {BRL.format(result.remuneracaoResponsavel)} de remuneração durante a obra{result.temInvestidor && c.lucroConstrutor > 0.005 ? ` + ${BRL.format(c.lucroConstrutor)} na venda` : !result.temInvestidor ? ` + ${BRL.format(c.lucroConstrutor)} na venda` : ""} = <strong className="text-foreground">{BRL.format(c.ganhoConstrutor)}</strong>.
      </p>
      {c.rentabilidadeInvestidor !== null && (
        <p className={`mt-1 text-xs font-semibold ${c.superaSelic ? "text-primary" : "text-destructive"}`}>
          {result.temInvestidor ? "Investidor" : "Seu capital"}: {pct(c.rentabilidadeInvestidor)} ao ano · Selic líquida {pct(result.selicLiquida)}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">IR estimado com fator de redução da Lei 11.196/2005 e custo comprovado (lote, ITBI, registro, obra, remuneração e juros). Venda do único imóvel de até R$ 440 mil ou com reinvestimento em outro imóvel residencial em 180 dias pode ser isenta.</p>
    </div>
  );
}

// Dinheiro de quem financia, em camadas: entrada, custos fora da obra e, só acima da área viável, o aporte extra.
// O caixa para começar é temporário e a reserva cobre a venda atrasar; os fluxos datados vêm em seguida.
function CapitalInvestidor({ result }: { result: ReturnType<typeof calculate> }) {
  const grupos = Object.entries(result.aportesInvestidor.reduce<Record<string, number>>((acc, flow) => ({ ...acc, [flow.rotulo]: (acc[flow.rotulo] ?? 0) + flow.valor }), {}));
  const camadas: [string, number][] = [
    ["Entrada (vira obra; comprovação no banco)", result.investidorEntrada],
    ["Taxas, cartório, juros e parcelas até a venda", result.investidorCustos],
    ["Aporte além da entrada (área acima da viável)", result.investidorAlemEntrada],
  ];
  return (
    <div className="rounded-md border px-4 py-3 md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">{result.temInvestidor ? "O investidor precisa ter" : "Você precisa ter"}</p>
        <p className="text-lg font-bold">{BRL.format(result.investidorTotal)}</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {camadas.filter(([, valor]) => valor > 0.005).map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3"><span className="text-muted-foreground">{rotulo}</span><span className="whitespace-nowrap">{BRL.format(valor)}</span></li>
        ))}
      </ul>
      {result.investidorAlemEntrada <= 0.005 && <p className="mt-2 text-xs text-primary">Área dentro da viável: nenhum aporte além da entrada.</p>}
      <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
        {result.capitalGiro > 0.005 && <li className="flex justify-between gap-3"><span>Caixa temporário para começar (volta com as medições)</span><span className="whitespace-nowrap">{BRL.format(result.capitalGiro)}</span></li>}
        {result.reservaAtraso > 0.005 && <li className="flex justify-between gap-3"><span>Reserva se a venda atrasar {MESES_ATRASO_VENDA} meses</span><span className="whitespace-nowrap">{BRL.format(result.reservaAtraso)}</span></li>}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Quando cada valor sai:</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {grupos.map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3"><span>{rotulo}</span><span className="whitespace-nowrap">{BRL.format(valor)}</span></li>
        ))}
      </ul>
      {result.temInvestidor && result.participacaoInvestidor < 100 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Retorno mínimo: {pct(result.taxaPreferencial)} ao ano (Selic {pct(result.selicAnual)} − IR {pct(result.aliquotaIr)} + prêmio) = {BRL.format(result.retornoPreferencial)} até a venda, no mês {result.mesVenda}.
          {result.capitalGiro > 0 && " O caixa para começar volta com as liberações, ao fim da obra."}
        </p>
      )}
    </div>
  );
}

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`O que é ${label}`} className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary">
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}

type CubReference = {
  valor: number;
  competencia: string;
  projeto: string;
  origem: string;
  fonte: string;
  oficial: boolean;
};

// Valores que chegam da pré-análise pela renda para preencher uma simulação nova.
type BuscaNova = {
  editar?: string;
  renda?: number;
  credito?: number;
  valorImovel?: number;
  fgts?: number;
  terreno?: number;
  lote?: "proprio" | "compra";
  juros?: number;
  prazoFin?: number;
  sistema?: SistemaAmortizacao;
  seguro?: number;
};

function lerBusca(search: Record<string, unknown>): BuscaNova {
  const numero = (chave: string) => {
    const valor = Number(search[chave]);
    return search[chave] !== undefined && Number.isFinite(valor) && valor >= 0 ? valor : undefined;
  };
  const busca: BuscaNova = {};
  if (typeof search["editar"] === "string") busca.editar = search["editar"];
  for (const chave of ["renda", "credito", "valorImovel", "fgts", "terreno", "juros", "prazoFin", "seguro"] as const) {
    const valor = numero(chave);
    if (valor !== undefined) busca[chave] = valor;
  }
  if (search["lote"] === "proprio" || search["lote"] === "compra") busca.lote = search["lote"];
  if (search["sistema"] === "PRICE" || search["sistema"] === "SAC") busca.sistema = search["sistema"];
  return busca;
}

export const Route = createFileRoute("/_authenticated/simulacao/nova")({
  validateSearch: (search: Record<string, unknown>): BuscaNova => lerBusca(search),
  head: () => ({
    meta: [
      { title: "Nova simulação | Sinal Verde da Obra" },
      { name: "description", content: "Calcule a viabilidade financeira da sua construção." },
      { property: "og:title", content: "Nova simulação" },
      { property: "og:description", content: "Calcule área, custos e cenários da obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wizard,
});

function Wizard() {
  const nav = useNavigate();
  const busca = Route.useSearch();
  const { editar } = busca;
  const fetchCub = useServerFn(getResidentialCub);
  const fetchSelic = useServerFn(getSelicMeta);
  const fetchTr = useServerFn(getTrMensal);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editar));
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("Minha obra");
  const [terreno, setTerreno] = useState(0);
  const [situacao, setSituacao] = useState<"quitado" | "financiado">("quitado");
  const [origemTerreno, setOrigemTerreno] = useState<OrigemTerreno>("investidor");
  const [selicAnual, setSelicAnual] = useState(0);
  const [selicFonte, setSelicFonte] = useState("");
  const [premioInvestidor, setPremioInvestidor] = useState(5);
  const [corretagemLote, setCorretagemLote] = useState(5);
  const [custoAquisicaoLote, setCustoAquisicaoLote] = useState(0);
  const [lucroConstrutor, setLucroConstrutor] = useState(0);
  const [precoM2Mercado, setPrecoM2Mercado] = useState(0);
  const [corretagemConstrucao, setCorretagemConstrucao] = useState(0);
  const [temInvestidor, setTemInvestidor] = useState(true);
  const [entradaDepositada, setEntradaDepositada] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [renda, setRenda] = useState(0);
  const [credito, setCredito] = useState(0);
  const [estado, setEstado] = useState("");
  const [padrao, setPadrao] = useState<"baixo" | "normal" | "alto" | "">("");
  const [cubRef, setCubRef] = useState<CubReference | null>(null);
  const [savedCub, setSavedCub] = useState(0);
  const [cubLoading, setCubLoading] = useState(false);
  const [valorImovel, setValorImovel] = useState(0);
  const [fgtsUtilizado, setFgtsUtilizado] = useState(0);
  const [jurosAnuais, setJurosAnuais] = useState(0);
  const [trMensal, setTrMensal] = useState(0);
  const [trFonte, setTrFonte] = useState("");
  const [seguroTarifaMensal, setSeguroTarifaMensal] = useState(0);
  const [sistemaAmortizacao, setSistemaAmortizacao] = useState<SistemaAmortizacao>("PRICE");
  const [prazoFinanciamento, setPrazoFinanciamento] = useState(420);
  const [maoDeObra, setMaoDeObra] = useState(0);
  const [materiais, setMateriais] = useState(0);
  const [areaPlanejada, setAreaPlanejada] = useState(0);
  const [extras, setExtras] = useState<Extra[]>(
    suggestions.map((descricao) => ({ descricao, valor: 0 })),
  );
  const [cronograma, setCronograma] = useState(stages);
  const [prazoExecucao, setPrazoExecucao] = useState(6);
  const [liberacoes, setLiberacoes] = useState<MonthlyRelease[]>(pciReleases(6));
  const [prazoEditado, setPrazoEditado] = useState(false);
  const [objetivo, setObjetivo] = useState<"morar" | "vender">("morar");
  const [lucro, setLucro] = useState(0);
  const [corretagem, setCorretagem] = useState(5);
  const [prazo, setPrazo] = useState(0);
  // Parte do investidor no lucro que sobra; o padrão é tudo para ele (o construtor ganha pela remuneração).
  const [participacaoInvestidor, setParticipacaoInvestidor] = useState(100);
  const [projetos, setProjetos] = useState(0);
  const [administracao, setAdministracao] = useState(0);
  const [honorarios, setHonorarios] = useState(0);
  const [primeiroImovelSfh, setPrimeiroImovelSfh] = useState(false);
  const [expenseOverrides, setExpenseOverrides] = useState<Record<string, number>>({});
  const [erro, setErro] = useState("");
  const [erroVez, setErroVez] = useState(0);
  // Mostra o erro e rola até ele mesmo quando a mensagem se repete.
  function mostrarErro(mensagem: string) { setErro(mensagem); setErroVez((vez) => vez + 1); }
  const cub = cubRef?.valor ?? savedCub;
  const topoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const erroRef = useRef<HTMLParagraphElement>(null);
  const primeiraEtapa = useRef(true);
  // Ao trocar de etapa, volta para o início do preenchimento; o foco vai ao título (sem abrir o teclado no celular).
  useEffect(() => {
    if (primeiraEtapa.current) { primeiraEtapa.current = false; return; }
    topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    tituloRef.current?.focus({ preventScroll: true });
  }, [step]);
  // O aviso de erro fica junto do botão; rola até ele para não passar despercebido.
  useEffect(() => {
    if (erro) erroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erro, erroVez]);
  const custoReal = maoDeObra + materiais;
  const baseResult = useMemo(
    () => calculate({ credito, terreno, saldoDevedor: situacao === "financiado" ? saldo : 0, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor: objetivo === "vender" ? lucroConstrutor : null, precoM2Mercado: objetivo === "vender" ? precoM2Mercado : 0, corretagemConstrucao: objetivo === "morar" ? corretagemConstrucao : 0, temInvestidor, entradaDepositada, administracao, projetos, honorarios, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, areaPlanejada: 0, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, sistemaAmortizacao, prazoFinanciamento, stages: cronograma, liberacoes, despesas: [], participacaoInvestidor }),
    [credito, terreno, situacao, saldo, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, precoM2Mercado, corretagemConstrucao, temInvestidor, entradaDepositada, administracao, projetos, honorarios, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, sistemaAmortizacao, prazoFinanciamento, cronograma, liberacoes, participacaoInvestidor],
  );
  // ITBI e registro de compra só quando o lote muda de dono na operação.
  const transferenciaLote = origemTerreno !== "investidor" || (situacao === "financiado" && saldo > 0);
  const estimates = useMemo(
    // Alvará e INSS acompanham a área planejada; antes de defini-la, usam a área viável.
    () => estimatedExpenses(terreno, credito, projetos, administracao, honorarios, cub, areaPlanejada > 0 ? areaPlanejada : baseResult.areaViavelMaxima, estado, primeiroImovelSfh, transferenciaLote, objetivo === "vender"),
    [terreno, credito, projetos, administracao, honorarios, cub, areaPlanejada, baseResult.areaViavelMaxima, estado, primeiroImovelSfh, transferenciaLote, objetivo],
  );
  const despesas = useMemo(
    () => estimates.map((item) => ({ ...item, valor: expenseOverrides[item.id] ?? item.valor })),
    [estimates, expenseOverrides],
  );
  const result = useMemo(
    () =>
      calculate({
        credito,
        terreno,
        saldoDevedor: situacao === "financiado" ? saldo : 0,
        valorImovel,
        fgtsUtilizado,
        cub,
        maoDeObra,
        materiais,
        areaPlanejada,
        extras,
        objetivo,
        lucro,
        corretagem,
        prazo,
        jurosAnuais,
        trMensal,
        seguroTarifaMensal,
        sistemaAmortizacao,
        prazoFinanciamento,
        stages: cronograma,
        liberacoes,
        despesas,
        participacaoInvestidor,
        origemTerreno,
        selicAnual,
        premioInvestidor,
        corretagemLote,
        custoAquisicaoLote,
        lucroConstrutor: objetivo === "vender" ? lucroConstrutor : null,
        precoM2Mercado: objetivo === "vender" ? precoM2Mercado : 0,
        corretagemConstrucao: objetivo === "morar" ? corretagemConstrucao : 0,
        temInvestidor,
        entradaDepositada,
        administracao,
        projetos,
        honorarios,
      }),
    [credito, terreno, situacao, saldo, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, precoM2Mercado, corretagemConstrucao, temInvestidor, entradaDepositada, administracao, projetos, honorarios, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, areaPlanejada, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, sistemaAmortizacao, prazoFinanciamento, cronograma, liberacoes, despesas, participacaoInvestidor],
  );
  // Pré-preenchimento vindo da pré-análise pela renda (só em simulação nova).
  useEffect(() => {
    if (editar || busca.renda === undefined) return;
    setObjetivo("morar");
    setRenda(busca.renda);
    if (busca.credito !== undefined) setCredito(busca.credito);
    if (busca.valorImovel !== undefined) setValorImovel(busca.valorImovel);
    if (busca.fgts !== undefined) setFgtsUtilizado(busca.fgts);
    if (busca.terreno !== undefined) setTerreno(busca.terreno);
    if (busca.lote) setOrigemTerreno(busca.lote === "proprio" ? "investidor" : "compra");
    if (busca.juros !== undefined) setJurosAnuais(busca.juros);
    if (busca.prazoFin) setPrazoFinanciamento(busca.prazoFin);
    if (busca.sistema) setSistemaAmortizacao(busca.sistema);
    if (busca.seguro !== undefined) setSeguroTarifaMensal(busca.seguro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!editar) return;
    let active = true;
    supabase.from("simulacoes").select("*").eq("id", editar).single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { mostrarErro("Simulação não encontrada ou sem permissão para editar."); setLoadingEdit(false); return; }
       const saved = data.resultado as unknown as Partial<ReturnType<typeof calculate>> & { projetos?: number; administracao?: number; honorarios?: number; expenseOverrides?: Record<string, number>; cubReferencia?: CubReference; primeiroImovelSfh?: boolean; corretagemLote?: number; custoAquisicaoLote?: number };
      setNome(data.nome); setTerreno(data.terreno_valor); setSituacao(data.terreno_situacao as "quitado" | "financiado");
      setSaldo(data.saldo_devedor_terreno ?? 0); setRenda(data.renda_declarada); setCredito(data.credito_aprovado);
      setEstado(data.estado); setPadrao(data.padrao_acabamento as "baixo" | "normal" | "alto");
      setSavedCub(data.cub_valor_m2);
      if (saved.cubReferencia) setCubRef(saved.cubReferencia as CubReference);
       setValorImovel(saved.valorOperacao ?? data.credito_aprovado / ((saved as { percentualFinanciamento?: number }).percentualFinanciamento ?? 80) * 100); setFgtsUtilizado(saved.fgtsUtilizado ?? 0);

       setJurosAnuais(saved.taxaJurosAnual ?? monthlyToAnnualRate(data.taxa_juros_obra_mensal)); if (saved.trMensal !== undefined) { setTrMensal(saved.trMensal); setTrFonte("valor salvo na simulação"); } setSeguroTarifaMensal(saved.seguroTarifaMensal ?? 0); setSistemaAmortizacao(saved.sistemaAmortizacao ?? "PRICE"); setPrazoFinanciamento(saved.prazoFinanciamento ?? 420); setMaoDeObra(saved.maoDeObra ?? (saved.custoM2 ?? 0) / 2);
      setMateriais(saved.materiais ?? (saved.custoM2 ?? 0) / 2);
       setAreaPlanejada(saved.areaPlanejada ?? saved.areaViavelMinima ?? saved.areaViavel ?? 0);
      setExtras(Array.isArray(data.custos_extras) ? data.custos_extras as Extra[] : []);
      setCronograma(saved.cronograma?.map(({ nome, percentual }) => ({ nome, percentual })) ?? stages);
       if (saved.liberacoesMensais?.length) {
         setPrazoExecucao(saved.prazoExecucaoMeses ?? saved.liberacoesMensais.length);
         setLiberacoes(saved.liberacoesMensais.map(({ mes, percentual }) => ({ mes, percentual })));
         setPrazoEditado(true);
       }
      setObjetivo(data.objetivo as "morar" | "vender");
      // Margem: do detalhe salvo; em vendas antigas o campo guardava o lucro da venda, que não é margem.
      const detalhe = (saved as { remuneracaoDetalhe?: { margem: number } }).remuneracaoDetalhe;
      setLucro(detalhe ? detalhe.margem : data.objetivo === "vender" ? 0 : data.lucro_desejado ?? 0);
      setCorretagem(saved.corretagemPercentual ?? 5); setPrazo(saved.mesesAposObra ?? data.prazo_venda_meses ?? 0);
       setParticipacaoInvestidor(saved.participacaoInvestidor ?? 0);
      setPrimeiroImovelSfh(saved.primeiroImovelSfh ?? false);
      setOrigemTerreno(saved.origemTerreno ?? "investidor");
      setPremioInvestidor(saved.premioInvestidor ?? 5);
      setCorretagemLote(saved.corretagemLote ?? 5); setCustoAquisicaoLote(saved.custoAquisicaoLote ?? 0);
      const venda = saved as { precoVenda?: number; precoM2Mercado?: number; temInvestidor?: boolean; entradaDepositada?: boolean };
      // Simulações antigas: o preço calculado vira o preço esperado; o investidor existia se havia participação.
      setPrecoM2Mercado(venda.precoM2Mercado ?? 0);
      setCorretagemConstrucao((saved as { corretagemConstrucaoPct?: number }).corretagemConstrucaoPct ?? 0);
      setTemInvestidor(venda.temInvestidor ?? ((saved.participacaoInvestidor ?? 0) > 0 || (saved.aportesInvestidor?.length ?? 0) > 0));
      setEntradaDepositada(venda.entradaDepositada ?? false);
      setLucroConstrutor(saved.lucroConstrutorDesejado ?? Math.max(saved.cenarios?.[1]?.lucroConstrutor ?? 0, 0));
      if (saved.selicAnual) { setSelicAnual(saved.selicAnual); setSelicFonte("valor salvo na simulação"); }
      setProjetos(saved.projetos ?? 0); setAdministracao(saved.administracao ?? 0); setHonorarios(saved.honorarios ?? 0);
      setExpenseOverrides(saved.expenseOverrides ?? Object.fromEntries((saved.despesas ?? []).map((x) => [x.id, x.valor])));
      setLoadingEdit(false);
    });
    return () => { active = false; };
  }, [editar]);
  useEffect(() => {
    if (loadingEdit || trFonte) return;
    let active = true;
    fetchTr().then((data) => {
      if (!active) return;
      if (data.oficial) { setTrMensal(data.valor); setTrFonte(`TR do Banco Central para o período iniciado em ${data.data}`); }
      else setTrFonte("não foi possível consultar o Banco Central; informe a TR");
    });
    return () => { active = false; };
  }, [loadingEdit, trFonte, fetchTr]);
  useEffect(() => {
    if (loadingEdit || selicFonte) return;
    let active = true;
    fetchSelic().then((data) => {
      if (!active) return;
      if (data.oficial) { setSelicAnual(data.valor); setSelicFonte(`meta Selic do Banco Central em ${data.data}`); }
      else setSelicFonte("não foi possível consultar o Banco Central; informe a taxa");
    });
    return () => { active = false; };
  }, [loadingEdit, selicFonte, fetchSelic]);
  useEffect(() => {
    let active = true;
    setCubRef(null);
    // Sem estado e padrão escolhidos não há CUB de referência (evita comparar com o estado errado).
    if (!estado || !padrao) { setCubLoading(false); return; }
    setCubLoading(true);
    fetchCub({ data: { estado, padrao } })
      .then((data) => {
        if (active) setCubRef(data);
      })
      .catch(() => {
        if (active) setCubRef(null);
      })
      .finally(() => {
        if (active) setCubLoading(false);
      });
    return () => {
      active = false;
    };
  }, [estado, padrao, fetchCub]);
  useEffect(() => {
    // O prazo sugerido acompanha a área planejada; antes de defini-la, usa a área viável.
    const areaReferencia = areaPlanejada > 0 ? areaPlanejada : baseResult.areaViavelMinima;
    if (loadingEdit || prazoEditado || areaReferencia <= 0) return;
    const suggested = suggestedExecutionMonths(areaReferencia);
    if (suggested !== prazoExecucao) {
      setPrazoExecucao(suggested);
      setLiberacoes(pciReleases(suggested));
    }
  }, [areaPlanejada, baseResult.areaViavelMinima, loadingEdit, prazoEditado, prazoExecucao]);
  // Rascunho no navegador: o preenchimento sobrevive a recarregar a página ou sair sem salvar.
  const chaveRascunho = `sinal-verde:rascunho:${editar ?? "nova"}`;
  const instantaneo = useMemo(() => ({ step, nome, terreno, situacao, origemTerreno, selicAnual, selicFonte, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, saldo, renda, credito, estado, padrao, savedCub, valorImovel, fgtsUtilizado, jurosAnuais, trMensal, trFonte, seguroTarifaMensal, sistemaAmortizacao, prazoFinanciamento, maoDeObra, materiais, areaPlanejada, extras, cronograma, prazoExecucao, liberacoes, prazoEditado, objetivo, lucro, corretagem, prazo, participacaoInvestidor, projetos, administracao, honorarios, primeiroImovelSfh, expenseOverrides, precoM2Mercado, corretagemConstrucao, temInvestidor, entradaDepositada }), [step, nome, terreno, situacao, origemTerreno, selicAnual, selicFonte, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, saldo, renda, credito, estado, padrao, savedCub, valorImovel, fgtsUtilizado, jurosAnuais, trMensal, trFonte, seguroTarifaMensal, sistemaAmortizacao, prazoFinanciamento, maoDeObra, materiais, areaPlanejada, extras, cronograma, prazoExecucao, liberacoes, prazoEditado, objetivo, lucro, corretagem, prazo, participacaoInvestidor, projetos, administracao, honorarios, primeiroImovelSfh, expenseOverrides, precoM2Mercado, corretagemConstrucao, temInvestidor, entradaDepositada]);
  const [tocado, setTocado] = useState(false);
  const [rascunho, setRascunho] = useState<{ salvoEm: number; dados: Partial<typeof instantaneo> } | null>(null);
  useEffect(() => {
    // Vindo da pré-análise, os dados novos têm prioridade sobre um rascunho antigo.
    if (busca.renda !== undefined) return;
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      if (salvo) setRascunho(JSON.parse(salvo));
    } catch {
      // Sem acesso ao armazenamento do navegador: segue sem rascunho.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveRascunho]);
  useEffect(() => {
    if (!tocado) return;
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify({ salvoEm: Date.now(), dados: instantaneo }));
    } catch {
      // Armazenamento cheio ou bloqueado: o rascunho é só uma conveniência.
    }
  }, [instantaneo, tocado, chaveRascunho]);
  useEffect(() => {
    if (!tocado) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [tocado]);
  function descartarRascunho() {
    try { localStorage.removeItem(chaveRascunho); } catch { /* sem armazenamento */ }
    setRascunho(null);
  }
  function restaurarRascunho() {
    const d = rascunho?.dados;
    if (!d) return;
    if (d.step !== undefined) setStep(d.step);
    if (d.nome !== undefined) setNome(d.nome);
    if (d.terreno !== undefined) setTerreno(d.terreno);
    if (d.situacao !== undefined) setSituacao(d.situacao);
    if (d.origemTerreno !== undefined) setOrigemTerreno(d.origemTerreno);
    if (d.selicAnual !== undefined) setSelicAnual(d.selicAnual);
    if (d.selicFonte !== undefined) setSelicFonte(d.selicFonte);
    if (d.premioInvestidor !== undefined) setPremioInvestidor(d.premioInvestidor);
    if (d.corretagemLote !== undefined) setCorretagemLote(d.corretagemLote);
    if (d.custoAquisicaoLote !== undefined) setCustoAquisicaoLote(d.custoAquisicaoLote);
    if (d.lucroConstrutor !== undefined) setLucroConstrutor(d.lucroConstrutor);
    if (d.saldo !== undefined) setSaldo(d.saldo);
    if (d.renda !== undefined) setRenda(d.renda);
    if (d.credito !== undefined) setCredito(d.credito);
    if (d.estado !== undefined) setEstado(d.estado);
    if (d.padrao !== undefined) setPadrao(d.padrao);
    if (d.savedCub !== undefined) setSavedCub(d.savedCub);
    if (d.valorImovel !== undefined) setValorImovel(d.valorImovel);
    if (d.fgtsUtilizado !== undefined) setFgtsUtilizado(d.fgtsUtilizado);
    if (d.jurosAnuais !== undefined) setJurosAnuais(d.jurosAnuais);
    if (d.trMensal !== undefined) setTrMensal(d.trMensal);
    if (d.trFonte !== undefined) setTrFonte(d.trFonte);
    if (d.seguroTarifaMensal !== undefined) setSeguroTarifaMensal(d.seguroTarifaMensal);
    if (d.sistemaAmortizacao !== undefined) setSistemaAmortizacao(d.sistemaAmortizacao);
    if (d.prazoFinanciamento !== undefined) setPrazoFinanciamento(d.prazoFinanciamento);
    if (d.maoDeObra !== undefined) setMaoDeObra(d.maoDeObra);
    if (d.materiais !== undefined) setMateriais(d.materiais);
    if (d.areaPlanejada !== undefined) setAreaPlanejada(d.areaPlanejada);
    if (d.extras !== undefined) setExtras(d.extras);
    if (d.cronograma !== undefined) setCronograma(d.cronograma);
    if (d.prazoExecucao !== undefined) setPrazoExecucao(d.prazoExecucao);
    if (d.liberacoes !== undefined) setLiberacoes(d.liberacoes);
    if (d.prazoEditado !== undefined) setPrazoEditado(d.prazoEditado);
    if (d.objetivo !== undefined) setObjetivo(d.objetivo);
    if (d.lucro !== undefined) setLucro(d.lucro);
    if (d.corretagem !== undefined) setCorretagem(d.corretagem);
    if (d.prazo !== undefined) setPrazo(d.prazo);
    if (d.participacaoInvestidor !== undefined) setParticipacaoInvestidor(d.participacaoInvestidor);
    if (d.projetos !== undefined) setProjetos(d.projetos);
    if (d.administracao !== undefined) setAdministracao(d.administracao);
    if (d.honorarios !== undefined) setHonorarios(d.honorarios);
    if (d.primeiroImovelSfh !== undefined) setPrimeiroImovelSfh(d.primeiroImovelSfh);
    if (d.expenseOverrides !== undefined) setExpenseOverrides(d.expenseOverrides);
    if (d.precoM2Mercado !== undefined) setPrecoM2Mercado(d.precoM2Mercado);
    if (d.corretagemConstrucao !== undefined) setCorretagemConstrucao(d.corretagemConstrucao);
    if (d.temInvestidor !== undefined) setTemInvestidor(d.temInvestidor);
    if (d.entradaDepositada !== undefined) setEntradaDepositada(d.entradaDepositada);
    setRascunho(null);
    setTocado(true);
  }
  // Qualquer digitação ou escolha dentro do formulário (exceto os botões de navegação) marca alterações.
  function marcarTocado(event: React.SyntheticEvent) {
    if (!(event.target instanceof Element) || event.target.closest("[data-navegacao]")) return;
    if (event.type === "click" && !event.target.closest("button, label, [role=checkbox]")) return;
    // Marca fora do evento: atualizar estado durante a captura fazia o 1º caractere digitado se perder.
    if (!tocado) setTimeout(() => setTocado(true), 0);
  }
  function stepError(n: number) {
    if (n === 1 && (!credito || !renda || !valorImovel)) return "Informe a renda, o valor do imóvel e o valor do financiamento para continuar.";
    if (n === 1 && valorImovel < credito) return "O valor do imóvel não pode ser menor que o valor do financiamento.";
    if (n === 2 && !estado) return "Escolha o estado: ele define as taxas de cartório e o CUB de comparação.";
    if (n === 2 && !padrao) return "Escolha o padrão de acabamento.";
    if (n === 2 && jurosAnuais <= 0) return "Informe a taxa de juros efetiva anual do simulador da Caixa.";
    if (n === 2 && seguroTarifaMensal <= 0) return "Informe seguros (MIP e DFI) e tarifa por mês do simulador da Caixa.";
    if (n === 2 && custoReal <= 0) return "Informe mão de obra e materiais por m² para calcular a área.";
    return "";
  }
  // Voltar é livre; para avançar, as etapas anteriores ao destino precisam estar completas.
  function goTo(target: number) {
    for (let n = 1; n < target; n++) {
      const message = stepError(n);
      if (message) { mostrarErro(message); setStep(n); return; }
    }
    setErro("");
    // A viabilidade (etapa 3) começa com a área viável mínima; o cronograma fica por último.
    if (target >= 3 && areaPlanejada <= 0) setAreaPlanejada(result.areaViavelMinima);
    setStep(target);
  }
  function next() {
    goTo(Math.min(4, step + 1));
  }
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    for (let n = 1; n <= 3; n++) {
      const message = stepError(n);
      if (message) { mostrarErro(message); setStep(n); return; }
    }
    if (corretagem < 0 || corretagem >= 100 || participacaoInvestidor < 0 || participacaoInvestidor > 100 || prazo < 0) {
      mostrarErro("Revise a corretagem, a participação do investidor e os meses até a venda."); return;
    }
    if (valorImovel < credito || Math.abs(liberacoes.reduce((sum, item) => sum + item.percentual, 0) - 100) > 0.01 || Math.abs(cronograma.reduce((sum, item) => sum + item.percentual, 0) - 100) > 0.01) {
      mostrarErro("Revise o valor do imóvel e os dois cronogramas: cada cronograma deve somar 100%."); return;
    }
    const payloadResult = { ...result, precoM2Mercado, cubReferencia: cubRef, projetos, administracao, honorarios, expenseOverrides, primeiroImovelSfh, corretagemLote, custoAquisicaoLote };
    if (custoReal <= 0) { mostrarErro("Informe o custo real por m²."); setStep(2); return; }
    const payload = {
        nome,
        terreno_valor: terreno,
        terreno_situacao: situacao,
        saldo_devedor_terreno: situacao === "financiado" ? saldo : null,
        renda_declarada: renda,
        credito_aprovado: credito,
        estado,
        padrao_acabamento: padrao,
        cub_valor_m2: cub,
        bdi_percentual: 18,
        custos_extras: extras,
        objetivo,
        lucro_desejado: result.remuneracaoResponsavel,
        prazo_venda_meses: objetivo === "vender" ? prazo : null,
         taxa_juros_obra_mensal: annualToMonthlyRate(jurosAnuais),
        resultado: payloadResult,
    };
    const query = editar
      ? supabase.from("simulacoes").update(payload).eq("id", editar).eq("user_id", u.user.id)
      : supabase.from("simulacoes").insert({ ...payload, user_id: u.user.id });
    const { data, error } = await query
      .select("id")
      .single();
    if (error || !data) {
      mostrarErro("Não foi possível salvar. Revise os dados e tente novamente.");
      return;
    }
    descartarRascunho();
    setTocado(false);
    nav({ to: "/simulacao/$id", params: { id: data.id } });
  }
  const field = (label: string, value: number, set: (n: number) => void, monetary = true, help?: string, placeholder?: string) => (
    <div>
      <div className="flex items-center gap-1.5"><Label>{label}</Label>{help && <InfoTip label={label} text={help} />}</div>
      <NumericInput
        className="mt-2 h-11"
        min="0"
        value={value}
        decimals={2}
        monetary={monetary}
        onValueChange={set}
        {...(placeholder ? { placeholder } : {})}
      />
    </div>
  );
  if (loadingEdit) return <AppShell><div className="mx-auto h-52 max-w-3xl animate-pulse rounded-lg bg-muted" /></AppShell>;
  return (
    <AppShell>
      <div className="mx-auto grid max-w-3xl gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_280px]">
      <LivePanel result={result} objetivo={objetivo} renda={renda} />
      <div ref={topoRef} className="min-w-0 scroll-mt-20 lg:col-start-1 lg:row-start-1">
        <p className="text-sm font-semibold text-primary">{editar ? "EDITAR SIMULAÇÃO" : "NOVA SIMULAÇÃO"}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 ref={tituloRef} tabIndex={-1} className="text-3xl font-bold outline-none">
            {
              [
                "Ponto de partida",
                "Orçamento sem surpresa",
                "Sinal de viabilidade",
                "Cronograma do banco",
              ][step - 1]
            }
          </h1>
          <span className="shrink-0 text-sm text-muted-foreground">{step} de 4</span>
        </div>
        <nav className="mt-6 grid grid-cols-4 gap-2" aria-label="Etapas da simulação">
          {STEP_LABELS.map((label, index) => {
            const n = index + 1;
            return (
              <button key={label} type="button" onClick={() => goTo(n)} aria-current={n === step ? "step" : undefined} className="group text-left">
                <span className={`block h-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted group-hover:bg-muted-foreground/40"}`} />
                <span className={`mt-2 block truncate text-[11px] sm:text-xs ${n === step ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{label}</span>
              </button>
            );
          })}
        </nav>
        {rascunho && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-secondary/40 bg-secondary/10 p-4 text-sm">
            <p>Há um preenchimento não salvo de {new Date(rascunho.salvoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={descartarRascunho}>Descartar</Button>
              <Button type="button" size="sm" onClick={restaurarRascunho}>Continuar de onde parei</Button>
            </div>
          </div>
        )}
        <Card className="mt-8" onInputCapture={marcarTocado} onClickCapture={marcarTocado}>
          <CardContent className="p-6 md:p-8">
            {step === 1 && (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Nome da simulação</Label>
                  <Input
                    className="mt-2 h-11"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Origem do terreno</Label>
                  <select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={origemTerreno} onChange={(e) => setOrigemTerreno(e.target.value as OrigemTerreno)}>
                    <option value="investidor">Próprio (de quem vai financiar)</option>
                    <option value="construtor">Do construtor, vendido na operação</option>
                    <option value="compra">Comprado de terceiro na operação</option>
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">{ORIGEM_NOTA[origemTerreno]}</p>
                </div>
                {field(origemTerreno === "investidor" ? "Valor do terreno" : "Preço de compra do terreno", terreno, setTerreno)}
                {origemTerreno === "investidor" && <div>
                  <Label>Situação do terreno</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                    value={situacao}
                    onChange={(e) => setSituacao(e.target.value as typeof situacao)}
                  >
                    <option value="quitado">Quitado</option>
                    <option value="financiado">Financiado</option>
                  </select>
                </div>}
                {origemTerreno === "investidor" && situacao === "financiado" && field("Saldo devedor", saldo, setSaldo)}
                {field("Renda declarada", renda, setRenda)}
                <div className="grid gap-5 rounded-md border p-4 md:col-span-2 md:grid-cols-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground md:col-span-3">Simulador da Caixa</p>
                  {field("Valor do imóvel", valorImovel, setValorImovel, true, HELP.imovel)}
                  <div>
                    <div className="flex items-center gap-1.5"><Label>Valor de entrada</Label><InfoTip label="Valor de entrada" text={HELP.entrada} /></div>
                    <div className="mt-2 flex h-11 items-center rounded-md border bg-muted/40 px-3 font-semibold">{BRL.format(baseResult.entradaExigida)}</div>
                  </div>
                  {field("Valor do financiamento", credito, setCredito, true, HELP.financiamento)}
                  {/* Financiamento menor que a entrada costuma ser digitação trocada com o simulador da Caixa. */}
                  {credito > 0 && valorImovel > credito && credito < baseResult.entradaExigida && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive md:col-span-3">
                      O financiamento ({BRL.format(credito)}) está menor que a entrada ({BRL.format(baseResult.entradaExigida)}). Os valores parecem invertidos: confira o valor do financiamento no simulador da Caixa.
                    </p>
                  )}
                </div>
                {objetivo === "vender" ? (
                  <p className="self-end rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">FGTS não é usado em obra para venda: ele se destina à moradia própria do titular, e usá-lo aqui comprometeria o saldo para a casa dele no futuro. A entrada é composta pelo ágio do terreno e por dinheiro.</p>
                ) : (
                  field("FGTS disponível para a entrada", fgtsUtilizado, setFgtsUtilizado)
                )}
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4 text-sm md:col-span-2" htmlFor="primeiro-imovel-sfh">
                  <Checkbox id="primeiro-imovel-sfh" className="mt-0.5" checked={primeiroImovelSfh} onCheckedChange={(checked) => setPrimeiroImovelSfh(checked === true)} />
                  <span>
                    <strong className="block">Primeiro imóvel financiado (SFH)</strong>
                    <span className="text-muted-foreground">Desconto de 50% em cartório (Art. 290 da Lei 6.015/73) nos registros de compra e venda e de alienação fiduciária.</span>
                  </span>
                </label>
                <div className="md:col-span-2 border-y py-4 text-sm">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Como você comprova a entrada</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <p><span className="text-muted-foreground">Ágio do lote</span><strong className="mt-1 block">{BRL.format(baseResult.agioNaEntrada)}</strong></p>
                    {objetivo !== "vender" && <p><span className="text-muted-foreground">FGTS</span><strong className="mt-1 block">{BRL.format(baseResult.fgtsNaEntrada)}</strong></p>}
                    <p><span className="text-muted-foreground">Dinheiro necessário</span><strong className={`mt-1 block ${baseResult.dinheiroEntrada > 0 ? "text-secondary" : "text-primary"}`}>{BRL.format(baseResult.dinheiroEntrada)}</strong></p>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Orçamento da obra no contrato (imóvel − terreno): <strong className="text-foreground">{BRL.format(baseResult.orcamentoObraContrato)}</strong></p>
                  {baseResult.financiamentoExcedente > 0 && <p className="mt-3 text-xs text-secondary">O ágio cobre mais que a entrada: o banco tende a liberar no máximo {BRL.format(baseResult.financiamentoConstrucao)} para a obra ({BRL.format(baseResult.financiamentoExcedente)} a menos que o valor informado).</p>}
                  {(origemTerreno !== "investidor" || situacao === "financiado") && <p className="mt-3 text-xs text-muted-foreground">{origemTerreno === "investidor" ? "Quitação do lote pelo banco" : "Pagamento do lote pelo banco ao vendedor"}: {BRL.format(baseResult.quitacaoLote)}.{baseResult.saldoLoteNaoCoberto > 0 && ` Saldo não coberto: ${BRL.format(baseResult.saldoLoteNaoCoberto)}.`} Limite para o lote: 30% do contrato ({BRL.format(baseResult.limiteFinanciavelLote)}).{baseResult.saldoLoteNaoCoberto > 0 && " O excedente sai da entrada em dinheiro."}</p>}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label>Estado</Label>
                    <select
                      className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                    >
                      <option value="" disabled>Selecione o estado</option>
                      {ufs.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Padrão de acabamento</Label>
                    <select
                      className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                      value={padrao}
                      onChange={(e) => setPadrao(e.target.value as typeof padrao)}
                    >
                      <option value="" disabled>Selecione o padrão</option>
                      <option value="baixo">Baixo</option>
                      <option value="normal">Normal</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                  <div>
                    <Label>CUB publicado por m² · referência</Label>
                    <div className="mt-2 flex h-11 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold">
                      {cubLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Consultando fonte
                        </>
                      ) : cub ? (
                        BRL.format(cub)
                      ) : !estado || !padrao ? (
                        <span className="font-normal text-muted-foreground">Escolha o estado e o padrão</span>
                      ) : (
                        "Referência indisponível"
                      )}
                    </div>
                    {cubRef && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {cubRef.projeto} · {cubRef.competencia} · {cubRef.origem}{" "}
                        <a
                          className="inline-flex text-primary"
                          href={cubRef.fonte}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Abrir fonte do CUB"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </p>
                    )}
                  </div>
                   {field("Taxa de juros efetiva anual (% a.a. — simulador Caixa)", jurosAnuais, setJurosAnuais, false, HELP.juros, "Copie do simulador da Caixa")}
                  {field("TR mensal (%)", trMensal, (value) => { setTrMensal(value); setTrFonte(trFonte || "informada manualmente"); }, false, HELP.tr)}
                  {field("Seguros MIP/DFI e tarifa por mês", seguroTarifaMensal, setSeguroTarifaMensal, true, HELP.seguros, "Copie do simulador da Caixa")}
                  <div>
                    <div className="flex items-center gap-1.5"><Label>Sistema de amortização</Label><InfoTip label="Sistema de amortização" text={HELP.sistema} /></div>
                    <select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={sistemaAmortizacao} onChange={(e) => setSistemaAmortizacao(e.target.value as SistemaAmortizacao)}>
                      <option value="PRICE">PRICE (parcela fixa)</option>
                      <option value="SAC">SAC (parcela decrescente)</option>
                    </select>
                  </div>
                  {field("Prazo do financiamento (meses)", prazoFinanciamento, setPrazoFinanciamento, false, HELP.prazo)}
                  {field("Mão de obra por m²", maoDeObra, setMaoDeObra)}
                  {field("Materiais por m²", materiais, setMateriais)}
                </div>
                <div className="border-y py-4 text-sm"><span className="text-muted-foreground">Custo real por m² (mão de obra + materiais)</span><strong className="ml-3">{BRL.format(custoReal)}</strong><p className="mt-1 text-xs text-muted-foreground">{cub > 0 ? `CUB: ${BRL.format(cub)} · CUB + 10%: ${BRL.format(cub * 1.1)}.` : "CUB publicado indisponível para esta seleção."} Comparação indicativa, não garante aprovação do banco.</p></div>
                 <p className="text-xs text-muted-foreground">Juros mensais: {annualToMonthlyRate(jurosAnuais).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}% a.m. (nominal de {(annualToMonthlyRate(jurosAnuais) * 12).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.){trFonte && ` · ${trFonte}`}.</p>
                 <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground">Área construída viável estimada · custo real</p>
                   <p className="mt-2 text-2xl font-bold text-primary">{result.areaViavelMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a {result.areaViavelMaxima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</p>
                   <p className="mt-1 text-xs text-muted-foreground">Mínima com BDI de 18%; máxima sem BDI.</p>
                </div>
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <Label>Custos fora do custo real por m²</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExtras([...extras, { descricao: "", valor: 0 }])}
                    >
                      <Plus />
                      Adicionar
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {extras.map((x, i) => (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_120px_36px] gap-2"
                        key={i}
                      >
                        <Input
                          value={x.descricao}
                          placeholder="Descrição"
                          onChange={(e) =>
                            setExtras(
                              extras.map((a, j) =>
                                j === i ? { ...a, descricao: e.target.value } : a,
                              ),
                            )
                          }
                        />
                        <NumericInput
                          value={x.valor}
                          placeholder="Valor"
                          monetary
                          onValueChange={(value) =>
                            setExtras(extras.map((a, j) => (j === i ? { ...a, valor: value } : a)))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remover custo"
                          onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                     Total fora da construção por m²:{" "}
                    <strong className="text-foreground">{BRL.format(result.extrasTotal)}</strong>
                  </p>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-8">
                <div>
                <p className="mb-6 text-sm text-muted-foreground">
                  Percentuais sugeridos pelo método Sinal Verde. A soma deve fechar em 100%.
                </p>
                <div className="space-y-3">
                  {cronograma.map((s, i) => (
                    <div className="grid grid-cols-[1fr_90px] items-center gap-4" key={s.nome}>
                      <Label>{s.nome}</Label>
                      <NumericInput
                        value={s.percentual}
                        decimals={2}
                        onValueChange={(value) =>
                          setCronograma(
                            cronograma.map((a, j) => (j === i ? { ...a, percentual: value } : a)),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-right text-sm">
                  Total:{" "}
                  <strong
                    className={
                      cronograma.reduce((a, b) => a + b.percentual, 0) === 100
                        ? "text-primary"
                        : "text-destructive"
                    }
                  >
                    {cronograma.reduce((a, b) => a + b.percentual, 0).toLocaleString("pt-BR")}%
                  </strong>
                </p>
                </div>
                <div className="border-t pt-7">
                  <div className="grid items-end gap-4 sm:grid-cols-[1fr_180px]">
                    <div><h2 className="font-semibold">Liberações mensais da PCI</h2><p className="mt-1 text-xs text-muted-foreground">Percentuais sobre {BRL.format(result.financiamentoConstrucao)} destinados à construção, liberados ao fim de cada mês, após a medição.{result.quitacaoLote > 0 && ` O lote (${BRL.format(result.quitacaoLote)}) é pago na assinatura e já gera encargos desde o 1º mês.`} Encargos de obra estimados: {BRL.format(result.jurosObra)}.</p></div>
                    <div><Label>Prazo estimado da obra</Label><select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={prazoExecucao} onChange={(event) => { const months = Number(event.target.value); setPrazoEditado(true); setPrazoExecucao(months); setLiberacoes(pciReleases(months)); }}>{Array.from({ length: 19 }, (_, index) => index + 6).map((months) => <option key={months} value={months}>{months} meses</option>)}</select></div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {liberacoes.map((release, index) => <div className="grid grid-cols-[1fr_110px] items-center gap-3" key={release.mes}><Label>Mês {release.mes}</Label><NumericInput value={release.percentual} decimals={2} onValueChange={(value) => setLiberacoes(liberacoes.map((item, itemIndex) => itemIndex === index ? { ...item, percentual: value } : item))} /></div>)}
                  </div>
                  <p className="mt-4 text-right text-sm">Total das liberações: <strong className={Math.abs(liberacoes.reduce((sum, item) => sum + item.percentual, 0) - 100) <= 0.01 ? "text-primary" : "text-destructive"}>{liberacoes.reduce((sum, item) => sum + item.percentual, 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong></p>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Objetivo</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {(["morar", "vender"] as const).map((x) => (
                      <Button
                        type="button"
                        key={x}
                        variant={objetivo === x ? "default" : "outline"}
                        className="h-auto min-h-10 whitespace-normal py-2"
                        onClick={() => {
                          setObjetivo(x);
                          // FGTS só vale para morar; ao trocar para venda, o campo é zerado.
                          if (x === "vender") setFgtsUtilizado(0);
                        }}
                      >
                        {x === "morar" ? "Construir para morar" : "Construir para vender"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-5 rounded-md border p-4 md:col-span-2 md:grid-cols-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 md:col-span-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{objetivo === "vender" ? "Remuneração e lucro do construtor" : "Remuneração do construtor e corretagem"}</p>
                    <p className="text-sm">{objetivo === "vender" ? <>Na obra <strong>{BRL.format(result.remuneracaoResponsavel)}</strong> · lucro de <strong>{BRL.format(lucro)}</strong> vem da venda</> : <>Sai da verba <strong>{BRL.format(result.remuneracaoResponsavel)}</strong></>}</p>
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2">{HELP.remuneracao}</p>
                  {field("Lucro desejado (margem)", lucro, setLucro)}
                  {objetivo === "morar" && <div>{field("Corretagem sobre a construção (%)", corretagemConstrucao, setCorretagemConstrucao, false, HELP.corretagemConstrucao)}{result.corretagemConstrucao > 0.005 && <p className="mt-1 text-xs text-muted-foreground">{BRL.format(result.corretagemConstrucao)} pagos na assinatura.</p>}</div>}
                  {field("Administração do processo", administracao, setAdministracao)}
                  {field("Projetos", projetos, setProjetos)}
                  {field("Honorários técnicos (acompanhamento da obra)", honorarios, setHonorarios)}
                </div>
                <div className="md:col-span-2">{field("Área planejada para orçamento (m²)", areaPlanejada, setAreaPlanejada, false)}<p className="mt-1 text-xs text-muted-foreground">Compare com a faixa viável abaixo; acima dela, a diferença sai do bolso.</p></div>
                {objetivo === "vender" && (
                  <>
                    <div className="grid gap-5 rounded-md border p-4 md:col-span-2 md:grid-cols-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground md:col-span-2">Venda do imóvel pronto</p>
                      <div>
                        {field("Preço do m² de casa pronta na região (opcional, para conferir)", precoM2Mercado, setPrecoM2Mercado, true, HELP.precoM2Mercado)}
                        {result.precoMercadoEstimado > 0 && <p className="pt-1.5 text-xs text-muted-foreground">Mercado: {NUMBER.format(result.areaPlanejada)} m² × {BRL.format(precoM2Mercado)} = {BRL.format(result.precoMercadoEstimado)}</p>}
                      </div>
                      <div>
                        <Label>Corretagem (%)</Label>
                        <NumericInput className="mt-2 h-11" min="0" max="99.99" value={corretagem} decimals={2} onValueChange={setCorretagem} />
                      </div>
                      {field("Meses após a obra até a venda (0 = vendida na entrega)", prazo, setPrazo, false)}
                      {origemTerreno === "investidor" && result.agioLote > 0 && field("Quanto foi pago pelo lote (para o IR)", custoAquisicaoLote, setCustoAquisicaoLote, true, HELP.custoAquisicaoLote)}
                      <PrecoReferencias result={result} />
                    </div>
                    <div className="grid gap-5 rounded-md border p-4 md:col-span-2 md:grid-cols-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground md:col-span-2">Quem financia no próprio CPF</p>
                      <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        {([[true, "Investidor parceiro"], [false, "O próprio construtor"]] as const).map(([valor, rotulo]) => (
                          <Button key={rotulo} type="button" variant={temInvestidor === valor ? "default" : "outline"} className="h-auto min-h-10 whitespace-normal py-2" onClick={() => setTemInvestidor(valor)}>{rotulo}</Button>
                        ))}
                      </div>
                      {temInvestidor && field("Parte do construtor no lucro da venda (%)", 100 - participacaoInvestidor, (value) => setParticipacaoInvestidor(100 - Math.min(Math.max(value, 0), 100)), false, HELP.parteConstrutor)}
                      {temInvestidor && participacaoInvestidor < 100 && field("Retorno mínimo do investidor antes da divisão (p.p. sobre a Selic líquida)", premioInvestidor, setPremioInvestidor, false, HELP.premio)}
                      {field("Selic anual para comparar (% a.a.)", selicAnual, (value) => { setSelicAnual(value); setSelicFonte(selicFonte || "informada manualmente"); }, false, HELP.selic)}
                      {selicFonte && <p className="self-end text-xs text-muted-foreground">Selic: {selicFonte}.</p>}
                      {result.dinheiroEntrada > 0 && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm md:col-span-2" htmlFor="entrada-depositada">
                          <Checkbox id="entrada-depositada" className="mt-0.5" checked={entradaDepositada} onCheckedChange={(checked) => setEntradaDepositada(checked === true)} />
                          <span>
                            <strong className="block">A agência exige depositar a entrada em dinheiro ({BRL.format(result.dinheiroEntrada)})</strong>
                            <span className="text-muted-foreground">{HELP.entradaDepositada}</span>
                          </span>
                        </label>
                      )}
                      <CapitalInvestidor result={result} />
                      {result.precoInformado && <CascataVenda result={result} />}
                    </div>
                  </>
                )}
                <div className="md:col-span-2 rounded-lg border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Despesas adicionais estimadas</p>
                      <p className="mt-1 text-2xl font-bold">{BRL.format(result.despesasTotal)}</p>
                    </div>
                    <ExpenseDialog despesas={despesas} onChange={(items) => setExpenseOverrides(Object.fromEntries(items.flatMap((item) => {
                      const estimated = estimates.find((candidate) => candidate.id === item.id);
                      return estimated && estimated.valor !== item.valor ? [[item.id, item.valor]] : [];
                    })))} />
                  </div>
                  <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0" />
                    Valores municipais, cartorários e previdenciários são estimativas editáveis.
                  </p>
                </div>
                {objetivo === "vender" && result.precoInformado && (
                  <div className="md:col-span-2 border-y py-4">
                    <p className="text-sm font-semibold">E se a venda não sair como esperado?</p>
                    <p className="mt-1 text-xs text-muted-foreground">Mesmo preço vendido {MESES_ATRASO_VENDA} meses depois (mais parcelas no nome do investidor) e venda {Math.round(QUEDA_PRECO_CENARIO * 100)}% abaixo do preço sugerido.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      {result.cenarios.map((c) => (
                        <div key={c.nome} className="border-l border-border pl-3">
                          <p className="text-sm font-semibold">{c.nome}</p>
                          <p className="text-sm">Venda {BRL.format(c.venda)} no mês {c.mesVenda}</p>
                          <p className={`text-sm ${c.saldo < 0 ? "text-destructive" : ""}`}>Lucro {BRL.format(c.saldo)}</p>
                          <p className="text-xs text-muted-foreground">{result.temInvestidor ? `Investidor ${BRL.format(c.lucroInvestidor)} · Construtor ${BRL.format(c.ganhoConstrutor)}` : `Construtor ${BRL.format(c.ganhoConstrutor)}`}</p>
                          {c.rentabilidadeInvestidor !== null && <p className={`text-xs font-semibold ${c.superaSelic ? "text-primary" : "text-destructive"}`}>{pct(c.rentabilidadeInvestidor)} ao ano · Selic líq. {pct(result.selicLiquida)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground">Faixa de área construída viável</p>
                   <p className="mt-1 text-2xl font-bold text-primary">{result.areaViavelMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a {result.areaViavelMaxima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</p>
                   <p className="mt-1 text-xs text-muted-foreground">BDI de 18% a 0%.</p>
                </div>
              </div>
            )}
            {erro && <p ref={erroRef} role="alert" className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            <div className="mt-8 flex gap-3" data-navegacao>
              {step > 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft />
                  Voltar
                </Button>
              )}
              <Button
                type="button"
                className="ml-auto w-full md:w-auto"
                onClick={step === 4 ? save : next}
              >
                {step === 4 ? (
                  <>
                    <Check />
                     {editar ? "Salvar alterações" : "Calcular e salvar"}
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </AppShell>
  );
}

const COR_SINAL: Record<SinalStatus, string> = { verde: "#10b981", amarelo: "#f59e0b", vermelho: "#ef4444", neutro: "#71717a" };

function LivePanel({ result, objetivo, renda }: { result: ReturnType<typeof calculate>; objetivo: "morar" | "vender"; renda: number }) {
  const sinal = sinalDaSimulacao(result, objetivo, renda);
  const semCusto = result.custoM2 <= 0;
  const area = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const vender = objetivo === "vender";
  const items = [
    { label: "Área viável", value: semCusto ? "—" : `${area(result.areaViavelMinima)} a ${area(result.areaViavelMaxima)} m²`, tone: "text-primary" },
    ...(vender
      ? [
          { label: "Custo total (terreno + obra)", value: semCusto ? "—" : BRL.format(result.custoComTerreno), tone: "" },
          { label: "Preço sugerido", value: result.precoInformado ? BRL.format(result.valorVenda) : "—", tone: "" },
          { label: "Ganho do construtor", value: result.precoInformado && !semCusto ? BRL.format(result.cenarios[0]?.ganhoConstrutor ?? 0) : BRL.format(result.remuneracaoResponsavel), tone: "text-primary" },
          { label: result.temInvestidor ? "Investidor precisa ter" : "Você precisa ter", value: semCusto ? "—" : BRL.format(result.investidorTotal), tone: "text-secondary" },
        ]
      : [
          { label: "Verba disponível para obra", value: BRL.format(result.recursosUtilizaveis), tone: "" },
          { label: "Custo total (terreno + obra)", value: semCusto ? "—" : BRL.format(result.custoComTerreno), tone: "" },
          { label: "Dinheiro do cliente", value: BRL.format(result.desembolsoProprio), tone: "text-secondary" },
        ]),
    { label: "Para começar a obra", value: BRL.format(result.dinheiroParaComecar), tone: "" },
    ...(!vender && !semCusto && result.aporteParaAreaPlanejada > 0
      ? [{ label: "Aporte para a área", value: BRL.format(result.aporteParaAreaPlanejada), tone: "text-destructive" }]
      : []),
  ];
  return (
    <aside className="sticky top-16 z-10 -mx-5 border-b bg-background/95 px-5 py-3 backdrop-blur lg:top-24 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:self-start lg:rounded-lg lg:border lg:bg-card lg:p-5" aria-live="polite">
      <p className="hidden text-xs font-semibold uppercase text-muted-foreground lg:block">Resumo em tempo real</p>
      <div className="mb-2 flex items-center gap-2.5 lg:mb-0 lg:mt-4" role="status">
        <span className="flex shrink-0 gap-1 rounded-full bg-zinc-900 px-1.5 py-1" aria-hidden>
          {(["vermelho", "amarelo", "verde"] as const).map((cor) => (
            <span key={cor} className="size-2.5 rounded-full" style={{ backgroundColor: COR_SINAL[cor], opacity: sinal.status === cor ? 1 : 0.2 }} />
          ))}
        </span>
        <span className="text-xs font-semibold" style={{ color: COR_SINAL[sinal.status] }}>{sinal.texto}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 lg:mt-4 lg:grid-cols-1 lg:gap-y-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="truncate text-[11px] text-muted-foreground lg:text-xs">{item.label}</dt>
            <dd className={`truncate text-sm font-semibold lg:text-lg ${item.tone}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function ExpenseDialog({
  despesas,
  onChange,
}: {
  despesas: ClientExpense[];
  onChange: (items: ClientExpense[]) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Ver e editar despesas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Despesas do cliente</DialogTitle>
          <DialogDescription>
            Confira cada estimativa e substitua pelos valores reais disponíveis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-7">
          {categories.map((category) => (
            <section key={category}>
              <h3 className="mb-3 text-sm font-semibold text-primary">{category}</h3>
              <div className="space-y-4">
                {despesas
                  .filter((item) => item.categoria === category)
                  .map((item) => (
                    <div
                      className="grid gap-2 border-b pb-4 md:grid-cols-[1fr_150px]"
                      key={item.id}
                    >
                      <div>
                        <Label htmlFor={item.id}>{item.nome}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">{item.observacao}</p>
                        <p className="mt-1 text-xs text-secondary">
                          Fonte:{" "}
                          {item.fonteUrl ? (
                            <a className="underline underline-offset-2" href={item.fonteUrl} target="_blank" rel="noreferrer">{item.fonte}</a>
                          ) : item.fonte}
                        </p>
                      </div>
                      <NumericInput
                        id={item.id}
                        aria-label={`Valor de ${item.nome}`}
                        value={item.valor}
                        monetary
                        onValueChange={(value) =>
                          onChange(
                            despesas.map((x) => (x.id === item.id ? { ...x, valor: value } : x)),
                          )
                        }
                      />
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <DialogFooter>
          <p className="mr-auto text-sm">
            Total:{" "}
            <strong>{BRL.format(despesas.reduce((sum, item) => sum + item.valor, 0))}</strong>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
