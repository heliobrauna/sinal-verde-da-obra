import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Calculator, ArrowUpRight, Building2, Trash2, Pencil } from "lucide-react";
import { NUMBER } from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Minhas simulações | Sinal Verde da Obra" },
      { name: "description", content: "Acompanhe suas análises de viabilidade." },
      { property: "og:title", content: "Minhas simulações" },
      { property: "og:description", content: "Painel de viabilidade das suas obras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
function Dashboard() {
  const [items, setItems] = useState<Tables<"simulacoes">[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from("simulacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);
  async function remove(id: string) {
    const { error } = await supabase.from("simulacoes").delete().eq("id", id);
    if (!error) setItems(items.filter((item) => item.id !== id));
  }
  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-primary">VISÃO GERAL</p>
          <h1 className="mt-2 text-3xl font-bold">Minhas simulações</h1>
          <p className="mt-2 text-muted-foreground">
            Retome uma análise ou avalie uma nova oportunidade.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/simulacao/nova">
            <Calculator />
            Nova simulação
          </Link>
        </Button>
      </div>
      {loading ? (
        <div className="mt-10 h-40 animate-pulse rounded-lg bg-muted" />
      ) : items.length === 0 ? (
        <div className="mt-10 border-y py-16 text-center">
          <Building2 className="mx-auto size-10 text-primary" />
          <h2 className="mt-5 text-xl font-semibold">Nenhuma obra analisada ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pelo valor financiado e descubra uma área segura para construir.
          </p>
          <Button asChild className="mt-6">
            <Link to="/simulacao/nova">Criar primeira simulação</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const result = item.resultado as { areaViavel?: number };
            return (
              <Card key={item.id} className="transition-colors hover:border-primary/50">
                <CardContent className="p-5">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-display text-lg font-semibold">{item.nome}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="icon"><Link to="/simulacao/nova" search={{ editar: item.id }} aria-label={`Editar ${item.nome}`} title="Editar simulação"><Pencil className="size-4" /></Link></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Excluir ${item.nome}`}>
                            <Trash2 className="size-4" />
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
                              onClick={() => remove(item.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          to="/simulacao/$id"
                          params={{ id: item.id }}
                          aria-label="Abrir simulação"
                        >
                          <ArrowUpRight />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-7 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Área viável</p>
                      <p className="mt-1 text-2xl font-bold">
                        {NUMBER.format(result.areaViavel ?? 0)} m²
                      </p>
                    </div>
                    <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      Analisada
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
