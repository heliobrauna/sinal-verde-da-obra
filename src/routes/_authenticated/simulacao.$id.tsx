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
import { ArrowLeft, CheckCircle2, TrendingDown, Minus, TrendingUp, Trash2 } from "lucide-react";
type R = {
  areaViavel: number;
  custoM2: number;
  contingencia: number;
  extrasTotal: number;
  despesasTotal?: number;
  despesas?: ClientExpense[];
  cubReferencia?: { competencia: string; projeto: string; origem: string };
  cenarios: { nome: string; saldo: number }[];
  cronograma: { nome: string; percentual: number; valor: number }[];
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
        <AlertDialog>
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
        </AlertDialog>
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-primary">SINAL DE VIABILIDADE</p>
          <h1 className="mt-2 text-3xl font-bold">{item.nome}</h1>
          <p className="mt-2 text-muted-foreground">
            Análise baseada no valor financiado e orçamento informados.
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
            <p className="text-sm text-muted-foreground">Área construída viável</p>
            <p className="mt-2 text-5xl font-bold text-primary">
              {NUMBER.format(r.areaViavel)} <span className="text-2xl">m²</span>
            </p>
          </CardContent>
        </Card>
        {[
          ["Custo por m²", r.custoM2],
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
      <section className="mt-10">
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
                <p className="mt-1 text-xs text-muted-foreground">Saldo final estimado</p>
                <p
                  className={`mt-3 text-2xl font-bold ${c.saldo >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {BRL.format(c.saldo)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Custos fora do CUB</h2>
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
