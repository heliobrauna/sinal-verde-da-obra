import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  type ClientExpense,
  type OrigemTerreno,
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
// Etapas: 1 ponto de partida, 2 orçamento, 3 viabilidade, 4 cronograma (com a área planejada definida).
const categories = ["Despesas iniciais", "Assinatura do contrato", "Durante a obra"] as const;
const ORIGEM_NOTA: Record<OrigemTerreno, string> = {
  investidor: "O ágio do lote compõe a entrada e conta como capital do investidor, com retorno preferencial. Lote quitado e registrado no nome dele não paga ITBI nem registro de compra.",
  construtor: "O construtor vende o lote ao investidor: há ITBI e registro, e o ágio não serve de entrada (FGTS ou dinheiro). O construtor recebe o preço do lote na assinatura e pode usá-lo para iniciar a obra.",
  compra: "O lote é comprado de terceiro na operação: há ITBI e registro, não existe ágio e a entrada precisa vir de FGTS ou dinheiro.",
};
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const HELP = {
  juros: "Taxa efetiva anual mostrada pelo simulador da Caixa. Na fase de obra, os juros mensais são a taxa nominal ÷ 12, cobrados sobre a dívida já liberada (lote + parcelas medidas).",
  tr: "Atualização monetária cobrada junto com os juros na fase de obra: dívida liberada × TR. Consultada automaticamente no Banco Central; edite se quiser outra premissa.",
  seguros: "Seguro Morte e Invalidez (MIP), Danos Físicos (DFI) e tarifa de administração cobrados todo mês desde a assinatura. Copie os valores da 1ª prestação no simulador da Caixa.",
  lucroConstrutor: "Quanto o construtor quer ganhar no cenário realista. O app soma encargos até a venda, o retorno preferencial do investidor e a parte dele no excedente para chegar ao lucro total e ao preço de venda.",
  corretagemLote: "Comissão que o investidor pagaria para vender o lote hoje. O lote entra no capital pelo valor líquido, que é o que ele de fato receberia.",
  custoAquisicaoLote: "Quanto o investidor pagou pelo lote. Serve para estimar o IR de 15% sobre o ganho de capital numa venda hoje (sem fatores de redução). Deixe zerado se não souber.",
  selic: "Meta Selic anual, consultada automaticamente no Banco Central. É a referência de renda fixa segura (Tesouro Selic) que a operação precisa superar.",
  premio: "Pontos percentuais ao ano acima da Selic líquida de IR para compensar a falta de liquidez e os riscos de obra, de venda e da dívida no nome do investidor.",
  participacao: "Parte do investidor no que sobrar depois de devolvido o capital dele e pago o retorno preferencial (Selic líquida + prêmio).",
  imovel: "Valor total informado no simulador da Caixa: terreno + orçamento da obra. É a base que o banco avalia para definir o financiamento.",
  entrada: "Diferença entre o valor do imóvel e o financiamento. Não é um pagamento ao banco: é o valor que você precisa comprovar que tem (ágio do lote, FGTS e dinheiro em conta) para o banco considerar o contrato viável. Guarde esses recursos: a obra exige aportes relevantes antes da primeira liberação.",
  financiamento: "Valor que o banco empresta. Primeiro quita o saldo devedor do lote, se houver; o restante é liberado em parcelas conforme a medição da obra, nunca de uma vez.",
};

function ProfitBreakdown({ result }: { result: ReturnType<typeof calculate> }) {
  if (result.lucroConstrutorDesejado === null) return null;
  const parteInvestidor = result.excedenteNecessario - result.lucroConstrutorDesejado;
  const rows: [string, number][] = [
    ["Encargos até a venda", result.jurosPosObra],
    ["Retorno preferencial do investidor", result.retornoPreferencial],
    ["Parte do investidor no excedente", parteInvestidor],
    ["Parte do construtor", result.lucroConstrutorDesejado],
  ];
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">Lucro total necessário na venda</p>
        <p className="text-lg font-bold">{BRL.format(result.lucroDesejado)}</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {rows.filter(([, valor]) => valor > 0.005).map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3"><span>{rotulo}</span><span>{BRL.format(valor)}</span></li>
        ))}
      </ul>
    </div>
  );
}

function InvestorSummary({ result }: { result: ReturnType<typeof calculate> }) {
  return (
    <div className="rounded-md border px-4 py-3 md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">Capital do investidor</p>
        <p className="font-semibold">{BRL.format(result.capitalAportadoInvestidor)}</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {Object.entries(result.aportesInvestidor.reduce<Record<string, number>>((acc, flow) => ({ ...acc, [flow.rotulo]: (acc[flow.rotulo] ?? 0) + flow.valor }), {})).map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between gap-3"><span>{rotulo}</span><span>{BRL.format(valor)}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Retorno preferencial: {pct(result.taxaPreferencial)} a.a. (Selic {pct(result.selicAnual)} − IR {pct(result.aliquotaIr)} + prêmio) = {BRL.format(result.retornoPreferencial)} até a venda, no mês {result.mesVenda}.
        {result.capitalGiro > 0 && " O capital de giro volta com as liberações, ao fim da obra."}
        {result.patrimonioTerreno > 0 && (result.corretagemLoteValor > 0 || result.irGanhoLote > 0) && ` Terreno: ${BRL.format(result.agioLote)} − corretagem ${BRL.format(result.corretagemLoteValor)}${result.irGanhoLote > 0 ? ` − IR ${BRL.format(result.irGanhoLote)}` : ""}.`}
        {result.recebimentoConstrutorLote > 0 && ` O construtor recebe ${BRL.format(result.recebimentoConstrutorLote)} pelo lote na assinatura${result.capitalGiro > 0 ? `; se usar parte disso no início da obra, o capital de giro de ${BRL.format(result.capitalGiro)} deixa de sair do investidor` : ""}.`}
      </p>
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

export const Route = createFileRoute("/_authenticated/simulacao/nova")({
  validateSearch: (search: Record<string, unknown>): { editar?: string } => typeof search['editar'] === "string" ? { editar: search['editar'] } : {},
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
  const { editar } = Route.useSearch();
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
  const [saldo, setSaldo] = useState(0);
  const [renda, setRenda] = useState(0);
  const [credito, setCredito] = useState(0);
  const [estado, setEstado] = useState("CE");
  const [padrao, setPadrao] = useState<"baixo" | "normal" | "alto">("normal");
  const [cubRef, setCubRef] = useState<CubReference | null>(null);
  const [savedCub, setSavedCub] = useState(0);
  const [cubLoading, setCubLoading] = useState(false);
  const [valorImovel, setValorImovel] = useState(0);
  const [fgtsUtilizado, setFgtsUtilizado] = useState(0);
  const [jurosAnuais, setJurosAnuais] = useState(10);
  const [trMensal, setTrMensal] = useState(0);
  const [trFonte, setTrFonte] = useState("");
  const [seguroTarifaMensal, setSeguroTarifaMensal] = useState(0);
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
  const [participacaoInvestidor, setParticipacaoInvestidor] = useState(0);
  const [projetos, setProjetos] = useState(0);
  const [administracao, setAdministracao] = useState(0);
  const [honorarios, setHonorarios] = useState(0);
  const [primeiroImovelSfh, setPrimeiroImovelSfh] = useState(false);
  const [expenseOverrides, setExpenseOverrides] = useState<Record<string, number>>({});
  const [erro, setErro] = useState("");
  const cub = cubRef?.valor ?? savedCub;
  const custoReal = maoDeObra + materiais;
  const baseResult = useMemo(
    () => calculate({ credito, terreno, saldoDevedor: situacao === "financiado" ? saldo : 0, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor: objetivo === "vender" ? lucroConstrutor : null, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, areaPlanejada: 0, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, stages: cronograma, liberacoes, despesas: [], participacaoInvestidor }),
    [credito, terreno, situacao, saldo, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, cronograma, liberacoes, participacaoInvestidor],
  );
  // ITBI e registro de compra só quando o lote muda de dono na operação.
  const transferenciaLote = origemTerreno !== "investidor" || (situacao === "financiado" && saldo > 0);
  const estimates = useMemo(
    // Alvará e INSS acompanham a área planejada; antes de defini-la, usam a área viável.
    () => estimatedExpenses(terreno, credito, projetos, administracao, honorarios, cub, areaPlanejada > 0 ? areaPlanejada : baseResult.areaViavelMaxima, estado, primeiroImovelSfh, transferenciaLote),
    [terreno, credito, projetos, administracao, honorarios, cub, areaPlanejada, baseResult.areaViavelMaxima, estado, primeiroImovelSfh, transferenciaLote],
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
      }),
    [credito, terreno, situacao, saldo, origemTerreno, selicAnual, premioInvestidor, corretagemLote, custoAquisicaoLote, lucroConstrutor, valorImovel, fgtsUtilizado, cub, maoDeObra, materiais, areaPlanejada, extras, objetivo, lucro, corretagem, prazo, jurosAnuais, trMensal, seguroTarifaMensal, cronograma, liberacoes, despesas, participacaoInvestidor],
  );
  useEffect(() => {
    if (!editar) return;
    let active = true;
    supabase.from("simulacoes").select("*").eq("id", editar).single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setErro("Simulação não encontrada ou sem permissão para editar."); setLoadingEdit(false); return; }
       const saved = data.resultado as unknown as Partial<ReturnType<typeof calculate>> & { projetos?: number; administracao?: number; honorarios?: number; expenseOverrides?: Record<string, number>; cubReferencia?: CubReference; primeiroImovelSfh?: boolean; corretagemLote?: number; custoAquisicaoLote?: number };
      setNome(data.nome); setTerreno(data.terreno_valor); setSituacao(data.terreno_situacao as "quitado" | "financiado");
      setSaldo(data.saldo_devedor_terreno ?? 0); setRenda(data.renda_declarada); setCredito(data.credito_aprovado);
      setEstado(data.estado); setPadrao(data.padrao_acabamento as "baixo" | "normal" | "alto");
      setSavedCub(data.cub_valor_m2);
      if (saved.cubReferencia) setCubRef(saved.cubReferencia as CubReference);
       setValorImovel(saved.valorOperacao ?? data.credito_aprovado / ((saved as { percentualFinanciamento?: number }).percentualFinanciamento ?? 80) * 100); setFgtsUtilizado(saved.fgtsUtilizado ?? 0);

       setJurosAnuais(saved.taxaJurosAnual ?? monthlyToAnnualRate(data.taxa_juros_obra_mensal)); if (saved.trMensal !== undefined) { setTrMensal(saved.trMensal); setTrFonte("valor salvo na simulação"); } setSeguroTarifaMensal(saved.seguroTarifaMensal ?? 0); setMaoDeObra(saved.maoDeObra ?? (saved.custoM2 ?? 0) / 2);
      setMateriais(saved.materiais ?? (saved.custoM2 ?? 0) / 2);
       setAreaPlanejada(saved.areaPlanejada ?? saved.areaViavelMinima ?? saved.areaViavel ?? 0);
      setExtras(Array.isArray(data.custos_extras) ? data.custos_extras as Extra[] : []);
      setCronograma(saved.cronograma?.map(({ nome, percentual }) => ({ nome, percentual })) ?? stages);
       if (saved.liberacoesMensais?.length) {
         setPrazoExecucao(saved.prazoExecucaoMeses ?? saved.liberacoesMensais.length);
         setLiberacoes(saved.liberacoesMensais.map(({ mes, percentual }) => ({ mes, percentual })));
         setPrazoEditado(true);
       }
      setObjetivo(data.objetivo as "morar" | "vender"); setLucro(data.lucro_desejado ?? 0);
      setCorretagem(saved.corretagemPercentual ?? 5); setPrazo(saved.mesesAposObra ?? data.prazo_venda_meses ?? 0);
       setParticipacaoInvestidor(saved.participacaoInvestidor ?? 0);
      setPrimeiroImovelSfh(saved.primeiroImovelSfh ?? false);
      setOrigemTerreno(saved.origemTerreno ?? "investidor");
      setPremioInvestidor(saved.premioInvestidor ?? 5);
      setCorretagemLote(saved.corretagemLote ?? 5); setCustoAquisicaoLote(saved.custoAquisicaoLote ?? 0);
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
    setCubLoading(true);
    setCubRef(null);
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
  function next() {
    if (step === 1 && (!credito || !renda || !valorImovel)) {
      setErro("Informe a renda, o valor do imóvel e o valor do financiamento para continuar.");
      return;
    }
    if (step === 1 && valorImovel < credito) {
      setErro("O valor do imóvel não pode ser menor que o valor do financiamento.");
      return;
    }
    if (step === 2 && custoReal <= 0) {
      setErro("Informe mão de obra e materiais por m² para calcular a área.");
      return;
    }
    setErro("");
    // A viabilidade (etapa 3) começa com a área viável mínima; o cronograma fica por último.
    if (step === 2 && areaPlanejada <= 0) setAreaPlanejada(result.areaViavelMinima);
    setStep(Math.min(4, step + 1));
  }
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (corretagem < 0 || corretagem >= 100 || participacaoInvestidor < 0 || participacaoInvestidor > 100 || prazo < 0) {
      setErro("Revise a corretagem, a participação do investidor e os meses até a venda."); return;
    }
    if (valorImovel < credito || Math.abs(liberacoes.reduce((sum, item) => sum + item.percentual, 0) - 100) > 0.01 || Math.abs(cronograma.reduce((sum, item) => sum + item.percentual, 0) - 100) > 0.01) {
      setErro("Revise o valor do imóvel e os dois cronogramas: cada cronograma deve somar 100%."); return;
    }
    const payloadResult = { ...result, cubReferencia: cubRef, projetos, administracao, honorarios, expenseOverrides, primeiroImovelSfh, corretagemLote, custoAquisicaoLote };
    if (custoReal <= 0) { setErro("Informe o custo real por m²."); setStep(2); return; }
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
        lucro_desejado: objetivo === "vender" ? result.lucroDesejado : lucro,
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
      setErro("Não foi possível salvar. Revise os dados e tente novamente.");
      return;
    }
    nav({ to: "/simulacao/$id", params: { id: data.id } });
  }
  const field = (label: string, value: number, set: (n: number) => void, monetary = true, help?: string) => (
    <div>
      <div className="flex items-center gap-1.5"><Label>{label}</Label>{help && <InfoTip label={label} text={help} />}</div>
      <NumericInput
        className="mt-2 h-11"
        min="0"
        value={value}
        decimals={2}
        monetary={monetary}
        onValueChange={set}
      />
    </div>
  );
  if (loadingEdit) return <AppShell><div className="mx-auto h-52 max-w-3xl animate-pulse rounded-lg bg-muted" /></AppShell>;
  return (
    <AppShell>
      <div className="mx-auto grid max-w-3xl gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_280px]">
      <LivePanel result={result} objetivo={objetivo} />
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <p className="text-sm font-semibold text-primary">{editar ? "EDITAR SIMULAÇÃO" : "NOVA SIMULAÇÃO"}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">
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
        <div className="mt-6 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`h-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <Card className="mt-8">
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
                </div>
                {field("FGTS disponível para a entrada", fgtsUtilizado, setFgtsUtilizado)}
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
                    <p><span className="text-muted-foreground">FGTS</span><strong className="mt-1 block">{BRL.format(baseResult.fgtsNaEntrada)}</strong></p>
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
                   {field("Taxa de juros efetiva anual (% a.a. — simulador Caixa)", jurosAnuais, setJurosAnuais, false, HELP.juros)}
                  {field("TR mensal (%)", trMensal, (value) => { setTrMensal(value); setTrFonte(trFonte || "informada manualmente"); }, false, HELP.tr)}
                  {field("Seguros MIP/DFI e tarifa por mês", seguroTarifaMensal, setSeguroTarifaMensal, true, HELP.seguros)}
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
                        onClick={() => setObjetivo(x)}
                      >
                        {x === "morar" ? "Construir para morar" : "Construir para vender"}
                      </Button>
                    ))}
                  </div>
                </div>
                {objetivo === "morar" ? field("Remuneração ou margem do responsável", lucro, setLucro) : field("Lucro desejado do construtor", lucroConstrutor, setLucroConstrutor, true, HELP.lucroConstrutor)}
                 <div>{field("Área planejada para orçamento (m²)", areaPlanejada, setAreaPlanejada, false)}<p className="mt-1 text-xs text-muted-foreground">O preço acompanha os custos desta área; compare com a faixa viável abaixo.</p></div>
                {field("Honorários desejados", honorarios, setHonorarios)}
                {field("Projetos", projetos, setProjetos)}
                {field(
                  "Administração do processo (sem acompanhamento de obra)",
                  administracao,
                  setAdministracao,
                )}
                {objetivo === "vender" && (
                  <>
                    <div>
                      <Label>Corretagem (%)</Label>
                      <NumericInput className="mt-2 h-11" min="0" max="99.99" value={corretagem} decimals={2} onValueChange={setCorretagem} />
                    </div>
                    {field("Meses após conclusão até a venda (0 = venda na planta)", prazo, setPrazo, false)}
                    {field("Selic anual (% a.a.)", selicAnual, (value) => { setSelicAnual(value); setSelicFonte(selicFonte || "informada manualmente"); }, false, HELP.selic)}
                    {field("Prêmio mínimo sobre a Selic líquida (p.p. a.a.)", premioInvestidor, setPremioInvestidor, false, HELP.premio)}
                    {field("Participação do investidor no excedente (%)", participacaoInvestidor, setParticipacaoInvestidor, false, HELP.participacao)}
                    {origemTerreno === "investidor" && result.agioLote > 0 && <>
                      {field("Corretagem se vendesse o lote hoje (%)", corretagemLote, setCorretagemLote, false, HELP.corretagemLote)}
                      {field("Valor pago na compra do lote (opcional)", custoAquisicaoLote, setCustoAquisicaoLote, true, HELP.custoAquisicaoLote)}
                    </>}
                    <ProfitBreakdown result={result} />
                    {selicFonte && <p className="self-end text-xs text-muted-foreground">Selic: {selicFonte}.</p>}
                    <InvestorSummary result={result} />
                    <div className="md:col-span-2 rounded-lg border border-secondary/30 bg-secondary/5 p-5">
                      <p className="text-sm text-muted-foreground">Valor estimado de venda</p>
                      <p className="mt-1 text-2xl font-bold">{BRL.format(result.valorVenda)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Terreno, construção, despesas, juros de obra, lucro desejado e corretagem. Cada valor entra uma vez.</p>
                       {result.aporteParaAreaPlanejada > 0 && <p className="mt-2 text-xs text-destructive">Aporte adicional para esta área: {BRL.format(result.aporteParaAreaPlanejada)}.</p>}
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground md:col-span-2">A margem é reservada no cálculo da área viável. Honorários e administração entram uma única vez nas despesas adicionais.</p>
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
                 {objetivo === "vender" && <div className="md:col-span-2 border-y py-4"><p className="text-sm font-semibold">Cenários de venda</p><p className="mt-1 text-xs text-muted-foreground">Variação de 15% no valor de venda. A venda devolve o capital do investidor, paga o retorno preferencial e só então divide o excedente.</p><div className="mt-4 grid gap-4 sm:grid-cols-3">{result.cenarios.map(c => <div key={c.nome} className="border-l border-border pl-3"><p className="text-sm font-semibold">{c.nome}</p><p className="text-sm">Venda {BRL.format(c.venda)}</p><p className="text-sm">Lucro {BRL.format(c.saldo)}</p><p className="text-xs text-muted-foreground">Investidor {BRL.format(c.lucroInvestidor)} · Construtor {BRL.format(c.lucroConstrutor)}</p>{c.rentabilidadeInvestidor !== null && <p className={`text-xs font-semibold ${c.superaSelic ? "text-primary" : "text-destructive"}`}>Investidor: {pct(c.rentabilidadeInvestidor)} a.a. · Selic líq. {pct(result.selicLiquida)}</p>}</div>)}</div>{result.construtorSemExcedente && <p className="mt-3 text-xs text-destructive">Com 100% do excedente para o investidor, o construtor não recebe nada: reduza a participação do investidor.</p>}</div>}
                <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground">Faixa de área construída viável</p>
                   <p className="mt-1 text-2xl font-bold text-primary">{result.areaViavelMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a {result.areaViavelMaxima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</p>
                   <p className="mt-1 text-xs text-muted-foreground">BDI de 18% a 0%.</p>
                </div>
              </div>
            )}
            {erro && <p className="mt-5 text-sm text-destructive">{erro}</p>}
            <div className="mt-8 flex gap-3">
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

function LivePanel({ result, objetivo }: { result: ReturnType<typeof calculate>; objetivo: "morar" | "vender" }) {
  const semCusto = result.custoM2 <= 0;
  const area = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const vender = objetivo === "vender";
  const items = [
    { label: "Área viável", value: semCusto ? "—" : `${area(result.areaViavelMinima)} a ${area(result.areaViavelMaxima)} m²`, tone: "text-primary" },
    vender
      ? { label: "Venda estimada", value: semCusto ? "—" : BRL.format(result.valorVenda), tone: "" }
      : { label: "Verba da obra", value: BRL.format(result.recursosUtilizaveis), tone: "" },
    vender
      ? { label: "Custo total (terreno + obra)", value: semCusto ? "—" : BRL.format(result.custoComTerreno), tone: "" }
      : { label: "Custo total", value: semCusto ? "—" : BRL.format(result.custoTotal), tone: "" },
    { label: "Dinheiro do cliente", value: BRL.format(result.desembolsoProprio), tone: "text-secondary" },
    ...(!semCusto && result.aporteParaAreaPlanejada > 0
      ? [{ label: "Aporte para a área", value: BRL.format(result.aporteParaAreaPlanejada), tone: "text-destructive" }]
      : []),
  ];
  return (
    <aside className="sticky top-16 z-10 -mx-5 border-b bg-background/95 px-5 py-3 backdrop-blur lg:top-24 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:self-start lg:rounded-lg lg:border lg:bg-card lg:p-5" aria-live="polite">
      <p className="hidden text-xs font-semibold uppercase text-muted-foreground lg:block">Resumo em tempo real</p>
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
