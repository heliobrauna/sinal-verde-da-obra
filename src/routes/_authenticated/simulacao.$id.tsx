import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { BRL, NUMBER, type ClientExpense } from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";
import { ArrowLeft, CheckCircle2, TrendingDown, Minus, TrendingUp, Trash2, Pencil } from "lucide-react";
type R = {
  areaViavel: number;
  areaViavelMinima?: number;
  areaViavelMaxima?: number;
  custoM2: number;
  maoDeObra?: number;
  materiais?: number;
  cubReferenciaValor?: number;
  cubMaisDez?: number;
  custoConstrucao?: number;
  custoTotal?: number;
  jurosPosObra?: number;
  parcelasEstimadas?: number;
  amortizacaoEstimada?: number;
  mesesAposObra?: number;
  capitalInvestidor?: number;
  participacaoInvestidor?: number;
  contingencia: number;
  extrasTotal: number;
  despesasTotal?: number;
  despesas?: ClientExpense[];
  cubReferencia?: { competencia: string; projeto: string; origem: string };
  cenarios: { nome: string; saldo: number; venda?: number; lucroConstrutor?: number; lucroInvestidor?: number; rentabilidadeInvestidor?: number | null }[];
  cronograma: { nome: string; percentual: number; valor: number }[];
  valorVenda?: number;
  corretagemPercentual?: number;
  corretagemValor?: number;
  lucroDesejado?: number;
  administracao?: number;
  honorarios?: number;
  entradaDinheiro?: number;
  fgtsUtilizado?: number;
  agioLote?: number;
  entradaTotalReconhecida?: number;
  percentualFinanciavelLote?: number;
  avaliacaoMinimaLote?: number;
  quitacaoLote?: number;
  saldoLoteNaoCoberto?: number;
  financiamentoConstrucao?: number;
  recursosUtilizaveis?: number;
  despesasPreContrato?: number;
  entradaLivreInicioObra?: number;
  aporteAdicional?: number;
  taxaJurosAnual?: number;
  taxaJurosMensalEquivalente?: number;
  jurosObra?: number;
  capitalAportadoInvestidor?: number;
  prazoExecucaoMeses?: number;
  liberacoesMensais?: { mes: number; percentual: number; liberacao: number; saldoLiberado: number; encargo: number }[];
};
export const Route = createFileRoute("/_authenticated/simulacao/$id")({
  head: () => ({
    meta: [
      { title: "Resultado | Sinal Verde da Obra" },
      { name: "description", content: "Resultado detalhado da simulação de viabilidade." },
      { property: "og:title", content: "Resultado da simulação" },
      { property: "og:description", content: "Área viável, cronograma e cenários financeiros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Result,
});
function Result() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [item, setItem] = useState<Tables<"simulacoes"> | null>(null);
  useEffect(() => {
    supabase
      .from("simulacoes")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setItem(data));
  }, [id]);
  async function remove() {
    const { error } = await supabase.from("simulacoes").delete().eq("id", id);
    if (!error) nav({ to: "/dashboard" });
  }
  if (!item)
    return (
      <AppShell>
        <div className="h-52 animate-pulse rounded-lg bg-muted" />
      </AppShell>
    );
  const r = item.resultado as unknown as R;
  return (
    <AppShell>
      <div className="flex justify-between">
        <Button asChild variant="ghost">
          <Link to="/dashboard">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        <div className="flex items-center gap-2"><Button asChild variant="outline"><Link to="/simulacao/nova" search={{ editar: id }}><Pencil className="size-4" />Editar</Link></Button><AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-destructive">
              <Trash2 />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta simulação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente e removerá todos os dados deste cálculo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={remove}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog></div>
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-primary">SINAL DE VIABILIDADE</p>
          <h1 className="mt-2 text-3xl font-bold">{item.nome}</h1>
          <p className="mt-2 text-muted-foreground">
             Análise baseada nos recursos e no orçamento informados.
          </p>
          {r.cubReferencia && (
            <p className="mt-1 text-xs text-muted-foreground">
              CUB {r.cubReferencia.projeto} · {r.cubReferencia.competencia} ·{" "}
              {r.cubReferencia.origem}
            </p>
          )}
        </div>
        <span className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          <CheckCircle2 className="size-4" />
          Cálculo concluído
        </span>
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Card className="border-primary/30 md:col-span-2">
          <CardContent className="p-6">
             <p className="text-sm text-muted-foreground">Faixa de área construída viável</p>
             <p className="mt-2 text-3xl font-bold text-primary">{NUMBER.format(r.areaViavelMinima ?? r.areaViavel)} a {NUMBER.format(r.areaViavelMaxima ?? r.areaViavel)} <span className="text-xl">m²</span></p>
             <p className="mt-2 text-xs text-muted-foreground">BDI de 18% a 0% · custo real por m²</p>
          </CardContent>
        </Card>
        {[
          [r.maoDeObra !== undefined ? "Custo real por m²" : "Custo por m²", r.custoM2],
          ["Reserva de 20%", r.contingencia],
        ].map(([k, v]) => (
          <Card key={String(k)}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="mt-3 text-xl font-semibold">{BRL.format(Number(v))}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {r.maoDeObra !== undefined && <section className="mt-5 grid gap-3 border-y py-5 text-sm sm:grid-cols-3"><p>Mão de obra: <strong>{BRL.format(r.maoDeObra)}</strong>/m²</p><p>Materiais: <strong>{BRL.format(r.materiais ?? 0)}</strong>/m²</p><p>{(r.cubReferenciaValor ?? item.cub_valor_m2) > 0 ? <>CUB publicado: <strong>{BRL.format(r.cubReferenciaValor ?? item.cub_valor_m2)}</strong>/m² · +10%: {BRL.format(r.cubMaisDez ?? item.cub_valor_m2 * 1.1)}</> : "CUB publicado indisponível"}</p><p className="text-xs text-muted-foreground sm:col-span-3">O CUB é apenas referência comparativa; não garante aprovação do banco.</p></section>}
      {r.entradaTotalReconhecida !== undefined && <section className="mt-8 border-y py-6">
        <h2 className="text-xl font-semibold">Composição da operação</h2>
        <div className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Entrada em dinheiro", r.entradaDinheiro ?? 0],
            ["FGTS pretendido", r.fgtsUtilizado ?? 0],
            ["Ágio do lote · patrimônio, não caixa", r.agioLote ?? 0],
            ["Entrada total reconhecida", r.entradaTotalReconhecida],
            ["Financiamento total", item.credito_aprovado],
            ["Quitação estimada do lote", r.quitacaoLote ?? 0],
            ["Saldo do lote não coberto", r.saldoLoteNaoCoberto ?? 0],
            ["Financiamento da construção", r.financiamentoConstrucao ?? 0],
            ["Recursos utilizáveis na operação", r.recursosUtilizaveis ?? 0],
            ["Despesas pré-contrato", r.despesasPreContrato ?? 0],
            ["Entrada em dinheiro livre para início", r.entradaLivreInicioObra ?? 0],
            ["Aporte adicional estimado", r.aporteAdicional ?? 0],
          ].map(([label, value]) => <p key={String(label)}><span className="block text-muted-foreground">{label}</span><strong>{BRL.format(Number(value))}</strong></p>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">O ágio compõe a entrada reconhecida, mas não é dinheiro disponível. O FGTS depende de elegibilidade e não foi contado como caixa livre no início. O financiamento é liberado por medições, não integralmente no início da obra.</p>
        {(item.saldo_devedor_terreno ?? 0) > 0 && <p className="mt-2 text-xs text-muted-foreground">Percentual máximo financiável do lote: {NUMBER.format(r.percentualFinanciavelLote ?? 80)}%. Avaliação mínima de referência para quitar o saldo: {BRL.format(r.avaliacaoMinimaLote ?? 0)}. Confirme avaliação e regras do banco; eventual saldo não coberto exige recursos próprios.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Taxa anual informada: {NUMBER.format(r.taxaJurosAnual ?? 0)}% a.a. · mensal equivalente composta: {(r.taxaJurosMensalEquivalente ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}% a.m.</p>
      </section>}
      {item.objetivo === "vender" && <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['Lucro desejado', r.lucroDesejado ?? item.lucro_desejado ?? 0],
          ['Honorários desejados', r.despesas?.filter((x) => x.id === 'honorarios-entrada' || x.id === 'honorarios-saldo').reduce((sum, x) => sum + x.valor, 0) ?? r.honorarios ?? 0],
          ['Administração do processo', r.despesas?.find((x) => x.id === 'administracao')?.valor ?? r.administracao ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{BRL.format(Number(value))}</p></CardContent></Card>
        ))}
      </section>}
      {item.objetivo === "vender" && r.valorVenda !== undefined && (
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[['Valor estimado de venda', r.valorVenda], [`Corretagem (${NUMBER.format(r.corretagemPercentual ?? 0)}%)`, r.corretagemValor ?? 0]].map(([label, value]) => (
            <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{BRL.format(Number(value))}</p></CardContent></Card>
          ))}
        </section>
      )}
      {item.objetivo === "vender" && r.custoTotal !== undefined && <section className="mt-6 border-y py-5 text-sm"><h2 className="font-semibold">Composição do preço</h2><p className="mt-2">Construção {BRL.format(r.custoConstrucao ?? 0)} · extras {BRL.format(r.extrasTotal)} · despesas {BRL.format(r.despesasTotal ?? 0)} (projetos, honorários e administração inclusos) · reserva {BRL.format(r.contingencia)} · juros da obra {BRL.format((r.custoTotal ?? 0) - (r.custoConstrucao ?? 0) - r.extrasTotal - (r.despesasTotal ?? 0) - r.contingencia)} · lucro {BRL.format(r.lucroDesejado ?? 0)} · corretagem {BRL.format(r.corretagemValor ?? 0)}</p></section>}
       {item.objetivo === "vender" && r.mesesAposObra !== undefined && <section className="mt-6 border-y py-5 text-sm"><h2 className="font-semibold">Venda e investidor</h2><p className="mt-2">Venda {r.mesesAposObra} mês(es) após conclusão · encargos pós-obra estimados {BRL.format(r.jurosPosObra ?? 0)} · parcelas estimadas {BRL.format(r.parcelasEstimadas ?? 0)} · capital aportado pelo investidor {BRL.format(r.capitalAportadoInvestidor ?? r.capitalInvestidor ?? 0)} · participação {r.participacaoInvestidor ?? 0}%</p><p className="mt-2 text-xs text-muted-foreground">Capital estimado como despesas pré-contrato e juros de obra. Parcelas são saídas de caixa, incluindo amortização ilustrativa em 360 meses, que não é despesa adicional. Retorno pressupõe que o investidor arque com esse capital; confirme as condições contratuais.</p></section>}
      {item.objetivo === "vender" && <section className="mt-10">
        <h2 className="text-xl font-semibold">Três cenários</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {r.cenarios.map((c, i) => (
            <Card key={c.nome} className={i === 1 ? "border-primary/50" : ""}>
              <CardContent className="p-5">
                {i === 0 ? (
                  <TrendingDown className="text-destructive" />
                ) : i === 1 ? (
                  <Minus className="text-secondary" />
                ) : (
                  <TrendingUp className="text-primary" />
                )}
                <p className="mt-5 font-semibold">{c.nome}</p>
                 {c.venda !== undefined && <p className="mt-2 text-sm">Venda: {BRL.format(c.venda)}</p>}
                <p className="mt-1 text-xs text-muted-foreground">Saldo final estimado</p>
                <p
                  className={`mt-3 text-2xl font-bold ${c.saldo >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {BRL.format(c.saldo)}
                </p>
                {c.lucroConstrutor !== undefined && <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>Construtor: {BRL.format(c.lucroConstrutor)}</p><p>Investidor: {BRL.format(c.lucroInvestidor ?? 0)}</p><p>Rentabilidade: {c.rentabilidadeInvestidor == null ? "—" : `${NUMBER.format(c.rentabilidadeInvestidor)}%`}</p></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>}
      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Custos fora da construção por m²</h2>
          <div className="mt-4 divide-y border-y">
            {(item.custos_extras as unknown as { descricao: string; valor: number }[]).map(
              (x, i) => (
                <div className="flex justify-between py-3 text-sm" key={i}>
                  <span className="text-muted-foreground">{x.descricao}</span>
                  <strong>{BRL.format(x.valor)}</strong>
                </div>
              ),
            )}
            <div className="flex justify-between py-4">
              <strong>Total</strong>
              <strong>{BRL.format(r.extrasTotal)}</strong>
            </div>
          </div>
          {r.despesas && (
            <>
              <h2 className="mt-8 text-xl font-semibold">Despesas adicionais</h2>
              <div className="mt-4 divide-y border-y">
                {r.despesas.map((x) => (
                  <div className="flex justify-between gap-4 py-3 text-sm" key={x.id}>
                    <span className="text-muted-foreground">{x.nome}</span>
                    <strong>{BRL.format(x.valor)}</strong>
                  </div>
                ))}
                <div className="flex justify-between py-4">
                  <strong>Total</strong>
                  <strong>{BRL.format(r.despesasTotal ?? 0)}</strong>
                </div>
              </div>
            </>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold">Cronograma físico-financeiro</h2>
          {r.liberacoesMensais && <div className="mt-4 border-y py-4"><p className="text-sm font-semibold">Liberações mensais · {r.prazoExecucaoMeses} meses</p><p className="mt-1 text-xs text-muted-foreground">Percentuais aplicados somente ao financiamento da construção ({BRL.format(r.financiamentoConstrucao ?? 0)}), sem a quitação do lote. Liberações previstas após a medição, ao fim de cada mês; encargos estimados sobre o saldo já liberado.</p><div className="mt-4 space-y-2">{r.liberacoesMensais.map((month) => <div key={month.mes} className="flex flex-wrap justify-between gap-x-4 text-sm"><span>Mês {month.mes} · {NUMBER.format(month.percentual)}%</span><span>{BRL.format(month.liberacao)} · encargo {BRL.format(month.encargo)}</span></div>)}</div><p className="mt-3 text-sm font-semibold">Juros de obra estimados: {BRL.format(r.jurosObra ?? 0)}</p></div>}
          <div className="mt-4 border-l border-primary/40 pl-5">
            {r.cronograma.map((s, i) => (
              <div className="relative pb-5" key={s.nome}>
                <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-primary" />
                <div className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {s.nome}{" "}
                    <span className="text-muted-foreground">({s.percentual}%)</span>
                  </span>
                  <strong>{BRL.format(s.valor)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
