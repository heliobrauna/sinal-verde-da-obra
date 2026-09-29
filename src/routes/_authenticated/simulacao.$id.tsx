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
import { ArrowLeft, TrendingDown, Minus, TrendingUp, Trash2, Pencil } from "lucide-react";
type R = {
  areaViavel: number;
  areaViavelMinima?: number;
  areaViavelMaxima?: number;
  custoM2: number;
  custoConstrucao?: number;
  areaPlanejada?: number;
  aporteParaAreaPlanejada?: number;
  saldoRecursos?: number;
  custoTotal?: number;
  jurosPosObra?: number;
  mesesAposObra?: number;
  participacaoInvestidor?: number;
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
  entradaDinheiro?: number;
  fgtsUtilizado?: number;
  agioLote?: number;
  quitacaoLote?: number;
  saldoLoteNaoCoberto?: number;
  financiamentoConstrucao?: number;
  recursosUtilizaveis?: number;
  despesasPreContrato?: number;
  aporteAdicional?: number;
  taxaJurosAnual?: number;
  taxaJurosMensalEquivalente?: number;
  jurosObra?: number;
  capitalAportadoInvestidor?: number;
  prazoExecucaoMeses?: number;
  liberacoesMensais?: { mes: number; percentual: number; liberacao: number; saldoLiberado: number; encargo: number }[];
  primeiroImovelSfh?: boolean;
  custoComTerreno?: number;
  valorOperacao?: number;
  percentualFinanciamento?: number;
  entradaExigida?: number;
  agioNaEntrada?: number;
  fgtsNaEntrada?: number;
  dinheiroEntrada?: number;
  complementoLote?: number;
  orcamentoObraContrato?: number;
  financiamentoExcedente?: number;
  aporteProprioObra?: number;
  despesasAssinatura?: number;
  desembolsoAntesContrato?: number;
  desembolsoAssinatura?: number;
  desembolsoDuranteObra?: number;
  desembolsoProprio?: number;
  maiorEncargoMensal?: number;
};
type Row = [label: string, value: number | undefined];

// Nenhum valor zerado (ou ausente em simulações antigas) é exibido no relatório.
const hasValue = (value: number | undefined): value is number => value !== undefined && Math.abs(value) >= 0.005;
const m2 = (value: number) => `${NUMBER.format(value)} m²`;

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

function Rows({ title, rows, total }: { title: string; rows: Row[]; total?: Row }) {
  const visible = rows.filter(([, value]) => hasValue(value));
  if (visible.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-3 divide-y border-y text-sm">
        {visible.map(([label, value]) => (
          <div className="flex justify-between gap-4 py-2.5" key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="shrink-0 font-semibold">{BRL.format(value ?? 0)}</dd>
          </div>
        ))}
        {total && hasValue(total[1]) && (
          <div className="flex justify-between gap-4 py-3 font-semibold">
            <dt>{total[0]}</dt>
            <dd className="shrink-0">{BRL.format(total[1])}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

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
  const vender = item.objetivo === "vender";
  const areaMin = r.areaViavelMinima ?? r.areaViavel;
  const areaMax = r.areaViavelMaxima ?? r.areaViavel;
  const lucro = r.lucroDesejado ?? item.lucro_desejado ?? 0;
  const extras = (item.custos_extras as unknown as { descricao: string; valor: number }[]) ?? [];
  const investidor = (r.participacaoInvestidor ?? 0) > 0;

  const metrics = [
    { label: "Área viável", value: !hasValue(areaMax) ? undefined : areaMin === areaMax ? m2(areaMin) : `${NUMBER.format(areaMin)} a ${m2(areaMax)}`, detail: hasValue(r.areaPlanejada) ? `Planejada: ${m2(r.areaPlanejada)}` : undefined, tone: "text-primary" },
    vender
      ? { label: "Venda estimada", value: hasValue(r.valorVenda) ? BRL.format(r.valorVenda) : undefined, detail: hasValue(r.corretagemValor) ? `Corretagem ${BRL.format(r.corretagemValor)}` : undefined }
      : { label: "Verba da obra", value: hasValue(r.recursosUtilizaveis) ? BRL.format(r.recursosUtilizaveis) : undefined },
    vender && hasValue(r.custoComTerreno)
      ? { label: "Custo com terreno", value: BRL.format(r.custoComTerreno), detail: hasValue(r.custoM2) ? `${BRL.format(r.custoM2)}/m²` : undefined }
      : { label: "Custo total", value: hasValue(r.custoTotal) ? BRL.format(r.custoTotal) : undefined, detail: hasValue(r.custoM2) ? `${BRL.format(r.custoM2)}/m²` : undefined },
    vender
      ? { label: "Lucro desejado", value: hasValue(lucro) ? BRL.format(lucro) : undefined, tone: "text-primary" }
      : { label: "Dinheiro do cliente", value: hasValue(r.desembolsoProprio) ? BRL.format(r.desembolsoProprio) : undefined, tone: "text-secondary" },
  ].filter((metric) => metric.value !== undefined);

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
      <div className="mt-5">
        <p className="text-sm font-semibold text-primary">{vender ? "CONSTRUIR PARA VENDER" : "CONSTRUIR PARA MORAR"}</p>
        <h1 className="mt-2 text-3xl font-bold">{item.nome}</h1>
        {r.cubReferencia && (
          <p className="mt-1 text-xs text-muted-foreground">
            CUB {r.cubReferencia.projeto} · {r.cubReferencia.competencia} · {r.cubReferencia.origem}
          </p>
        )}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className={metric.label === "Área viável" ? "border-primary/40" : ""}>
            <CardContent className="p-4 md:p-5">
              <p className="text-xs text-muted-foreground md:text-sm">{metric.label}</p>
              <p className={`mt-2 text-lg font-bold md:text-2xl ${metric.tone ?? ""}`}>{metric.value}</p>
              {metric.detail && <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </section>

      {vender && r.cenarios.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Cenários de venda</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {r.cenarios.map((c, i) => (
              <Card key={c.nome} className={i === 1 ? "border-primary/50" : ""}>
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{c.nome}</p>
                    {i === 0 ? <TrendingDown className="size-5 text-destructive" /> : i === 1 ? <Minus className="size-5 text-secondary" /> : <TrendingUp className="size-5 text-primary" />}
                  </div>
                  {hasValue(c.venda) && <p className="mt-2 text-sm text-muted-foreground">Venda {BRL.format(c.venda)}</p>}
                  <p className={`mt-1 text-2xl font-bold ${c.saldo >= 0 ? "text-primary" : "text-destructive"}`}>{BRL.format(c.saldo)}</p>
                  {investidor && hasValue(c.lucroInvestidor) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Investidor {BRL.format(c.lucroInvestidor)}
                      {c.rentabilidadeInvestidor != null && ` (${NUMBER.format(c.rentabilidadeInvestidor)}%)`} · Construtor {BRL.format(c.lucroConstrutor ?? 0)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {(hasValue(r.mesesAposObra) || investidor) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {hasValue(r.mesesAposObra) && `Venda ${r.mesesAposObra} meses após a obra${hasValue(r.jurosPosObra) ? `, com encargos de ${BRL.format(r.jurosPosObra)}` : ""}. `}
              {investidor && `Investidor com ${NUMBER.format(r.participacaoInvestidor ?? 0)}% do resultado${hasValue(r.capitalAportadoInvestidor) ? ` e aporte de ${BRL.format(r.capitalAportadoInvestidor)}` : ""}.`}
            </p>
          )}
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Rows
            title="Contrato"
            rows={[
              ["Valor da operação", r.valorOperacao],
              [hasValue(r.percentualFinanciamento) ? `Financiamento (${NUMBER.format(r.percentualFinanciamento)}%)` : "Financiamento", item.credito_aprovado],
              ["Entrada exigida", r.entradaExigida],
              ["Entrada · ágio do lote", r.agioNaEntrada],
              ["Entrada · FGTS", r.fgtsNaEntrada],
              ["Entrada · dinheiro", r.dinheiroEntrada],
              ["Quitação do lote", r.quitacaoLote],
              ["Financiamento para a obra", r.financiamentoConstrucao],
              ["Recursos próprios extras", r.aporteProprioObra],
            ]}
            total={["Verba da obra", r.recursosUtilizaveis]}
          />
          {hasValue(r.financiamentoExcedente) && <p className="-mt-6 text-xs text-secondary">O ágio supera a entrada: {BRL.format(r.financiamentoExcedente)} do valor informado não seriam liberados para a obra.</p>}
          <Rows
            title="Dinheiro do cliente"
            rows={[
              ["Antes do contrato", r.desembolsoAntesContrato],
              ["Na assinatura (entrada e taxas)", r.desembolsoAssinatura],
              [hasValue(r.prazoExecucaoMeses) ? `Durante a obra (${r.prazoExecucaoMeses} meses de juros)` : "Durante a obra", r.desembolsoDuranteObra],
            ]}
            total={["Total do bolso do cliente", r.desembolsoProprio]}
          />
          {hasValue(r.maiorEncargoMensal) && <p className="-mt-6 text-xs text-muted-foreground">Maior parcela de juros de obra: {BRL.format(r.maiorEncargoMensal)}/mês. O FGTS não paga taxas nem juros.</p>}
          <Rows
            title="Custos"
            rows={[
              ...(vender && hasValue(r.custoComTerreno) ? [["Terreno", item.terreno_valor] as Row] : []),
              [hasValue(r.areaPlanejada) ? `Construção (${m2(r.areaPlanejada)})` : "Construção", r.custoConstrucao],
              ...extras.map((x): Row => [x.descricao || "Custo extra", x.valor]),
              ...(r.despesas ?? []).map((x): Row => [x.nome, x.valor]),
              [hasValue(r.taxaJurosAnual) ? `Juros de obra (${NUMBER.format(r.taxaJurosAnual)}% a.a.)` : "Juros de obra", r.jurosObra],
            ]}
            total={vender && hasValue(r.custoComTerreno) ? ["Custo com terreno", r.custoComTerreno] : ["Custo total", r.custoTotal]}
          />
          {r.primeiroImovelSfh && <p className="text-xs text-muted-foreground">Registros com desconto de 50% do Art. 290 da Lei 6.015/73 (primeiro imóvel pelo SFH).</p>}
        </div>
        <div className="space-y-8">
          {r.liberacoesMensais && r.liberacoesMensais.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Liberações da PCI · {r.prazoExecucaoMeses ?? r.liberacoesMensais.length} meses</h2>
              <table className="mt-3 w-full border-y text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2 font-normal">Mês</th><th className="py-2 text-right font-normal">Liberação</th><th className="py-2 text-right font-normal">Encargo</th></tr>
                </thead>
                <tbody className="divide-y">
                  {r.liberacoesMensais.filter((month) => hasValue(month.liberacao) || hasValue(month.encargo)).map((month) => (
                    <tr key={month.mes}>
                      <td className="py-2">{month.mes} <span className="text-muted-foreground">· {NUMBER.format(month.percentual)}%</span></td>
                      <td className="py-2 text-right">{hasValue(month.liberacao) ? BRL.format(month.liberacao) : ""}</td>
                      <td className="py-2 text-right text-muted-foreground">{hasValue(month.encargo) ? BRL.format(month.encargo) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <Rows
            title="Cronograma por etapa"
            rows={r.cronograma.map((s, i): Row => [`${i + 1}. ${s.nome} (${NUMBER.format(s.percentual)}%)`, s.valor])}
          />
        </div>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Estimativas para decisão. Confirme valores com o banco, a prefeitura e o cartório.</p>
    </AppShell>
  );
}
