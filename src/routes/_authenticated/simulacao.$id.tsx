import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  cenarios: { nome: string; saldo: number; venda?: number; lucroConstrutor?: number; lucroInvestidor?: number; rentabilidadeInvestidor?: number | null; superaSelic?: boolean | null; preferencialPago?: number }[];
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
  jurosObraJuros?: number;
  jurosObraTr?: number;
  jurosObraSeguros?: number;
  trMensal?: number;
  capitalAportadoInvestidor?: number;
  prazoExecucaoMeses?: number;
  liberacoesMensais?: { mes: number; percentual: number; liberacao: number; saldoLiberado: number; encargo: number }[];
  primeiroImovelSfh?: boolean;
  custoComTerreno?: number;
  valorOperacao?: number;
  entradaExigida?: number;
  agioNaEntrada?: number;
  fgtsNaEntrada?: number;
  dinheiroEntrada?: number;
  complementoLote?: number;
  orcamentoObraContrato?: number;
  financiamentoExcedente?: number;
  despesasAssinatura?: number;
  desembolsoAntesContrato?: number;
  desembolsoAssinatura?: number;
  desembolsoDuranteObra?: number;
  desembolsoProprio?: number;
  maiorEncargoMensal?: number;
  aportesInvestidor?: { mes: number; rotulo: string; valor: number }[];
  capitalGiro?: number;
  selicAnual?: number;
  selicLiquida?: number;
  aliquotaIr?: number;
  premioInvestidor?: number;
  taxaPreferencial?: number;
  retornoPreferencial?: number;
  mesVenda?: number;
  origemTerreno?: "investidor" | "construtor" | "compra";
  recebimentoConstrutorLote?: number;
  loteContrato?: number;
  obraContrato?: number;
  redistribuicaoContrato?: boolean;
  lucroConstrutorDesejado?: number | null;
  corretagemLoteValor?: number;
  irGanhoLote?: number;
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

// Na proposta para morar, os números do construtor ficam recolhidos para o cliente ler só o essencial.
function Detalhes({ recolher, children }: { recolher: boolean; children: ReactNode }) {
  if (!recolher) return <div className="mt-8">{children}</div>;
  return (
    <details className="mt-8 rounded-lg border p-4 md:p-5">
      <summary className="cursor-pointer select-none text-sm font-semibold text-primary">Detalhes para o construtor: contrato, custos, cronograma e liberações</summary>
      <div className="mt-6">{children}</div>
    </details>
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
  // Simulações com cascata têm fluxos datados do investidor; as antigas só mostram a participação.
  const cascata = vender && (r.aportesInvestidor?.length ?? 0) > 0;
  const investidor = cascata || (r.participacaoInvestidor ?? 0) > 0;

  // O terreno compõe o custo nos dois modos; registros antigos não guardavam o valor com terreno.
  const custoComTerreno = r.custoComTerreno ?? (hasValue(r.custoTotal) ? r.custoTotal + item.terreno_valor : undefined);
  const custoDetalhe = hasValue(custoComTerreno) ? `Terreno ${BRL.format(item.terreno_valor)} + obra e despesas ${BRL.format(custoComTerreno - item.terreno_valor)}` : undefined;
  // Proposta para quem vai morar: o que o banco libera, FGTS, terreno e o bolso do cliente somam o custo total;
  // a verba do banco que sobra aparece como desconto para a soma fechar.
  const sobra = Math.max(r.saldoRecursos ?? 0, 0);
  const proposta = !vender && hasValue(custoComTerreno) && r.desembolsoProprio !== undefined && r.financiamentoConstrucao !== undefined;
  const pagamento: Row[] = [
    ["Financiamento do banco", (r.quitacaoLote ?? 0) + (r.financiamentoConstrucao ?? 0)],
    ["FGTS", r.fgtsNaEntrada],
    ["Terreno que já é seu (ágio)", r.agioNaEntrada],
    ["Dinheiro do seu bolso", r.desembolsoProprio],
    ["Sobra da verba do banco (não gasta)", -sobra],
  ];

  const metrics = proposta
    ? [
        { label: "Casa que cabe no orçamento", value: !hasValue(areaMax) ? undefined : areaMin === areaMax ? m2(areaMin) : `${NUMBER.format(areaMin)} a ${m2(areaMax)}`, detail: hasValue(r.areaPlanejada) ? `Planejada: ${m2(r.areaPlanejada)}` : undefined, tone: "text-primary" },
        { label: "Custo total do imóvel (terreno + obra)", value: BRL.format(custoComTerreno ?? 0), detail: custoDetalhe },
        { label: "Dinheiro do seu bolso", value: BRL.format(r.desembolsoProprio ?? 0), detail: "Além do financiamento, do FGTS e do terreno", tone: "text-secondary" },
      ]
    : [
    { label: "Área viável", value: !hasValue(areaMax) ? undefined : areaMin === areaMax ? m2(areaMin) : `${NUMBER.format(areaMin)} a ${m2(areaMax)}`, detail: hasValue(r.areaPlanejada) ? `Planejada: ${m2(r.areaPlanejada)}` : undefined, tone: "text-primary" },
    vender
      ? { label: "Venda estimada", value: hasValue(r.valorVenda) ? BRL.format(r.valorVenda) : undefined, detail: hasValue(r.corretagemValor) ? `Corretagem ${BRL.format(r.corretagemValor)}` : undefined }
      : { label: "Verba da obra", value: hasValue(r.recursosUtilizaveis) ? BRL.format(r.recursosUtilizaveis) : undefined },
    { label: "Custo total (terreno + obra)", value: hasValue(custoComTerreno) ? BRL.format(custoComTerreno) : undefined, detail: custoDetalhe },
    vender
      ? { label: r.lucroConstrutorDesejado != null ? "Lucro total na venda" : "Lucro desejado", value: hasValue(lucro) ? BRL.format(lucro) : undefined, detail: hasValue(r.lucroConstrutorDesejado ?? undefined) ? `Construtor: ${BRL.format(r.lucroConstrutorDesejado ?? 0)}` : undefined, tone: "text-primary" }
      : { label: "Dinheiro do cliente", value: hasValue(r.desembolsoProprio) ? BRL.format(r.desembolsoProprio) : undefined, tone: "text-secondary" },
  ];
  const visibleMetrics = metrics.filter((metric) => metric.value !== undefined);

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

      <section className={`mt-6 grid gap-3 ${proposta ? "sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
        {visibleMetrics.map((metric, i) => (
          <Card key={metric.label} className={i === 0 ? "border-primary/40" : ""}>
            <CardContent className="p-4 md:p-5">
              <p className="text-xs text-muted-foreground md:text-sm">{metric.label}</p>
              <p className={`mt-2 text-lg font-bold md:text-2xl ${metric.tone ?? ""}`}>{metric.value}</p>
              {metric.detail && <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </section>

      {proposta && (
        <div className="mt-8 max-w-xl">
          <Rows title="Como o imóvel é pago" rows={pagamento} total={["Custo total do imóvel", custoComTerreno]} />
          {hasValue(r.aporteParaAreaPlanejada) && <p className="mt-2 text-xs text-muted-foreground">O dinheiro do seu bolso inclui {BRL.format(r.aporteParaAreaPlanejada)} para construir {hasValue(r.areaPlanejada) ? m2(r.areaPlanejada) : "a área planejada"}, acima do que o financiamento cobre.</p>}
          {hasValue(sobra) && <p className="mt-2 text-xs text-muted-foreground">Sobram {BRL.format(sobra)} da verba do banco: dá para ampliar a casa ou guardar para imprevistos.</p>}
        </div>
      )}

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
                      Investidor {BRL.format(c.lucroInvestidor)} · {hasValue(c.lucroConstrutor) ? `Construtor ${BRL.format(c.lucroConstrutor)}` : "sem excedente para o construtor"}
                    </p>
                  )}
                  {cascata && c.rentabilidadeInvestidor != null && (
                    <p className={`mt-1 text-xs font-semibold ${c.superaSelic ? "text-primary" : "text-destructive"}`}>
                      Investidor: {NUMBER.format(c.rentabilidadeInvestidor)}% a.a. · Selic líq. {NUMBER.format(r.selicLiquida ?? 0)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {(hasValue(r.mesesAposObra) || investidor) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {hasValue(r.mesesAposObra) && `Venda ${r.mesesAposObra} meses após a obra${hasValue(r.jurosPosObra) ? `, com encargos de ${BRL.format(r.jurosPosObra)}` : ""}. `}
              {investidor && !cascata && `Investidor com ${NUMBER.format(r.participacaoInvestidor ?? 0)}% do resultado${hasValue(r.capitalAportadoInvestidor) ? ` e aporte de ${BRL.format(r.capitalAportadoInvestidor)}` : ""}.`}
            </p>
          )}
          {cascata && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Rows
                title="Capital do investidor"
                rows={Object.entries((r.aportesInvestidor ?? []).reduce<Record<string, number>>((acc, flow) => ({ ...acc, [flow.rotulo]: (acc[flow.rotulo] ?? 0) + flow.valor }), {}))}
                total={["Total aportado", r.capitalAportadoInvestidor]}
              />
              <section>
                <h2 className="text-lg font-semibold">Divisão na venda (cascata)</h2>
                <ol className="mt-3 space-y-2 border-y py-3 text-sm">
                  <li><strong>1. Devolução do capital</strong> do investidor{hasValue(r.capitalGiro) && " (o capital de giro volta antes, com as liberações)"}.</li>
                  <li><strong>2. Retorno preferencial</strong> de {NUMBER.format(r.taxaPreferencial ?? 0)}% a.a.: Selic {NUMBER.format(r.selicAnual ?? 0)}% − IR {NUMBER.format(r.aliquotaIr ?? 0)}% + prêmio de {NUMBER.format(r.premioInvestidor ?? 0)} p.p. = {BRL.format(r.retornoPreferencial ?? 0)} até o mês {r.mesVenda}.</li>
                  <li><strong>3. Excedente</strong> dividido: {NUMBER.format(r.participacaoInvestidor ?? 0)}% investidor · {NUMBER.format(100 - (r.participacaoInvestidor ?? 0))}% construtor.</li>
                </ol>
                {(hasValue(r.corretagemLoteValor) || hasValue(r.irGanhoLote)) && <p className="mt-2 text-xs text-muted-foreground">Terreno no capital pelo valor líquido de venda: descontados {hasValue(r.corretagemLoteValor) ? `corretagem de ${BRL.format(r.corretagemLoteValor)}` : ""}{hasValue(r.corretagemLoteValor) && hasValue(r.irGanhoLote) ? " e " : ""}{hasValue(r.irGanhoLote) ? `IR de ${BRL.format(r.irGanhoLote)} sobre o ganho` : ""}.</p>}
                {hasValue(r.recebimentoConstrutorLote) && <p className="mt-2 text-xs text-muted-foreground">O construtor recebe {BRL.format(r.recebimentoConstrutorLote)} pelo lote na assinatura.</p>}
              </section>
            </div>
          )}
        </section>
      )}

      <Detalhes recolher={proposta}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Rows
            title="Contrato"
            rows={[
              ["Valor do imóvel", r.valorOperacao],
              ["Valor do financiamento", item.credito_aprovado],
              ["Valor de entrada (comprovação)", r.entradaExigida],
              ["Entrada · ágio do lote", r.agioNaEntrada],
              ["Entrada · FGTS", r.fgtsNaEntrada],
              ["Entrada · dinheiro", r.dinheiroEntrada],
              ["Quitação do lote", r.quitacaoLote],
              ["Financiamento para a obra", r.financiamentoConstrucao],
            ]}
            total={["Verba da obra", r.recursosUtilizaveis]}
          />
          {hasValue(r.financiamentoExcedente) && <p className="-mt-6 text-xs text-secondary">O ágio supera a entrada: {BRL.format(r.financiamentoExcedente)} do valor informado não seriam liberados para a obra.</p>}
          <Rows
            title="Dinheiro do cliente"
            rows={[
              ["Antes do contrato", r.desembolsoAntesContrato],
              ...(r.despesasAssinatura !== undefined
                ? [["Taxas e cartório na assinatura", r.despesasAssinatura + (r.complementoLote ?? 0)] as Row, ["Entrada em dinheiro (aplicada na obra)", r.dinheiroEntrada] as Row]
                : [["Na assinatura", r.desembolsoAssinatura] as Row]),
              // Encargos de obra e aporte para a área planejada são coisas distintas; separa quando os dois existem.
              ...(r.jurosObra !== undefined
                ? [
                    [hasValue(r.prazoExecucaoMeses) ? `Encargos de obra (${r.prazoExecucaoMeses} meses)` : "Encargos de obra", r.jurosObra] as Row,
                    [hasValue(r.areaPlanejada) ? `Aporte para construir ${m2(r.areaPlanejada)} (acima da área viável)` : "Aporte para a área planejada", r.aporteParaAreaPlanejada] as Row,
                  ]
                : [[hasValue(r.prazoExecucaoMeses) ? `Durante a obra (${r.prazoExecucaoMeses} meses)` : "Durante a obra", r.desembolsoDuranteObra] as Row]),
            ]}
            total={["Total do bolso do cliente", r.desembolsoProprio]}
          />
          {hasValue(r.maiorEncargoMensal) && <p className="-mt-6 text-xs text-muted-foreground">Maior encargo mensal de obra: {BRL.format(r.maiorEncargoMensal)}. Encargos = juros + TR sobre a dívida já liberada (lote desde a assinatura + parcelas medidas) + seguros e tarifa. O FGTS não paga taxas nem encargos.</p>}
          <Rows
            title="Custos"
            rows={[
              ["Terreno", item.terreno_valor],
              [hasValue(r.areaPlanejada) ? `Construção (${m2(r.areaPlanejada)})` : "Construção", r.custoConstrucao],
              ...extras.map((x): Row => [x.descricao || "Custo extra", x.valor]),
              ...(r.despesas ?? []).map((x): Row => [x.nome, x.valor]),
              ...(r.jurosObraJuros !== undefined
                ? [
                    [hasValue(r.taxaJurosAnual) ? `Juros de obra (${NUMBER.format(r.taxaJurosAnual)}% a.a.)` : "Juros de obra", r.jurosObraJuros] as Row,
                    [hasValue(r.trMensal) ? `Atualização pela TR (${NUMBER.format(r.trMensal ?? 0)}% a.m.)` : "Atualização pela TR", r.jurosObraTr] as Row,
                    ["Seguros e tarifa na obra", r.jurosObraSeguros] as Row,
                  ]
                : [[hasValue(r.taxaJurosAnual) ? `Juros de obra (${NUMBER.format(r.taxaJurosAnual)}% a.a.)` : "Juros de obra", r.jurosObra] as Row]),
            ]}
            total={["Custo total (terreno + obra)", custoComTerreno]}
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
                  {hasValue(r.quitacaoLote) && r.jurosObraJuros !== undefined && (
                    <tr>
                      <td className="py-2">Assinatura <span className="text-muted-foreground">· lote</span></td>
                      <td className="py-2 text-right">{BRL.format(r.quitacaoLote)}</td>
                      <td className="py-2 text-right text-muted-foreground"></td>
                    </tr>
                  )}
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
      {r.loteContrato !== undefined && hasValue(r.valorOperacao) && (
        <section className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold">Sugestão para preencher o contrato</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Valor do terreno</dt><dd className="font-semibold">{BRL.format(r.loteContrato)}</dd></div>
            <div><dt className="text-muted-foreground">Valor da construção</dt><dd className="font-semibold">{BRL.format(r.obraContrato ?? 0)}</dd></div>
            <div><dt className="text-muted-foreground">Valor do imóvel</dt><dd className="font-semibold">{BRL.format(r.valorOperacao)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {r.redistribuicaoContrato
              ? `O saldo do lote passa de 80% do valor do terreno. No contrato, o terreno entra como ${BRL.format(r.quitacaoLote ?? 0)} ÷ 0,8 para que os 80% do banco quitem a loteadora na assinatura, sem recurso próprio; a construção fica com o restante. O valor do imóvel e o financiamento total não mudam.`
              : "O saldo do lote cabe nos 80% que o banco financia sobre o terreno; não é preciso redistribuir valores no contrato."}
          </p>
        </section>
      )}
      </Detalhes>
      <p className="mt-8 text-xs text-muted-foreground">Estimativas para decisão. Confirme valores com o banco, a prefeitura e o cartório.</p>
    </AppShell>
  );
}
