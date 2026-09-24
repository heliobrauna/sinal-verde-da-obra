import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { NumericInput } from "@/components/app/NumericInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  estimatedExpenses,
  type ClientExpense,
  type Extra,
  type Stage,
} from "@/lib/finance";
import { getResidentialCub } from "@/lib/cub.functions";
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
const categories = ["Despesas iniciais", "Assinatura do contrato", "Durante a obra"] as const;

type CubReference = {
  valor: number;
  competencia: string;
  projeto: string;
  origem: string;
  fonte: string;
  oficial: boolean;
};

export const Route = createFileRoute("/_authenticated/simulacao/nova")({
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
  const fetchCub = useServerFn(getResidentialCub);
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("Minha obra");
  const [terreno, setTerreno] = useState(0);
  const [situacao, setSituacao] = useState<"quitado" | "financiado">("quitado");
  const [saldo, setSaldo] = useState(0);
  const [renda, setRenda] = useState(0);
  const [credito, setCredito] = useState(0);
  const [estado, setEstado] = useState("CE");
  const [padrao, setPadrao] = useState<"baixo" | "normal" | "alto">("normal");
  const [cubRef, setCubRef] = useState<CubReference | null>(null);
  const [cubLoading, setCubLoading] = useState(false);
  const [bdi, setBdi] = useState(18);
  const [juros, setJuros] = useState(0.8);
  const [extras, setExtras] = useState<Extra[]>(
    suggestions.map((descricao) => ({ descricao, valor: 0 })),
  );
  const [cronograma, setCronograma] = useState(stages);
  const [objetivo, setObjetivo] = useState<"morar" | "vender">("morar");
  const [venda, setVenda] = useState(0);
  const [lucro, setLucro] = useState(0);
  const [prazo, setPrazo] = useState(12);
  const [projetos, setProjetos] = useState(0);
  const [administracao, setAdministracao] = useState(0);
  const [honorarios, setHonorarios] = useState(0);
  const [despesas, setDespesas] = useState<ClientExpense[]>([]);
  const [erro, setErro] = useState("");
  const cub = cubRef?.valor ?? 0;
  const estimates = useMemo(
    () => estimatedExpenses(terreno, credito, projetos, administracao, honorarios, objetivo),
    [terreno, credito, projetos, administracao, honorarios, objetivo],
  );
  useEffect(() => setDespesas(estimates), [estimates]);
  const result = useMemo(
    () =>
      calculate({
        credito,
        cub,
        bdi,
        extras,
        objetivo,
        valorVenda: venda,
        prazo,
        juros,
        stages: cronograma,
        despesas,
      }),
    [credito, cub, bdi, extras, objetivo, venda, prazo, juros, cronograma, despesas],
  );
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
  function next() {
    if (step === 1 && (!credito || !renda)) {
      setErro("Informe a renda e o valor financiado para continuar.");
      return;
    }
    if (step === 2 && (!cub || bdi < 0 || bdi > 18)) {
      setErro(
        cub
          ? "Informe um BDI entre 0% e 18%."
          : "Ainda não há uma referência de CUB para esta seleção.",
      );
      return;
    }
    if (step === 3 && cronograma.reduce((s, x) => s + x.percentual, 0) !== 100) {
      setErro("A soma das etapas precisa ser exatamente 100%.");
      return;
    }
    setErro("");
    setStep(Math.min(4, step + 1));
  }
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payloadResult = { ...result, cubReferencia: cubRef, projetos, administracao, honorarios };
    const { data, error } = await supabase
      .from("simulacoes")
      .insert({
        user_id: u.user.id,
        nome,
        terreno_valor: terreno,
        terreno_situacao: situacao,
        saldo_devedor_terreno: situacao === "financiado" ? saldo : null,
        renda_declarada: renda,
        credito_aprovado: credito,
        estado,
        padrao_acabamento: padrao,
        cub_valor_m2: cub,
        bdi_percentual: bdi,
        custos_extras: extras,
        objetivo,
        lucro_desejado: objetivo === "vender" ? lucro : null,
        prazo_venda_meses: objetivo === "vender" ? prazo : null,
        taxa_juros_obra_mensal: juros,
        resultado: payloadResult,
      })
      .select("id")
      .single();
    if (error) {
      setErro("Não foi possível salvar. Revise os dados e tente novamente.");
      return;
    }
    nav({ to: "/simulacao/$id", params: { id: data.id } });
  }
  const field = (label: string, value: number, set: (n: number) => void, decimals = 2) => (
    <div>
      <Label>{label}</Label>
      <NumericInput
        className="mt-2 h-11"
        min="0"
        value={value}
        decimals={decimals}
        onValueChange={set}
      />
    </div>
  );
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-primary">NOVA SIMULAÇÃO</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">
            {
              [
                "Ponto de partida",
                "Orçamento sem surpresa",
                "Cronograma do banco",
                "Sinal de viabilidade",
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
                {field("Valor do terreno", terreno, setTerreno)}
                <div>
                  <Label>Situação do terreno</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                    value={situacao}
                    onChange={(e) => setSituacao(e.target.value as typeof situacao)}
                  >
                    <option value="quitado">Quitado</option>
                    <option value="financiado">Financiado</option>
                  </select>
                </div>
                {situacao === "financiado" && field("Saldo devedor", saldo, setSaldo)}
                {field("Renda declarada", renda, setRenda)}
                {field("Valor financiado (simulador Caixa)", credito, setCredito)}
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
                    <Label>CUB por m²</Label>
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
                  {field("BDI (%)", bdi, setBdi)}
                  {field("Juros nominais (% - simulador Caixa)", juros, setJuros)}
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground">Área construída viável estimada</p>
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {result.areaViavel.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m²
                  </p>
                </div>
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <Label>Custos fora do CUB</Label>
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
                        key={`${x.descricao}-${i}`}
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
                    Total fora do CUB:{" "}
                    <strong className="text-foreground">{BRL.format(result.extrasTotal)}</strong>
                  </p>
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                <p className="mb-6 text-sm text-muted-foreground">
                  Ajuste os percentuais. A soma deve fechar em 100%.
                </p>
                <div className="space-y-3">
                  {cronograma.map((s, i) => (
                    <div className="grid grid-cols-[1fr_90px] items-center gap-4" key={s.nome}>
                      <Label>{s.nome}</Label>
                      <NumericInput
                        value={s.percentual}
                        decimals={0}
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
            )}
            {step === 4 && (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Objetivo</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {(["morar", "vender"] as const).map((x) => (
                      <Button
                        type="button"
                        key={x}
                        variant={objetivo === x ? "default" : "outline"}
                        onClick={() => setObjetivo(x)}
                      >
                        {x === "morar" ? "Construir para morar" : "Construir para vender"}
                      </Button>
                    ))}
                  </div>
                </div>
                {objetivo === "vender" && (
                  <>
                    {field("Valor estimado de venda", venda, setVenda)}
                    {field("Lucro desejado", lucro, setLucro)}
                    {field("Honorários desejados", honorarios, setHonorarios)}
                    {field("Prazo até a venda (meses)", prazo, setPrazo, 0)}
                  </>
                )}
                {field("Projetos", projetos, setProjetos)}
                {field(
                  "Administração do processo (sem acompanhamento de obra)",
                  administracao,
                  setAdministracao,
                )}
                <div className="md:col-span-2 rounded-lg border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Despesas adicionais estimadas</p>
                      <p className="mt-1 text-2xl font-bold">{BRL.format(result.despesasTotal)}</p>
                    </div>
                    <ExpenseDialog despesas={despesas} onChange={setDespesas} />
                  </div>
                  <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0" />
                    Valores municipais, cartorários e previdenciários são estimativas editáveis.
                  </p>
                </div>
                <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground">Área construída viável estimada</p>
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {result.areaViavel.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m²
                  </p>
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
                    Calcular e salvar
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
    </AppShell>
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
