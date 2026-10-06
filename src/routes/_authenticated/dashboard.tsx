import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Calculator, ArrowUpRight, Building2, Trash2, Pencil, Copy, Search } from "lucide-react";
import { ResumoSimulacao } from "@/components/app/ResumoSimulacao";
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

// Busca sem diferenciar maiúsculas e acentos ("joao" encontra "João").
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Dashboard() {
  const [items, setItems] = useState<Tables<"simulacoes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
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
    if (!error) setItems((atual) => atual.filter((item) => item.id !== id));
  }
  async function renomear(id: string, nome: string) {
    const { error } = await supabase.from("simulacoes").update({ nome }).eq("id", id);
    if (error) { setAviso("Não foi possível renomear. Tente novamente."); return false; }
    setAviso("");
    setItems((atual) => atual.map((item) => (item.id === id ? { ...item, nome } : item)));
    return true;
  }
  // A cópia guarda todos os dados e o resultado: vira um cenário novo para comparar sem redigitar.
  async function duplicar(item: Tables<"simulacoes">) {
    const { id: _id, created_at: _criado, updated_at: _atualizado, ...dados } = item;
    const { data, error } = await supabase.from("simulacoes").insert({ ...dados, nome: `${item.nome} (cópia)` }).select("*").single();
    if (error || !data) { setAviso("Não foi possível duplicar. Tente novamente."); return; }
    setAviso("");
    setItems((atual) => [data, ...atual]);
  }
  const termo = normalizar(busca.trim());
  const visiveis = termo ? items.filter((item) => normalizar(item.nome).includes(termo)) : items;
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
          <Link to="/simulacao/nova" search={{}}>
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
            <Link to="/simulacao/nova" search={{}}>Criar primeira simulação</Link>
          </Button>
        </div>
      ) : (
        <>
          {items.length > 3 && (
            <div className="relative mt-8 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 pl-9" placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar simulação pelo nome" />
            </div>
          )}
          {aviso && <p role="alert" className="mt-4 text-sm text-destructive">{aviso}</p>}
          {visiveis.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Nenhuma simulação com “{busca.trim()}”.</p>}
          <div className={`${items.length > 3 ? "mt-6" : "mt-10"} grid gap-4 md:grid-cols-2`}>
            {visiveis.map((item) => (
              <Card key={item.id} className="transition-colors hover:border-primary/50">
                <CardContent className="p-5">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <NomeEditavel nome={item.nome} onSalvar={(nome) => renomear(item.id, nome)} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.objetivo === "vender" ? "Construir para vender" : "Construir para morar"} · {item.estado} · {new Date(item.updated_at ?? item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button asChild variant="ghost" size="icon"><Link to="/simulacao/nova" search={{ editar: item.id }} aria-label={`Editar ${item.nome}`} title="Editar simulação"><Pencil className="size-4" /></Link></Button>
                      <Button variant="ghost" size="icon" onClick={() => duplicar(item)} aria-label={`Duplicar ${item.nome}`} title="Duplicar para comparar cenários"><Copy className="size-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Excluir ${item.nome}`} title="Excluir">
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
                        <Link to="/simulacao/$id" params={{ id: item.id }} aria-label="Abrir simulação" title="Abrir">
                          <ArrowUpRight />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <ResumoSimulacao item={item} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

// Clique no nome para renomear: Enter (ou sair do campo) salva, Esc cancela.
function NomeEditavel({ nome, onSalvar }: { nome: string; onSalvar: (nome: string) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  async function concluir() {
    if (salvando) return;
    const novo = valor.trim();
    if (!novo || novo === nome) { setValor(nome); setEditando(false); return; }
    setSalvando(true);
    const ok = await onSalvar(novo);
    setSalvando(false);
    if (!ok) setValor(nome);
    setEditando(false);
  }
  if (editando) {
    return (
      <Input
        autoFocus
        className="h-9 font-display text-lg font-semibold"
        value={valor}
        disabled={salvando}
        maxLength={120}
        aria-label="Nome da simulação"
        onChange={(e) => setValor(e.target.value)}
        onBlur={concluir}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setValor(nome); setEditando(false); }
        }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setValor(nome); setEditando(true); }} className="group flex max-w-full items-center gap-2 text-left" title="Clique para renomear">
      <span className="truncate font-display text-lg font-semibold">{nome}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
